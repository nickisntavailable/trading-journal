import { money, pct } from "@/lib/format";

/**
 * Сколько депозита реально занято маржой открытых позиций. Это ответ на
 * «сколько денег в сделках», тогда как бюджет риска выше — на «сколько могу
 * потерять». Цвет нейтральный: маржа сама по себе не опасна; жёлтая зона —
 * только когда она приближается к балансу, то есть новые сделки уже не откроются.
 */
export function MarginMeter({ used, balance }: { used: number; balance: number }) {
  const ratio = balance > 0 ? used / balance : 0;
  const clamped = Math.min(ratio, 1);
  const tight = ratio > 0.8;

  return (
    <section className="border-b border-rule py-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[11px] text-ink-soft">Маржа в сделках</h2>
        <p className="text-[12px] text-ink-soft">
          <span className="num text-ink">{money(used)}</span> из{" "}
          <span className="num">{money(balance)}</span>
          {balance > 0 ? (
            <>
              {" · "}
              <span className="num">{pct(ratio * 100)}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-[2px] bg-white ring-1 ring-rule ring-inset">
        <div
          className="h-full"
          style={{
            width: `${clamped * 100}%`,
            background: tight ? "var(--amber)" : "var(--ink-soft)",
          }}
        />
      </div>
    </section>
  );
}
