import type { Account, BalanceEvent, Fix, Trade, TradeEntry } from "@prisma/client";
import { ORDER_TYPES, type Direction, type OrderType } from "@/lib/trading-math";

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
  riskLimitPct: number;
  makerFeePct: number;
  takerFeePct: number;
  defaultLeverage: number;
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
  makerFeePct: number;
  takerFeePct: number;
  /** Уже уплаченные комиссии входов, $. */
  entryFeeAmount: number;
  riskAmount: number;
  positionSize: number;
  leverage: number;
  tvLink: string | null;
  note: string | null;
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

/**
 * Как закрыта часть позиции. Один список на весь проект: валидация API,
 * DTO, форма и подписи берут его отсюда, чтобы новый тип не пришлось
 * дописывать в шести местах.
 */
export const FIX_TYPES = ["manual", "stop", "breakeven"] as const;
export type FixType = (typeof FIX_TYPES)[number];

export const FIX_TYPE_LABELS: Record<FixType, string> = {
  manual: "ручная",
  stop: "стоп",
  breakeven: "б/у",
};

function toFixType(value: string): FixType {
  return (FIX_TYPES as readonly string[]).includes(value) ? (value as FixType) : "manual";
}

export type FixDTO = {
  id: string;
  tradeId: string;
  price: number;
  sizePct: number;
  type: FixType;
  orderType: OrderType;
  createdAt: string;
};

export function toOrderType(value: string): OrderType {
  return (ORDER_TYPES as readonly string[]).includes(value) ? (value as OrderType) : "market";
}

/**
 * Тип заявки фиксации по умолчанию, как обычно на бирже: ручная фиксация —
 * тейк лимиткой, стоп и б/у — стоп-маркет. В форме переключается.
 */
export const DEFAULT_FIX_ORDER_TYPE: Record<FixType, OrderType> = {
  manual: "limit",
  stop: "market",
  breakeven: "market",
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
    riskLimitPct: n(a.riskLimitPct),
    makerFeePct: n(a.makerFeePct),
    takerFeePct: n(a.takerFeePct),
    defaultLeverage: n(a.defaultLeverage),
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
    makerFeePct: n(t.makerFeePct),
    takerFeePct: n(t.takerFeePct),
    entryFeeAmount: n(t.entryFeeAmount),
    riskAmount: n(t.riskAmount),
    positionSize: n(t.positionSize),
    leverage: n(t.leverage),
    tvLink: t.tvLink,
    note: t.note,
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
    type: toFixType(f.type),
    orderType: toOrderType(f.orderType),
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

export type EntryDTO = {
  id: string;
  price: number;
  /** Номинал входа, $. Количество монет = size / price. */
  size: number;
  riskPct: number;
  orderType: OrderType;
  /** Ставка комиссии этого входа, %. */
  feePct: number;
  createdAt: string;
};

export function entryToDTO(e: TradeEntry): EntryDTO {
  return {
    id: e.id,
    price: n(e.price),
    size: n(e.size),
    riskPct: n(e.riskPct),
    orderType: toOrderType(e.orderType),
    feePct: n(e.feePct),
    createdAt: e.createdAt.toISOString(),
  };
}
