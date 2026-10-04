import { prisma } from "@/lib/prisma";
import {
  entryForRisk,
  positionFromEntries,
  validateEntriesAgainstStop,
} from "@/lib/entries-math";
import { entryToDTO, tradeToDTO } from "@/lib/serialize";
import { validateStopDirection, type Direction } from "@/lib/trading-math";

export class EntryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * Добор и снятие добора. Пока у сделки нет фиксаций: проценты фиксаций
 * считаются от всей позиции, и менять позицию задним числом — путаница.
 * Всё в одной транзакции: сделка и её входы не должны расходиться.
 */
async function loadForChange(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  accountId: string,
  tradeId: string,
) {
  const trade = await tx.trade.findFirst({
    where: { id: tradeId, accountId },
    include: { entries: { orderBy: { createdAt: "asc" } }, _count: { select: { fixes: true } } },
  });
  if (!trade) throw new EntryError("Сделка не найдена", 404);
  if (trade.status === "closed") throw new EntryError("Сделка закрыта");
  if (trade._count.fixes > 0) {
    throw new EntryError("По сделке уже есть фиксации — добирать можно только до первой");
  }
  return trade;
}

function asInput(entries: { price: unknown; size: unknown }[]) {
  return entries.map((e) => ({ price: Number(e.price), size: Number(e.size) }));
}

export async function addEntry(
  accountId: string,
  tradeId: string,
  body: { id?: string; price: number; riskPct: number; stopLoss: number },
) {
  return prisma.$transaction(async (tx) => {
    const trade = await loadForChange(tx, accountId, tradeId);

    // Повтор того же запроса (ретрай, двойной тап) — отдаём как есть.
    if (body.id && trade.entries.some((e) => e.id === body.id)) {
      return { trade: tradeToDTO(trade), entries: trade.entries.map(entryToDTO) };
    }

    const direction = (trade.direction === -1 ? -1 : 1) as Direction;
    // Новый вход сам по себе тоже по правильную сторону от стопа: купить
    // ниже стопа в лонг — значит, позиция сразу на стопе.
    const own = validateStopDirection(body.price, body.stopLoss, direction);
    if (own) throw new EntryError(`Добор: ${own.toLowerCase()}`);

    const depositAtEntry = Number(trade.depositAtEntry);
    const add = entryForRisk(body.price, body.stopLoss, body.riskPct, depositAtEntry);
    const entries = [...asInput(trade.entries), add];
    const problem = validateEntriesAgainstStop(entries, body.stopLoss, direction);
    if (problem) throw new EntryError(problem);

    const position = positionFromEntries(entries, body.stopLoss, direction, depositAtEntry);
    await tx.tradeEntry.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        tradeId,
        price: body.price,
        size: add.size,
        riskPct: body.riskPct,
      },
    });
    const updated = await tx.trade.update({
      where: { id: tradeId },
      data: { stopLoss: body.stopLoss, ...position },
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });
    return { trade: tradeToDTO(updated), entries: updated.entries.map(entryToDTO) };
  });
}

/** Снять последний добор — если ошибся. Первый вход не снимается. */
export async function removeLastEntry(accountId: string, tradeId: string, entryId: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await loadForChange(tx, accountId, tradeId);
    const last = trade.entries[trade.entries.length - 1];
    if (trade.entries.length < 2 || !last || last.id !== entryId) {
      throw new EntryError("Снять можно только последний добор");
    }

    const direction = (trade.direction === -1 ? -1 : 1) as Direction;
    const stopLoss = Number(trade.stopLoss);
    const entries = asInput(trade.entries.slice(0, -1));
    const problem = validateEntriesAgainstStop(entries, stopLoss, direction);
    if (problem) {
      throw new EntryError(`Без этого добора стоп окажется не с той стороны: ${problem.toLowerCase()}`);
    }

    const position = positionFromEntries(entries, stopLoss, direction, Number(trade.depositAtEntry));
    await tx.tradeEntry.delete({ where: { id: entryId } });
    const updated = await tx.trade.update({
      where: { id: tradeId },
      data: position,
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });
    return { trade: tradeToDTO(updated), entries: updated.entries.map(entryToDTO) };
  });
}

/**
 * Объединить две открытые сделки в одну позицию: более поздняя становится
 * добором к более ранней. Как на бирже в одностороннем режиме — одна
 * позиция, средний вход, один стоп; стоп берётся у последней сделки.
 * Теги объединяются, заметки склеиваются, поздняя сделка удаляется.
 * Только та же пара и направление и только без фиксаций.
 */
export async function mergeTrades(accountId: string, ids: [string, string]) {
  if (ids[0] === ids[1]) throw new EntryError("Нужны две разные сделки");

  return prisma.$transaction(async (tx) => {
    const trades = await tx.trade.findMany({
      where: { id: { in: ids }, accountId },
      include: {
        entries: { orderBy: { createdAt: "asc" } },
        tags: { select: { tagId: true } },
        _count: { select: { fixes: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    if (trades.length !== 2) throw new EntryError("Сделка не найдена", 404);
    const [first, last] = trades;

    if (first.status !== "open" || last.status !== "open") {
      throw new EntryError("Объединять можно только открытые сделки");
    }
    if (first._count.fixes > 0 || last._count.fixes > 0) {
      throw new EntryError("По одной из сделок уже есть фиксации — объединить нельзя");
    }
    if (first.pair !== last.pair || first.direction !== last.direction) {
      throw new EntryError("Объединяются только сделки по одной паре и в одну сторону");
    }

    const direction = (first.direction === -1 ? -1 : 1) as Direction;
    const stopLoss = Number(last.stopLoss);
    const entries = asInput([...first.entries, ...last.entries]);
    const problem = validateEntriesAgainstStop(entries, stopLoss, direction);
    if (problem) throw new EntryError(`Со стопом последней сделки: ${problem.toLowerCase()}`);

    const position = positionFromEntries(
      entries,
      stopLoss,
      direction,
      Number(first.depositAtEntry),
    );
    const note = [first.note, last.note].filter((n) => n && n.trim()).join("\n\n");

    // Входы поздней сделки переезжают со своим временем — история добора видна.
    await tx.tradeEntry.updateMany({ where: { tradeId: last.id }, data: { tradeId: first.id } });
    await tx.tradeTag.createMany({
      data: last.tags.map((t) => ({ tradeId: first.id, tagId: t.tagId })),
      skipDuplicates: true,
    });
    await tx.trade.delete({ where: { id: last.id } });
    const updated = await tx.trade.update({
      where: { id: first.id },
      data: {
        stopLoss,
        ...position,
        note: note || null,
        tvLink: first.tvLink ?? last.tvLink,
      },
      include: {
        entries: { orderBy: { createdAt: "asc" } },
        tags: { select: { tagId: true }, orderBy: { createdAt: "asc" } },
      },
    });

    return {
      trade: tradeToDTO(updated),
      entries: updated.entries.map(entryToDTO),
      tagIds: updated.tags.map((t) => t.tagId),
      removedId: last.id,
    };
  });
}
