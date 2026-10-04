"use client";

import { useMemo, useState } from "react";
import {
  entryForRisk,
  positionFromEntries,
  quantityOf,
  validateEntriesAgainstStop,
} from "@/lib/entries-math";
import { dateTime, money, pct, price } from "@/lib/format";
import { useAddEntry, useRemoveEntry } from "@/lib/query/entries";
import type { EntryDTO, TradeDTO } from "@/lib/serialize";
import { validateStopDirection } from "@/lib/trading-math";

const inputClass =
  "num h-10 w-full rounded-[3px] border border-rule bg-white px-2.5 text-[14px] outline-none focus:border-ink";

const qtyFormat = new Intl.NumberFormat("ru-RU", { maximumSignificantDigits: 4 });

/**
 * Входы сделки и добор. Список виден, когда входов больше одного; добирать
 * и снимать добор можно, пока сделка открыта и по ней нет фиксаций.
 */
export function EntriesPanel({
  trade,
  entries,
  canChange,
  defaultRiskPct,
}: {
  trade: TradeDTO;
  entries: EntryDTO[];
  canChange: boolean;
  defaultRiskPct: number;
}) {
  const add = useAddEntry(trade.id);
  const remove = useRemoveEntry(trade.id);
  const [open, setOpen] = useState(false);
  const [addPrice, setAddPrice] = useState("");
  const [riskPct, setRiskPct] = useState(String(defaultRiskPct));
  const [stopLoss, setStopLoss] = useState(String(trade.stopLoss));
  const [formError, setFormError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const p = Number(addPrice);
    const r = Number(riskPct);
    const s = Number(stopLoss);
    if (!addPrice || ![p, r, s].every((v) => Number.isFinite(v) && v > 0)) return null;
    const own = validateStopDirection(p, s, trade.direction);
    if (own) return { error: `Добор: ${own.toLowerCase()}` };
    const next = [...entries, entryForRisk(p, s, r, trade.depositAtEntry)];
    const problem = validateEntriesAgainstStop(next, s, trade.direction);
    if (problem) return { error: problem };
    return { position: positionFromEntries(next, s, trade.direction, trade.depositAtEntry) };
  }, [addPrice, riskPct, stopLoss, entries, trade.direction, trade.depositAtEntry]);

  if (entries.length < 2 && !canChange) return null;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!preview || preview.error) {
      setFormError(preview?.error ?? "Заполни цену, риск и стоп");
      return;
    }
    add.mutate({
      id: crypto.randomUUID(),
      price: Number(addPrice),
      riskPct: Number(riskPct),
      stopLoss: Number(stopLoss),
    });
    setAddPrice("");
    setOpen(false);
  }

  const last = entries[entries.length - 1];
  const mutationError = add.error ?? remove.error;

  return (
    <section className="border-b border-rule py-4">
      {entries.length > 1 ? (
        <>
          <h2 className="text-[13px] font-medium">Входы</h2>
          <div className="mt-2">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-baseline justify-between gap-3 border-b border-rule py-2 text-[13px] first:border-t"
              >
                <span className="num">
                  {price(entry.price)}
                  <span className="text-ink-soft"> · {qtyFormat.format(quantityOf(entry))}</span>
                </span>
                <span className="flex items-baseline gap-3 text-[12px] text-ink-soft">
                  <span className="num">{dateTime(entry.createdAt)}</span>
                  {canChange && index > 0 && entry === last ? (
                    <button
                      type="button"
                      onClick={() => remove.mutate(entry.id)}
                      className="underline underline-offset-2 hover:text-ink"
                    >
                      убрать
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {canChange && !open ? (
        <button
          type="button"
          onClick={() => {
            setStopLoss(String(trade.stopLoss));
            setOpen(true);
          }}
          className={
            (entries.length > 1 ? "mt-3 " : "") +
            "text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
          }
        >
          Добрать
        </button>
      ) : null}

      {canChange && open ? (
        <form onSubmit={onSubmit} className={entries.length > 1 ? "mt-3" : ""}>
          <p className="text-[13px] font-medium">Добрать</p>
          <div className="mt-2 grid max-w-[560px] grid-cols-3 gap-2">
            <label className="text-[11px] text-ink-soft">
              Цена
              <input
                type="number"
                step="any"
                inputMode="decimal"
                autoFocus
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                className={inputClass + " mt-1"}
              />
            </label>
            <label className="text-[11px] text-ink-soft">
              Риск добора, %
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={riskPct}
                onChange={(e) => setRiskPct(e.target.value)}
                className={inputClass + " mt-1"}
              />
            </label>
            <label className="text-[11px] text-ink-soft">
              Стоп
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className={inputClass + " mt-1"}
              />
            </label>
          </div>

          <p className="mt-2 text-[11px] text-ink-soft">
            {preview?.position ? (
              <>
                станет: вход <span className="num">{price(preview.position.entryPrice)}</span> ·
                позиция <span className="num">{money(preview.position.positionSize)}</span> · риск{" "}
                <span className="num">
                  {money(preview.position.riskAmount)} · {pct(preview.position.riskPct)}
                </span>
              </>
            ) : (
              "Стоп общий для всей позиции — как на бирже. Риск добора — от депозита на момент первого входа."
            )}
          </p>
          {preview?.error || formError ? (
            <p className="mt-1 text-[12px] text-short">{formError ?? preview?.error}</p>
          ) : null}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white"
            >
              Добрать
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}

      {mutationError ? (
        <p className="mt-2 text-[12px] text-short">Не сохранилось: {mutationError.message}</p>
      ) : null}
    </section>
  );
}
