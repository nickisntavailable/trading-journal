"use client";

import { useMemo, useState } from "react";
import { money, pct } from "@/lib/format";
import { useUpdateTrade } from "@/lib/query/trade";
import { positionFromEntries, validateEntriesAgainstStop } from "@/lib/entries-math";
import type { EntryDTO, TradeDTO } from "@/lib/serialize";
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
  entries,
}: {
  trade: TradeDTO;
  hasFixes: boolean;
  entries: EntryDTO[];
}) {
  // Несколько входов: вход средний, риск — следствие входов и стопа. Здесь
  // правятся только стоп, пара, плечо и ссылка; ошибку во входе исправляют
  // снятием добора.
  const multi = entries.length > 1;
  const update = useUpdateTrade(trade.id);
  const [open, setOpen] = useState(false);
  const [pair, setPair] = useState(trade.pair);
  const [direction, setDirection] = useState<Direction>(trade.direction);
  const [entryPrice, setEntryPrice] = useState(String(trade.entryPrice));
  const [stopLoss, setStopLoss] = useState(String(trade.stopLoss));
  const [riskPct, setRiskPct] = useState(String(trade.riskPct));
  const [leverage, setLeverage] = useState(String(trade.leverage));
  const [tvLink, setTvLink] = useState(trade.tvLink ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = update.isPending;

  const preview = useMemo(() => {
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    const risk = Number(riskPct);
    const lev = Number(leverage);
    const marginOf = (size: number) => (Number.isFinite(lev) && lev > 0 ? margin(size, lev) : null);

    if (multi) {
      if (!Number.isFinite(stop) || stop <= 0) return null;
      const position = positionFromEntries(entries, stop, trade.direction, trade.depositAtEntry);
      return {
        risk: position.riskAmount,
        size: position.positionSize,
        margin: marginOf(position.positionSize),
        stopError: validateEntriesAgainstStop(entries, stop, trade.direction),
      };
    }

    if (![entry, stop, risk].every(Number.isFinite)) return null;
    if (entry <= 0 || stop <= 0 || entry === stop || risk <= 0) return null;

    const riskAmountValue = riskAmount(trade.depositAtEntry, risk);
    const size = positionSize(riskAmountValue, entry, stop);
    return {
      risk: riskAmountValue,
      size,
      margin: marginOf(size),
      stopError: validateStopDirection(entry, stop, direction),
    };
  }, [entryPrice, stopLoss, riskPct, leverage, direction, multi, entries, trade.direction, trade.depositAtEntry]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    update.mutate(
      {
        pair: pair.trim(),
        // У позиции из нескольких входов эти поля не правятся — не отправляем.
        ...(multi
          ? {}
          : { direction, entryPrice: Number(entryPrice), riskPct: Number(riskPct) }),
        stopLoss: Number(stopLoss),
        ...(Number(leverage) > 0 ? { leverage: Number(leverage) } : {}),
        tvLink: tvLink.trim() ? tvLink.trim() : null,
      },
      {
        // Ответ сервера уже лёг в кеш — страница перерисуется сама.
        onSuccess: () => setOpen(false),
        onError: (e) => setError(e.message),
      },
    );
  }

  // Поля заполняем из текущей сделки при каждом открытии: с момента первой
  // отрисовки её могли поменять (добор, перенос стопа), и старые значения
  // в форме откатили бы это при сохранении.
  function openForm() {
    setPair(trade.pair);
    setDirection(trade.direction);
    setEntryPrice(String(trade.entryPrice));
    setStopLoss(String(trade.stopLoss));
    setRiskPct(String(trade.riskPct));
    setLeverage(String(trade.leverage));
    setTvLink(trade.tvLink ?? "");
    setError(null);
    setOpen(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openForm}
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
              disabled={multi}
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
              disabled={multi}
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
            value={multi ? String(trade.riskPct) : riskPct}
            readOnly={multi}
            onChange={(e) => setRiskPct(e.target.value)}
            className={inputClass + " mt-1 read-only:bg-transparent read-only:text-ink-soft"}
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
            {multi ? "Вход · средний" : "Цена входа"}
          </label>
          <input
            id="editEntry"
            type="number"
            step="any"
            inputMode="decimal"
            value={multi ? String(trade.entryPrice) : entryPrice}
            readOnly={multi}
            onChange={(e) => setEntryPrice(e.target.value)}
            className={inputClass + " mt-1 read-only:bg-transparent read-only:text-ink-soft"}
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

      {multi ? (
        <p className="mt-2 text-[11px] text-ink-soft">
          Входов несколько: при переносе стопа количество монет не меняется, пересчитывается риск.
          Ошибку во входе исправляют снятием добора.
        </p>
      ) : null}

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
