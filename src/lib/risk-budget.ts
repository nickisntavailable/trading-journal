/**
 * Бюджет риска: сколько денег «занято» открытыми позициями относительно лимита.
 *
 * В схеме ТЗ нет отдельного поля лимита, поэтому он выводится из базового риска:
 * одновременно в рынке допускается не более RISK_BUDGET_MULTIPLIER базовых рисков.
 * Если понадобится настраиваемый лимит — это поле в Account и форма в /settings.
 */
export const RISK_BUDGET_MULTIPLIER = 3;

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
  baseRiskPct: number,
  usedAmount: number,
): RiskBudget {
  const limitAmount = (balance * baseRiskPct * RISK_BUDGET_MULTIPLIER) / 100;
  const ratio = limitAmount > 0 ? usedAmount / limitAmount : 0;
  return {
    usedAmount,
    limitAmount,
    ratio,
    zone: ratio > RISK_WARNING_RATIO ? "warning" : "ok",
  };
}
