import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
import { positionFromEntries, validateEntriesAgainstStop } from "@/lib/entries-math";
import { badRequest, handleError, notFound } from "@/lib/api";
import {
  positionSize,
  riskAmount,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const account = await getAccount();

    const trade = await prisma.trade.findFirst({
      where: { id, accountId: account.id },
      include: {
        fixes: { orderBy: { createdAt: "asc" } },
        tags: { select: { tagId: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!trade) return notFound("Сделка не найдена");

    return NextResponse.json({
      trade: tradeToDTO(trade),
      fixes: trade.fixes.map(fixToDTO),
      tagIds: trade.tags.map((t) => t.tagId),
    });
  } catch (error) {
    return handleError(error);
  }
}

// Правка параметров открытой сделки: исправление опечатки во входе/стопе.
// depositAtEntry и feeRateAtEntry остаются снапшотом момента открытия,
// а riskAmount и positionSize пересчитываются по новым значениям.
const patchSchema = z.object({
  pair: z.string().trim().min(1).max(32).optional(),
  direction: z.union([z.literal(1), z.literal(-1)]).optional(),
  entryPrice: z.number().finite().positive().optional(),
  stopLoss: z.number().finite().positive().optional(),
  riskPct: z.number().finite().gt(0).max(100).optional(),
  leverage: z.number().finite().gt(0).max(500).optional(),
  tvLink: z.string().trim().url().max(500).nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const account = await getAccount();

    const existing = await prisma.trade.findFirst({
      where: { id, accountId: account.id },
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });
    if (!existing) return notFound("Сделка не найдена");
    if (existing.status === "closed") {
      return badRequest("Сделка закрыта — параметры менять нельзя");
    }

    const common = {
      ...(body.pair !== undefined ? { pair: body.pair.toUpperCase() } : {}),
      ...(body.tvLink !== undefined ? { tvLink: body.tvLink || null } : {}),
      ...(body.leverage !== undefined ? { leverage: body.leverage } : {}),
    };

    // Несколько входов (добор) — это позиция как на бирже: при переносе стопа
    // количество монет не меняется, пересчитывается риск. Вход средний, и
    // непонятно, какой из входов правится, — поэтому цену входа, риск и
    // направление здесь не меняем.
    if (existing.entries.length > 1) {
      const changed = (next: number | undefined, current: unknown) =>
        next !== undefined && Math.abs(next - Number(current)) > 1e-9;
      if (
        changed(body.entryPrice, existing.entryPrice) ||
        changed(body.riskPct, existing.riskPct) ||
        (body.direction !== undefined && body.direction !== existing.direction)
      ) {
        return badRequest(
          "У сделки несколько входов: цену входа, риск и направление не правят — убери лишний добор и добери заново",
        );
      }

      const direction = (existing.direction === -1 ? -1 : 1) as Direction;
      const stopLoss = body.stopLoss ?? Number(existing.stopLoss);
      const entries = existing.entries.map((e) => ({ price: Number(e.price), size: Number(e.size) }));
      const stopError = validateEntriesAgainstStop(entries, stopLoss, direction);
      if (stopError) return badRequest(stopError);

      const position = positionFromEntries(
        entries,
        stopLoss,
        direction,
        Number(existing.depositAtEntry),
      );
      const trade = await prisma.trade.update({
        where: { id: existing.id },
        data: { ...common, stopLoss, ...position },
      });
      return NextResponse.json({ trade: tradeToDTO(trade) });
    }

    const entryPrice = body.entryPrice ?? Number(existing.entryPrice);
    const stopLoss = body.stopLoss ?? Number(existing.stopLoss);
    const riskPct = body.riskPct ?? Number(existing.riskPct);
    const direction = (body.direction ??
      (existing.direction === -1 ? -1 : 1)) as Direction;

    const stopError = validateStopDirection(entryPrice, stopLoss, direction);
    if (stopError) return badRequest(stopError);

    const depositAtEntry = Number(existing.depositAtEntry);
    const riskAmountValue = riskAmount(depositAtEntry, riskPct);
    const positionSizeValue = positionSize(riskAmountValue, entryPrice, stopLoss);

    // Один вход — правка как раньше (исправление опечатки): риск в процентах
    // сохраняется, размер пересчитывается. Вход обновляется в той же
    // транзакции, чтобы сделка и её вход не разошлись.
    const [trade] = await prisma.$transaction([
      prisma.trade.update({
        where: { id: existing.id },
        data: {
          ...common,
          direction,
          entryPrice,
          stopLoss,
          riskPct,
          riskAmount: riskAmountValue,
          positionSize: positionSizeValue,
        },
      }),
      prisma.tradeEntry.updateMany({
        where: { tradeId: existing.id },
        data: { price: entryPrice, size: positionSizeValue, riskPct },
      }),
    ]);

    return NextResponse.json({ trade: tradeToDTO(trade) });
  } catch (error) {
    return handleError(error);
  }
}
