import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
import { handleError, notFound } from "@/lib/api";
import { closeTrade, type Direction } from "@/lib/trading-math";

const bodySchema = z.object({
  price: z.number().finite().positive(),
  sizePct: z.number().finite().gt(0).max(100),
  type: z.enum(["manual", "stop"]),
});

// Decimal(5,2): сравниваем с допуском в половину младшего разряда.
const EPS = 0.005;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const account = await getAccount();

    const result = await prisma.$transaction(async (tx) => {
      const trade = await tx.trade.findFirst({
        where: { id, accountId: account.id },
        include: { fixes: true },
      });
      if (!trade) throw new ApiError("Сделка не найдена", 404);
      if (trade.status === "closed") {
        throw new ApiError("Сделка уже закрыта — фиксации не добавляются", 400);
      }

      const existingPct = trade.fixes.reduce((acc, f) => acc + Number(f.sizePct), 0);
      const totalPct = existingPct + body.sizePct;
      if (totalPct > 100 + EPS) {
        throw new ApiError(
          `Суммарный объём фиксаций не может превышать 100%: уже зафиксировано ${existingPct.toFixed(2)}%, остаток ${(100 - existingPct).toFixed(2)}%`,
          400,
        );
      }

      const fix = await tx.fix.create({
        data: {
          tradeId: trade.id,
          price: body.price,
          sizePct: body.sizePct,
          type: body.type,
        },
      });

      // Позиция закрыта не полностью — сделка остаётся открытой.
      if (totalPct < 100 - EPS) {
        return { trade, fix, closed: false as const };
      }

      const allFixes = [...trade.fixes, fix].map((f) => ({
        price: Number(f.price),
        sizePct: Number(f.sizePct),
      }));

      const closed = closeTrade(
        {
          entryPrice: Number(trade.entryPrice),
          stopLoss: Number(trade.stopLoss),
          direction: (trade.direction === -1 ? -1 : 1) as Direction,
          positionSize: Number(trade.positionSize),
          depositAtEntry: Number(trade.depositAtEntry),
          feeRateAtEntry: Number(trade.feeRateAtEntry),
          riskAmount: Number(trade.riskAmount),
        },
        allFixes,
      );

      const updatedTrade = await tx.trade.update({
        where: { id: trade.id },
        data: {
          status: "closed",
          closedAt: new Date(),
          grossPnL: closed.grossPnL,
          totalFees: closed.totalFees,
          netPnL: closed.netPnL,
          netPnlPctOfDeposit: closed.netPnlPctOfDeposit,
          realizedAvgExit: closed.realizedAvgExit,
          realizedRR: closed.realizedRR,
        },
      });

      await tx.balanceEvent.create({
        data: {
          accountId: account.id,
          type: "trade_settlement",
          amount: closed.netPnL,
          relatedTradeId: trade.id,
          note: `${trade.pair} ${trade.direction === 1 ? "long" : "short"}`,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        // increment принимает число: netPnL уже округлится до Decimal(18,2) в колонке
        data: { balance: { increment: closed.netPnL } },
      });

      return { trade: updatedTrade, fix, closed: true as const };
    });

    return NextResponse.json(
      {
        fix: fixToDTO(result.fix),
        trade: tradeToDTO(result.trade),
        closed: result.closed,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 404
        ? notFound(error.message)
        : NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
