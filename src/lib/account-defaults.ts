/**
 * Параметры нового торгового счёта — те же, что у сида. Нужны владельцу на
 * пустой базе и каждому приглашённому.
 */
export const ACCOUNT_DEFAULTS = {
  balance: "0",
  baseRiskPct: "1.00",
  riskLimitPct: "3.00",
  defaultLeverage: "5",
  makerFeePct: "0.0200",
  takerFeePct: "0.0500",
} as const;
