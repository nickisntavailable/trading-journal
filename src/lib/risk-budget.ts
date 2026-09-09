/**
 * Бюджет риска: сколько денег «занято» открытыми позициями относительно лимита.
 * Лимит задаётся полем Account.riskLimitPct — потолок суммарного риска
 * открытых позиций в процентах от текущего баланса.
 */

/** Доля лимита, после которой бар уходит в предупредительную (жёлтую) зону. */
export const RISK_WARNING_RATIO = 2 / 3;

export type RiskBudget = {
  usedAmount: number;
  limitAmount: number;
  /** Доля использования лимита, 0..1+ (может быть больше 1 при перегрузе). */
  ratio: number;
  zone: "ok" | "warning";
};

export function riskBudget(
  balance: number,
  riskLimitPct: number,
  usedAmount: number,
): RiskBudget {
  const limitAmount = (balance * riskLimitPct) / 100;
  const ratio = limitAmount > 0 ? usedAmount / limitAmount : 0;
  return {
    usedAmount,
    limitAmount,
    ratio,
    zone: ratio > RISK_WARNING_RATIO ? "warning" : "ok",
  };
}
