import type { Account, BalanceEvent, Fix, Trade } from "@prisma/client";
import type { Direction } from "@/lib/trading-math";

/**
 * Prisma отдаёт Decimal-объекты, которые нельзя передать из server-компонента
 * в client-компонент. Здесь единая точка перевода в примитивы.
 */

const n = (v: unknown) => Number(v as never);
const nn = (v: unknown) => (v === null || v === undefined ? null : Number(v as never));

export type AccountDTO = {
  id: string;
  balance: number;
  baseRiskPct: number;
  feeRatePct: number;
};

export type TradeDTO = {
  id: string;
  accountId: string;
  pair: string;
  direction: Direction;
  entryPrice: number;
  stopLoss: number;
  riskPct: number;
  depositAtEntry: number;
  feeRateAtEntry: number;
  riskAmount: number;
  positionSize: number;
  tvLink: string | null;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  grossPnL: number | null;
  totalFees: number | null;
  netPnL: number | null;
  netPnlPctOfDeposit: number | null;
  realizedAvgExit: number | null;
  realizedRR: number | null;
};

export type FixDTO = {
  id: string;
  tradeId: string;
  price: number;
  sizePct: number;
  type: "manual" | "stop";
  createdAt: string;
};

export type BalanceEventDTO = {
  id: string;
  type: string;
  amount: number;
  relatedTradeId: string | null;
  note: string | null;
  createdAt: string;
};

export function accountToDTO(a: Account): AccountDTO {
  return {
    id: a.id,
    balance: n(a.balance),
    baseRiskPct: n(a.baseRiskPct),
    feeRatePct: n(a.feeRatePct),
  };
}

export function tradeToDTO(t: Trade): TradeDTO {
  return {
    id: t.id,
    accountId: t.accountId,
    pair: t.pair,
    direction: (t.direction === -1 ? -1 : 1) as Direction,
    entryPrice: n(t.entryPrice),
    stopLoss: n(t.stopLoss),
    riskPct: n(t.riskPct),
    depositAtEntry: n(t.depositAtEntry),
    feeRateAtEntry: n(t.feeRateAtEntry),
    riskAmount: n(t.riskAmount),
    positionSize: n(t.positionSize),
    tvLink: t.tvLink,
    status: t.status === "closed" ? "closed" : "open",
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
    grossPnL: nn(t.grossPnL),
    totalFees: nn(t.totalFees),
    netPnL: nn(t.netPnL),
    netPnlPctOfDeposit: nn(t.netPnlPctOfDeposit),
    realizedAvgExit: nn(t.realizedAvgExit),
    realizedRR: nn(t.realizedRR),
  };
}

export function fixToDTO(f: Fix): FixDTO {
  return {
    id: f.id,
    tradeId: f.tradeId,
    price: n(f.price),
    sizePct: n(f.sizePct),
    type: f.type === "stop" ? "stop" : "manual",
    createdAt: f.createdAt.toISOString(),
  };
}

export function balanceEventToDTO(e: BalanceEvent): BalanceEventDTO {
  return {
    id: e.id,
    type: e.type,
    amount: n(e.amount),
    relatedTradeId: e.relatedTradeId,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
  };
}
