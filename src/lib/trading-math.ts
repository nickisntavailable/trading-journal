// Единственный источник правды по расчётам сделки.
// Импортируется и клиентской формой (live-превью), и серверными хендлерами —
// логика не дублируется.

export type Direction = 1 | -1;

/**
 * Тип заявки определяет комиссию, как на бирже: лимитная — maker (дешевле),
 * рыночная — taker. Стоп исполняется рынком, поэтому риск до стопа всегда
 * считается по taker.
 */
export const ORDER_TYPES = ["market", "limit"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  market: "рынок",
  limit: "лимит",
};

export type FeeRates = {
  /** %, напр. 0.02 = 0,02% от номинала. */
  makerFeePct: number;
  takerFeePct: number;
};

export function feePctFor(rates: FeeRates, orderType: OrderType): number {
  return orderType === "limit" ? rates.makerFeePct : rates.takerFeePct;
}

export type FixInput = {
  price: number;
  sizePct: number;
  /** Нет — рынок (старые фиксации). */
  orderType?: OrderType;
};

export type TradeMathInput = FeeRates & {
  entryPrice: number;
  stopLoss: number;
  direction: Direction;
  positionSize: number;
  depositAtEntry: number;
  /** Уже уплаченные комиссии входов, $. */
  entryFeeAmount: number;
  /** Планируемый убыток при срабатывании стопа вместе с комиссиями — знаменатель R. */
  riskAmount: number;
};

export type CloseResult = {
  grossPnL: number;
  totalFees: number;
  netPnL: number;
  netPnlPctOfDeposit: number;
  realizedAvgExit: number;
  realizedRR: number;
};

export function riskAmount(depositAtEntry: number, riskPct: number): number {
  return (depositAtEntry * riskPct) / 100;
}

export function stopDistancePct(entryPrice: number, stopLoss: number): number {
  return (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
}

/**
 * Номинал без учёта комиссий: на стопе уходит ровно риск только по цене.
 * Так считались сделки до учёта комиссий в риске; нужен импорту истории.
 */
export function positionSize(
  riskAmountValue: number,
  entryPrice: number,
  stopLoss: number,
): number {
  return (riskAmountValue * entryPrice) / Math.abs(entryPrice - stopLoss);
}

/**
 * Номинал, при котором на стопе вместе с комиссиями уходит ровно риск.
 *
 * Убыток на стопе = номинал × (d + fвх + fвых × стоп/вход), где d —
 * расстояние до стопа в долях входа, fвх — комиссия входа, fвых — комиссия
 * выхода по стопу (taker). Выход берётся с номинала по цене стопа: биржа
 * считает комиссию от суммы сделки на выходе, а не на входе.
 */
export function positionSizeWithFees(
  riskAmountValue: number,
  entryPrice: number,
  stopLoss: number,
  entryFeePct: number,
  exitFeePct: number,
): number {
  const distance = Math.abs(entryPrice - stopLoss) / entryPrice;
  const fees = entryFeePct / 100 + (exitFeePct / 100) * (stopLoss / entryPrice);
  return riskAmountValue / (distance + fees);
}

/** Из чего состоит потеря на стопе: движение цены и комиссии входа и выхода. */
export function stopLossBreakdown(
  size: number,
  entryPrice: number,
  stopLoss: number,
  entryFeePct: number,
  exitFeePct: number,
): { price: number; fees: number; total: number; feesShare: number } {
  const price = (size * Math.abs(entryPrice - stopLoss)) / entryPrice;
  const fees =
    (size * entryFeePct) / 100 + (size * (stopLoss / entryPrice) * exitFeePct) / 100;
  const total = price + fees;
  return { price, fees, total, feesShare: total > 0 ? fees / total : 0 };
}

/** Порог, после которого форма предупреждает: заметная доля риска — комиссии. */
export const FEES_SHARE_WARNING = 0.25;

/**
 * Маржа — та часть депозита, что реально уходит в сделку на бирже.
 * На риск не влияет: убыток при стопе считается от номинала.
 */
export function margin(positionSizeValue: number, leverage: number): number {
  return leverage > 0 ? positionSizeValue / leverage : positionSizeValue;
}

export function fixGrossPnL(
  positionSizeValue: number,
  fixSizePct: number,
  fixPrice: number,
  entryPrice: number,
  direction: Direction,
): number {
  const notional = (positionSizeValue * fixSizePct) / 100;
  return (direction * notional * (fixPrice - entryPrice)) / entryPrice;
}

/** Комиссия выхода — с номинала по цене выхода и по ставке типа заявки. */
export function fixExitFee(
  trade: Pick<TradeMathInput, "positionSize" | "entryPrice" | "makerFeePct" | "takerFeePct">,
  fix: FixInput,
): number {
  const exitNotional =
    ((trade.positionSize * fix.sizePct) / 100) * (fix.price / trade.entryPrice);
  return (exitNotional * feePctFor(trade, fix.orderType ?? "market")) / 100;
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

type FixTrade = Pick<
  TradeMathInput,
  "entryPrice" | "direction" | "positionSize" | "entryFeeAmount" | "makerFeePct" | "takerFeePct"
>;

/**
 * Чистый результат одной фиксации: её gross минус комиссия выхода минус
 * пропорциональная доля комиссии входа. Сумма по всем фиксациям при 100%
 * совпадает с netPnL из closeTrade.
 */
export function fixNetPnL(trade: FixTrade, fix: FixInput): number {
  const gross = fixGrossPnL(
    trade.positionSize,
    fix.sizePct,
    fix.price,
    trade.entryPrice,
    trade.direction,
  );
  const entryFeeShare = (trade.entryFeeAmount * fix.sizePct) / 100;
  return gross - fixExitFee(trade, fix) - entryFeeShare;
}

/**
 * Что уже зафиксировано по открытой сделке. Незакрытая часть позиции сюда не
 * входит: без рыночной цены её результат неизвестен.
 */
export function realizedSoFar(
  trade: FixTrade & Pick<TradeMathInput, "riskAmount">,
  fixes: FixInput[],
): { netPnL: number; rMultiple: number; closedPct: number } {
  const netPnL = sum(fixes.map((fix) => fixNetPnL(trade, fix)));
  return {
    netPnL,
    rMultiple: trade.riskAmount !== 0 ? netPnL / trade.riskAmount : 0,
    closedPct: sum(fixes.map((fix) => fix.sizePct)),
  };
}

/** Вызывается, когда сумма sizePct всех фиксаций достигла 100. */
export function closeTrade(trade: TradeMathInput, fixes: FixInput[]): CloseResult {
  const grossPnL = sum(
    fixes.map((f) =>
      fixGrossPnL(trade.positionSize, f.sizePct, f.price, trade.entryPrice, trade.direction),
    ),
  );

  const totalFees = trade.entryFeeAmount + sum(fixes.map((f) => fixExitFee(trade, f)));

  const netPnL = grossPnL - totalFees;
  const netPnlPctOfDeposit = (netPnL / trade.depositAtEntry) * 100;

  const realizedAvgExit = sum(fixes.map((f) => f.price * f.sizePct)) / 100;

  // Знаковый R-мультипликатор: сколько запланированных рисков реально принесла
  // сделка. Риск включает комиссии, поэтому выбитая по стопу сделка — ровно −1R.
  const realizedRR = trade.riskAmount !== 0 ? netPnL / trade.riskAmount : 0;

  return {
    grossPnL,
    totalFees,
    netPnL,
    netPnlPctOfDeposit,
    realizedAvgExit,
    realizedRR,
  };
}

/**
 * Стоп должен стоять по нужную сторону от входа: для long — ниже, для short — выше.
 * Возвращает текст ошибки или null.
 */
export function validateStopDirection(
  entryPrice: number,
  stopLoss: number,
  direction: Direction,
): string | null {
  if (entryPrice === stopLoss) {
    return "Стоп-лосс не может совпадать с ценой входа";
  }
  if (direction === 1 && stopLoss >= entryPrice) {
    return "Для long стоп-лосс должен быть ниже цены входа";
  }
  if (direction === -1 && stopLoss <= entryPrice) {
    return "Для short стоп-лосс должен быть выше цены входа";
  }
  return null;
}
