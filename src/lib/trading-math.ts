// Единственный источник правды по расчётам сделки.
// Импортируется и клиентской формой (live-превью), и серверными хендлерами —
// логика не дублируется.

export type Direction = 1 | -1;

export type FixInput = {
  price: number;
  sizePct: number;
};

export type TradeMathInput = {
  entryPrice: number;
  stopLoss: number;
  direction: Direction;
  positionSize: number;
  depositAtEntry: number;
  feeRateAtEntry: number;
  /** Планируемый убыток при срабатывании стопа — знаменатель R-мультипликатора. */
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

export function positionSize(
  riskAmountValue: number,
  entryPrice: number,
  stopLoss: number,
): number {
  return (riskAmountValue * entryPrice) / Math.abs(entryPrice - stopLoss);
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

export function fixExitFee(
  positionSizeValue: number,
  fixSizePct: number,
  feeRatePct: number,
): number {
  const notional = (positionSizeValue * fixSizePct) / 100;
  return (notional * feeRatePct) / 100;
}

export function entryFee(positionSizeValue: number, feeRatePct: number): number {
  return (positionSizeValue * feeRatePct) / 100;
}

const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

/** Вызывается, когда сумма sizePct всех фиксаций достигла 100. */
export function closeTrade(trade: TradeMathInput, fixes: FixInput[]): CloseResult {
  const grossPnL = sum(
    fixes.map((f) =>
      fixGrossPnL(
        trade.positionSize,
        f.sizePct,
        f.price,
        trade.entryPrice,
        trade.direction,
      ),
    ),
  );

  const totalFees =
    entryFee(trade.positionSize, trade.feeRateAtEntry) +
    sum(
      fixes.map((f) =>
        fixExitFee(trade.positionSize, f.sizePct, trade.feeRateAtEntry),
      ),
    );

  const netPnL = grossPnL - totalFees;
  const netPnlPctOfDeposit = (netPnL / trade.depositAtEntry) * 100;

  const realizedAvgExit = sum(fixes.map((f) => f.price * f.sizePct)) / 100;

  // Знаковый R-мультипликатор: сколько запланированных рисков реально принесла
  // сделка. Формула раздела 4 ТЗ брала модуль хода цены, из-за чего убыточная
  // сделка получала положительный R:R и портила статистику в истории.
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
