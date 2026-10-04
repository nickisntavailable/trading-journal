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
