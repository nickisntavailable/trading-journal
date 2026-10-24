/**
 * Ставки бессрочных фьючерсов для обычного уровня (2026), % от номинала.
 * Точная ставка аккаунта зависит от VIP-уровня и скидок (у Binance −10% при
 * оплате в BNB) — поля в настройках правятся вручную.
 */
export const FEE_PRESETS = [
  { id: "binance", label: "Binance", makerFeePct: 0.02, takerFeePct: 0.05 },
  { id: "bybit", label: "Bybit", makerFeePct: 0.02, takerFeePct: 0.055 },
  { id: "okx", label: "OKX", makerFeePct: 0.02, takerFeePct: 0.05 },
  { id: "bitget", label: "Bitget", makerFeePct: 0.02, takerFeePct: 0.06 },
] as const;

/** Какому набору соответствуют ставки; null — свои. */
export function matchPreset(makerFeePct: number, takerFeePct: number) {
  return (
    FEE_PRESETS.find(
      (p) =>
        Math.abs(p.makerFeePct - makerFeePct) < 1e-9 &&
        Math.abs(p.takerFeePct - takerFeePct) < 1e-9,
    ) ?? null
  );
}
