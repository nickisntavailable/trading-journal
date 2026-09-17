import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { tradeToDTO } from "@/lib/serialize";
import { badRequest, handleError } from "@/lib/api";
import {
  positionSize,
  riskAmount,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

const querySchema = z.object({
  status: z.enum(["open", "closed"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { status, cursor, limit } = querySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const account = await getAccount();

    const rows = await prisma.trade.findMany({
      where: { accountId: account.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      trades: page.map(tradeToDTO),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  id: z.string().uuid().optional(),
  pair: z.string().trim().min(1).max(32),
  direction: z.union([z.literal(1), z.literal(-1)]),
  entryPrice: z.number().finite().positive(),
  stopLoss: z.number().finite().positive(),
  riskPct: z.number().finite().gt(0).max(100),
  leverage: z.number().finite().gt(0).max(500).optional(),
  tvLink: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const direction = body.direction as Direction;

    const stopError = validateStopDirection(body.entryPrice, body.stopLoss, direction);
    if (stopError) return badRequest(stopError);

    const account = await getAccount();

    // Идемпотентность: повтор с тем же клиентским id возвращает уже созданную.
    if (body.id) {
      const existing = await prisma.trade.findFirst({
        where: { id: body.id, accountId: account.id },
      });
      if (existing) return NextResponse.json({ trade: tradeToDTO(existing) });
    }

    const depositAtEntry = Number(account.balance);
    const feeRateAtEntry = Number(account.feeRatePct);

    if (depositAtEntry <= 0) {
      return badRequest(
        "Баланс аккаунта равен нулю — пополни депозит в настройках перед открытием сделки",
      );
    }

    const riskAmountValue = riskAmount(depositAtEntry, body.riskPct);
    const positionSizeValue = positionSize(
      riskAmountValue,
      body.entryPrice,
      body.stopLoss,
    );
    const leverage = body.leverage ?? Number(account.defaultLeverage);

    const trade = await prisma.trade.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        accountId: account.id,
        pair: body.pair.toUpperCase(),
        direction,
        entryPrice: body.entryPrice,
        stopLoss: body.stopLoss,
        riskPct: body.riskPct,
        depositAtEntry,
        feeRateAtEntry,
        riskAmount: riskAmountValue,
        positionSize: positionSizeValue,
        leverage,
        tvLink: body.tvLink ? body.tvLink : null,
        status: "open",
      },
    });

    return NextResponse.json({ trade: tradeToDTO(trade) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
