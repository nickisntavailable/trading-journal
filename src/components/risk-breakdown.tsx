import { money } from "@/lib/format";
import { FEES_SHARE_WARNING } from "@/lib/trading-math";

/**
 * Из чего состоит потеря на стопе: движение цены и комиссии. Если комиссии —
 * заметная доля риска, предупреждаем: вход не блокируется, но видно, что
 * стоп слишком близко и сделка в основном кормит биржу.
 */
export function RiskBreakdown({
  price,
  fees,
  total,
}: {
  price: number;
  fees: number;
  total: number;
}) {
  const share = total > 0 ? fees / total : 0;
  const percent = Math.round(share * 100);
  return (
    <div className="mt-2 text-[11px]">
      <p className="text-ink-soft">
        На стопе уйдёт <span className="num text-ink">{money(total)}</span> ={" "}
        <span className="num">{money(price)}</span> движение цены +{" "}
        <span className="num">{money(fees)}</span> комиссии ({percent}%)
      </p>
      {share >= FEES_SHARE_WARNING ? (
        <p className="mt-1 text-amber">
          Стоп близко: {percent}% риска уходит на комиссию. Позиция уменьшена, чтобы риск
          остался прежним, но цена до стопа покрывает только {100 - percent}% риска.
        </p>
      ) : null}
    </div>
  );
}
