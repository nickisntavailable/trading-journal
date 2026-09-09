"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dateTime, money, price } from "@/lib/format";
import type { FixDTO } from "@/lib/serialize";

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function FixesPanel({
  tradeId,
  status,
  fixes,
  closedPct,
  positionSize,
}: {
  tradeId: string;
  status: "open" | "closed";
  fixes: FixDTO[];
  closedPct: number;
  positionSize: number;
}) {
  const router = useRouter();
  const [fixPrice, setFixPrice] = useState("");
  const [sizePct, setSizePct] = useState("");
  const [type, setType] = useState<"manual" | "stop">("manual");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const remainingPct = Math.max(0, 100 - closedPct);
  const lastFixId = fixes.length > 0 ? fixes[fixes.length - 1].id : null;

  // Быстрые доли: только те, что помещаются в остаток, без дублей.
  // Остаток вынесен отдельной кнопкой, иначе он повторял бы одну из долей.
  const remainder = Number(remainingPct.toFixed(2));
  const quickSizes = [25, 50, 75].filter((value) => value < remainder);

  async function addFix(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const response = await fetch(`/api/trades/${tradeId}/fixes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: Number(fixPrice),
        sizePct: Number(sizePct),
        type,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось добавить фиксацию");
      return;
    }

    setFixPrice("");
    setSizePct("");
    router.refresh();
  }

  async function removeFix(fixId: string) {
    setError(null);
    setPending(true);
    const response = await fetch(`/api/trades/${tradeId}/fixes/${fixId}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось удалить фиксацию");
      return;
    }
    router.refresh();
  }

  return (
    <section className="py-4">
      <h2 className="text-[13px] font-medium">Фиксации</h2>

      {fixes.length === 0 ? (
        <p className="mt-3 border-t border-rule pt-3 text-[13px] text-ink-soft">
          Фиксаций пока нет
        </p>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-[1fr_0.8fr_0.8fr_1fr_auto] gap-3 border-y border-rule py-1.5 text-[11px] text-ink-soft">
            <span>Дата</span>
            <span className="text-right">Цена</span>
            <span className="text-right">% позиции</span>
            <span className="text-right">Объём, $</span>
            <span className="w-12" />
          </div>
          {fixes.map((fix) => (
            <div
              key={fix.id}
              className="grid grid-cols-[1fr_0.8fr_0.8fr_1fr_auto] items-center gap-3 border-b border-rule py-2 text-[13px]"
            >
              <span className="num text-ink-soft">{dateTime(fix.createdAt)}</span>
              <span className="num text-right">{price(fix.price)}</span>
              <span className="num text-right">{fix.sizePct.toFixed(2)}%</span>
              <span className="num text-right">
                {money((positionSize * fix.sizePct) / 100)}
              </span>
              <span className="w-12 text-right">
                {status === "open" && fix.id === lastFixId ? (
                  <button
                    type="button"
                    onClick={() => removeFix(fix.id)}
                    disabled={pending}
                    className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-short disabled:opacity-40"
                  >
                    удалить
                  </button>
                ) : null}
              </span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-ink-soft">
            {fixes.length > 0 && status === "open"
              ? "Удалить можно только последнюю фиксацию; у закрытой сделки история неизменна."
              : null}
          </p>
        </div>
      )}

      {status === "open" ? (
        <form onSubmit={addFix} className="mt-4 max-w-[560px] border-t border-rule pt-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label htmlFor="fixPrice" className="block text-[11px] text-ink-soft">
                Цена
              </label>
              <input
                id="fixPrice"
                type="number"
                step="any"
                inputMode="decimal"
                value={fixPrice}
                onChange={(e) => setFixPrice(e.target.value)}
                className={inputClass + " mt-1"}
              />
            </div>

            <div>
              <label htmlFor="sizePct" className="block text-[11px] text-ink-soft">
                % позиции
              </label>
              <input
                id="sizePct"
                type="number"
                step="any"
                inputMode="decimal"
                max={remainingPct}
                value={sizePct}
                onChange={(e) => setSizePct(e.target.value)}
                className={inputClass + " mt-1"}
              />
            </div>

            <div>
              <span className="block text-[11px] text-ink-soft">Тип</span>
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setType("manual")}
                  className={
                    "rounded-[3px] border px-2 py-2 text-[12px] " +
                    (type === "manual"
                      ? "border-ink text-ink"
                      : "border-rule bg-white text-ink-soft")
                  }
                >
                  ручная
                </button>
                <button
                  type="button"
                  onClick={() => setType("stop")}
                  className={
                    "rounded-[3px] border px-2 py-2 text-[12px] " +
                    (type === "stop"
                      ? "border-ink text-ink"
                      : "border-rule bg-white text-ink-soft")
                  }
                >
                  стоп
                </button>
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending || !fixPrice || !sizePct}
                className="w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              >
                {pending ? "…" : "Добавить"}
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-[11px] text-ink-soft">
              осталось <span className="num">{remainingPct.toFixed(2)}%</span>
            </p>
            {quickSizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSizePct(String(value))}
                className="rounded-[3px] border border-rule bg-white px-2 py-0.5 text-[11px] hover:border-ink"
              >
                <span className="num">{value}%</span>
              </button>
            ))}
            {remainder > 0 && !quickSizes.includes(remainder) ? (
              <button
                type="button"
                onClick={() => setSizePct(String(remainder))}
                className="rounded-[3px] border border-rule bg-white px-2 py-0.5 text-[11px] hover:border-ink"
              >
                весь остаток
              </button>
            ) : null}
          </div>

          {error ? <p className="mt-3 text-[12px] text-short">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
