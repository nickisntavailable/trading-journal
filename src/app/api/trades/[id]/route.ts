import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
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
      include: { fixes: { orderBy: { createdAt: "asc" } } },
    });
    if (!trade) return notFound("Сделка не найдена");

    return NextResponse.json({
      trade: tradeToDTO(trade),
      fixes: trade.fixes.map(fixToDTO),
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
    });
    if (!existing) return notFound("Сделка не найдена");
    if (existing.status === "closed") {
      return badRequest("Сделка закрыта — параметры менять нельзя");
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

    const trade = await prisma.trade.update({
      where: { id: existing.id },
      data: {
        ...(body.pair !== undefined ? { pair: body.pair.toUpperCase() } : {}),
        ...(body.tvLink !== undefined ? { tvLink: body.tvLink || null } : {}),
        ...(body.leverage !== undefined ? { leverage: body.leverage } : {}),
        direction,
        entryPrice,
        stopLoss,
        riskPct,
        riskAmount: riskAmountValue,
        positionSize: positionSizeValue,
      },
    });

    return NextResponse.json({ trade: tradeToDTO(trade) });
  } catch (error) {
    return handleError(error);
  }
}
