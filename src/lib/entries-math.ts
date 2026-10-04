import { positionSize, riskAmount, validateStopDirection, type Direction } from "@/lib/trading-math";

/**
 * Позиция из нескольких входов (добор). Так же, как на бирже в одностороннем
 * режиме: одна позиция, средний вход, один стоп.
 *
 * Средний вход — по количеству монет, а не по долларам: 0,1 BTC по 60 000 и
 * 0,1 BTC по 61 000 дают 60 500, хотя долларов во втором входе больше.
 * Количество хранить не нужно — это номинал / цена.
 *
 * Фиксации и итог сделки от этого не меняются: они считаются от среднего
 * входа и номинала, а прибыль от цены зависит линейно — сумма по входам
 * совпадает с расчётом по средней.
 */
export type EntryInput = { price: number; size: number };

export function quantityOf(entry: EntryInput): number {
  return entry.size / entry.price;
}

export function totalSize(entries: EntryInput[]): number {
  return entries.reduce((sum, e) => sum + e.size, 0);
}

export function averageEntry(entries: EntryInput[]): number {
  const qty = entries.reduce((sum, e) => sum + quantityOf(e), 0);
  return qty > 0 ? totalSize(entries) / qty : 0;
}

/**
 * Убыток всей позиции, если сработает стоп, без комиссий. Со знаком по
 * входам: если стоп выше входа лонга (60 200 при входах 60 000 и 61 000),
 * эта часть на стопе закрывается в плюс и уменьшает риск, а не добавляет.
 * Итог равен количество × (средний вход − стоп) в сторону сделки.
 */
export function positionRisk(
  entries: EntryInput[],
  stopLoss: number,
  direction: Direction,
): number {
  return entries.reduce((sum, e) => sum + direction * quantityOf(e) * (e.price - stopLoss), 0);
}

export type PositionNumbers = {
  entryPrice: number;
  positionSize: number;
  riskAmount: number;
  /** От депозита на момент первого входа — одна позиция меряется одним депозитом. */
  riskPct: number;
};

/** Поля сделки, производные от входов и стопа. */
export function positionFromEntries(
  entries: EntryInput[],
  stopLoss: number,
  direction: Direction,
  depositAtEntry: number,
): PositionNumbers {
  const risk = positionRisk(entries, stopLoss, direction);
  return {
    entryPrice: averageEntry(entries),
    positionSize: totalSize(entries),
    riskAmount: risk,
    riskPct: depositAtEntry > 0 ? (risk / depositAtEntry) * 100 : 0,
  };
}

/**
 * Новый вход заданным риском: размер считается от общего стопа, как и при
 * открытии сделки (riskPct от депозита на момент первого входа).
 */
export function entryForRisk(
  price: number,
  stopLoss: number,
  riskPct: number,
  depositAtEntry: number,
): EntryInput {
  return { price, size: positionSize(riskAmount(depositAtEntry, riskPct), price, stopLoss) };
}

/**
 * Стоп — по правильную сторону от среднего входа (у лонга ниже, у шорта
 * выше), как требует биржа. Относительно отдельных входов он может быть где
 * угодно: стоп на уровне первого входа после добора — обычное дело. Риск при
 * этом положительный, и R-мультипликатор считается.
 */
export function validateEntriesAgainstStop(
  entries: EntryInput[],
  stopLoss: number,
  direction: Direction,
): string | null {
  return validateStopDirection(averageEntry(entries), stopLoss, direction);
}
