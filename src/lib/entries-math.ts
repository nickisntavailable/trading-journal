import {
  positionSizeWithFees,
  riskAmount,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

/**
 * Позиция из нескольких входов (добор). Так же, как на бирже в одностороннем
 * режиме: одна позиция, средний вход, один стоп.
 *
 * Средний вход — по количеству монет, а не по долларам: 0,1 BTC по 60 000 и
 * 0,1 BTC по 61 000 дают 60 500, хотя долларов во втором входе больше.
 * Количество хранить не нужно — это номинал / цена.
 *
 * Риск — вместе с комиссиями: каждого входа (по его ставке — лимитка или
 * рынок) и выхода по стопу (рынок, taker). Так на стопе уходит ровно риск, а
 * выбитая сделка в статистике — ровно −1R.
 */
export type EntryInput = {
  price: number;
  size: number;
  /** Ставка комиссии этого входа, %. */
  feePct: number;
};

export function quantityOf(entry: Pick<EntryInput, "price" | "size">): number {
  return entry.size / entry.price;
}

export function totalSize(entries: Pick<EntryInput, "size">[]): number {
  return entries.reduce((sum, e) => sum + e.size, 0);
}

export function averageEntry(entries: Pick<EntryInput, "price" | "size">[]): number {
  const qty = entries.reduce((sum, e) => sum + quantityOf(e), 0);
  return qty > 0 ? totalSize(entries) / qty : 0;
}

/** Комиссии входов, $ — по ставке каждого входа. */
export function entryFees(entries: EntryInput[]): number {
  return entries.reduce((sum, e) => sum + (e.size * e.feePct) / 100, 0);
}

/**
 * Убыток всей позиции, если сработает стоп, вместе с комиссиями.
 *
 * Ценовая часть — со знаком по входам: если стоп выше входа лонга (60 200
 * при входах 60 000 и 61 000), эта часть на стопе закрывается в плюс и
 * уменьшает риск. Итог ценовой части = количество × (средний вход − стоп) в
 * сторону сделки. Плюс комиссии входов и выхода всего количества по стопу.
 */
export function positionRisk(
  entries: EntryInput[],
  stopLoss: number,
  direction: Direction,
  exitFeePct: number,
): number {
  const priceRisk = entries.reduce(
    (sum, e) => sum + direction * quantityOf(e) * (e.price - stopLoss),
    0,
  );
  const qty = entries.reduce((sum, e) => sum + quantityOf(e), 0);
  return priceRisk + entryFees(entries) + (qty * stopLoss * exitFeePct) / 100;
}

export type PositionNumbers = {
  entryPrice: number;
  positionSize: number;
  riskAmount: number;
  /** От депозита на момент первого входа — одна позиция меряется одним депозитом. */
  riskPct: number;
  entryFeeAmount: number;
};

/** Поля сделки, производные от входов и стопа. */
export function positionFromEntries(
  entries: EntryInput[],
  stopLoss: number,
  direction: Direction,
  depositAtEntry: number,
  exitFeePct: number,
): PositionNumbers {
  const risk = positionRisk(entries, stopLoss, direction, exitFeePct);
  return {
    entryPrice: averageEntry(entries),
    positionSize: totalSize(entries),
    riskAmount: risk,
    riskPct: depositAtEntry > 0 ? (risk / depositAtEntry) * 100 : 0,
    entryFeeAmount: entryFees(entries),
  };
}

/**
 * Новый вход заданным риском: размер — от общего стопа и с комиссиями, как
 * при открытии сделки (riskPct от депозита на момент первого входа).
 */
export function entryForRisk(
  price: number,
  stopLoss: number,
  riskPct: number,
  depositAtEntry: number,
  entryFeePct: number,
  exitFeePct: number,
): EntryInput {
  const size = positionSizeWithFees(
    riskAmount(depositAtEntry, riskPct),
    price,
    stopLoss,
    entryFeePct,
    exitFeePct,
  );
  return { price, size, feePct: entryFeePct };
}

/**
 * Стоп — по правильную сторону от среднего входа (у лонга ниже, у шорта
 * выше), как требует биржа. Относительно отдельных входов он может быть где
 * угодно: стоп на уровне первого входа после добора — обычное дело.
 */
export function validateEntriesAgainstStop(
  entries: Pick<EntryInput, "price" | "size">[],
  stopLoss: number,
  direction: Direction,
): string | null {
  return validateStopDirection(averageEntry(entries), stopLoss, direction);
}
