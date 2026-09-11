"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { money, pct } from "@/lib/format";
import type { TradeDTO } from "@/lib/serialize";
import {
  margin,
  positionSize,
  riskAmount,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

/**
 * Правка параметров открытой сделки — на случай опечатки во входе или стопе.
 * Пересчёт риска и размера позиции показывается до сохранения.
 */
export function EditTradeForm({
  trade,
  hasFixes,
}: {
  trade: TradeDTO;
  hasFixes: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState(trade.pair);
  const [direction, setDirection] = useState<Direction>(trade.direction);
  const [entryPrice, setEntryPrice] = useState(String(trade.entryPrice));
  const [stopLoss, setStopLoss] = useState(String(trade.stopLoss));
  const [riskPct, setRiskPct] = useState(String(trade.riskPct));
  const [leverage, setLeverage] = useState(String(trade.leverage));
  const [tvLink, setTvLink] = useState(trade.tvLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    const risk = Number(riskPct);
    if (![entry, stop, risk].every(Number.isFinite)) return null;
    if (entry <= 0 || stop <= 0 || entry === stop || risk <= 0) return null;

    const riskAmountValue = riskAmount(trade.depositAtEntry, risk);
    const size = positionSize(riskAmountValue, entry, stop);
    const lev = Number(leverage);
    return {
      risk: riskAmountValue,
      size,
      margin: Number.isFinite(lev) && lev > 0 ? margin(size, lev) : null,
      stopError: validateStopDirection(entry, stop, direction),
    };
  }, [entryPrice, stopLoss, riskPct, leverage, direction, trade.depositAtEntry]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const response = await fetch(`/api/trades/${trade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pair: pair.trim(),
        direction,
        entryPrice: Number(entryPrice),
        stopLoss: Number(stopLoss),
        riskPct: Number(riskPct),
        ...(Number(leverage) > 0 ? { leverage: Number(leverage) } : {}),
        tvLink: tvLink.trim() ? tvLink.trim() : null,
      }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        Изменить параметры
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-[560px] border-t border-rule pt-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label htmlFor="editPair" className="block text-[11px] text-ink-soft">
            Пара
          </label>
          <input
            id="editPair"
            value={pair}
            onChange={(e) => setPair(e.target.value.toUpperCase())}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <span className="block text-[11px] text-ink-soft">Направление</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setDirection(1)}
              className={
                "rounded-[3px] border px-2 py-2 text-[12px] " +
                (direction === 1
                  ? "border-long text-long"
                  : "border-rule bg-white text-ink-soft")
              }
            >
              long
            </button>
            <button
              type="button"
              onClick={() => setDirection(-1)}
              className={
                "rounded-[3px] border px-2 py-2 text-[12px] " +
                (direction === -1
                  ? "border-short text-short"
                  : "border-rule bg-white text-ink-soft")
              }
            >
              short
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="editRiskPct" className="block text-[11px] text-ink-soft">
            Риск, %
          </label>
          <input
            id="editRiskPct"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <label htmlFor="editLeverage" className="block text-[11px] text-ink-soft">
            Плечо, ×
          </label>
          <input
            id="editLeverage"
            type="number"
            step="1"
            min="1"
            inputMode="decimal"
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <label htmlFor="editEntry" className="block text-[11px] text-ink-soft">
            Цена входа
          </label>
          <input
            id="editEntry"
            type="number"
            step="any"
            inputMode="decimal"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <label htmlFor="editStop" className="block text-[11px] text-ink-soft">
            Стоп-лосс
          </label>
          <input
            id="editStop"
            type="number"
            step="any"
            inputMode="decimal"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <label htmlFor="editTvLink" className="block text-[11px] text-ink-soft">
            Ссылка на TradingView
          </label>
          <input
            id="editTvLink"
            type="url"
            inputMode="url"
            value={tvLink}
            onChange={(e) => setTvLink(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-ink-soft">
        Депозит на момент открытия <span className="num">{money(trade.depositAtEntry)}</span> и
        ставка комиссии <span className="num">{pct(trade.feeRateAtEntry)}</span> остаются
        прежними. Новый риск{" "}
        <span className="num">{preview ? money(preview.risk) : "—"}</span>, позиция{" "}
        <span className="num">{preview ? money(preview.size) : "—"}</span>, маржа{" "}
        <span className="num">{preview?.margin != null ? money(preview.margin) : "—"}</span>.
      </p>

      {hasFixes ? (
        <p className="mt-2 text-[11px] text-amber">
          По сделке уже есть фиксации — новый размер позиции будет учтён при расчёте
          результата закрытия.
        </p>
      ) : null}

      {preview?.stopError ? (
        <p className="mt-2 text-[12px] text-short">{preview.stopError}</p>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !preview || !!preview.stopError || !pair.trim()}
          className="rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
        >
          {pending ? "Сохраняю…" : "Сохранить"}
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
  );
}
