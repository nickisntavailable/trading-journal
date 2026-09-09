"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  LevelCandidates,
  ScreenshotBlock,
  type ParsedScreenshot,
} from "@/app/trades/new/screenshot-block";
import { money, pct } from "@/lib/format";
import type { AccountDTO } from "@/lib/serialize";
import {
  positionSize,
  riskAmount,
  stopDistancePct,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function NewTradeForm({ account }: { account: AccountDTO }) {
  const router = useRouter();

  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState<Direction>(1);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [riskPct, setRiskPct] = useState(account.baseRiskPct);
  const [tvLink, setTvLink] = useState("");
  const [levels, setLevels] = useState<{ price: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Live-превью считается тем же кодом, что и на сервере, без похода на бэкенд.
  const preview = useMemo(() => {
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    if (!entryPrice || !stopLoss || !Number.isFinite(entry) || !Number.isFinite(stop)) {
      return null;
    }
    if (entry <= 0 || stop <= 0 || entry === stop) return null;

    const risk = riskAmount(account.balance, riskPct);
    return {
      risk,
      size: positionSize(risk, entry, stop),
      distancePct: stopDistancePct(entry, stop),
      stopError: validateStopDirection(entry, stop, direction),
    };
  }, [entryPrice, stopLoss, riskPct, direction, account.balance]);

  function applyParsed(parsed: ParsedScreenshot) {
    if (parsed.pair) setPair(parsed.pair.toUpperCase());
    setLevels(parsed.levels);
    // Уровни и текущая цена не подставляются автоматически — только по клику.
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    const stopError = validateStopDirection(entry, stop, direction);
    if (stopError) {
      setError(stopError);
      return;
    }

    setPending(true);
    const response = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pair: pair.trim(),
        direction,
        entryPrice: entry,
        stopLoss: stop,
        riskPct,
        ...(tvLink.trim() ? { tvLink: tvLink.trim() } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Не удалось открыть сделку");
      setPending(false);
      return;
    }

    router.push(`/trades/${data.trade.id}`);
    router.refresh();
  }

  const canSubmit =
    pair.trim().length > 0 && preview !== null && !preview.stopError && !pending;

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-[560px]">
      <ScreenshotBlock onParsed={applyParsed} />

      <div className="border-b border-rule py-4">
        <label htmlFor="tvLink" className="block text-[11px] text-ink-soft">
          Ссылка на TradingView
        </label>
        <input
          id="tvLink"
          type="url"
          inputMode="url"
          placeholder="https://www.tradingview.com/x/…"
          value={tvLink}
          onChange={(e) => setTvLink(e.target.value)}
          className={inputClass + " mt-1"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-rule py-4">
        <div>
          <label htmlFor="pair" className="block text-[11px] text-ink-soft">
            Пара
          </label>
          <input
            id="pair"
            value={pair}
            onChange={(e) => setPair(e.target.value.toUpperCase())}
            placeholder="BTCUSDT"
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
                "rounded-[3px] border px-3 py-2 text-[13px] " +
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
                "rounded-[3px] border px-3 py-2 text-[13px] " +
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
          <label htmlFor="entryPrice" className="block text-[11px] text-ink-soft">
            Цена входа
          </label>
          <input
            id="entryPrice"
            type="number"
            step="any"
            inputMode="decimal"
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>

        <div>
          <label htmlFor="stopLoss" className="block text-[11px] text-ink-soft">
            Стоп-лосс
          </label>
          <input
            id="stopLoss"
            type="number"
            step="any"
            inputMode="decimal"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            className={inputClass + " mt-1"}
          />
          <LevelCandidates levels={levels} onPick={(v) => setStopLoss(String(v))} />
        </div>
      </div>

      <div className="border-b border-rule py-4">
        <div className="flex items-baseline justify-between">
          <label htmlFor="riskPct" className="text-[11px] text-ink-soft">
            Риск на сделку
          </label>
          <span className="num text-[13px]">{pct(riskPct)}</span>
        </div>
        <input
          id="riskPct"
          type="range"
          min={0.1}
          max={5}
          step={0.1}
          value={riskPct}
          onChange={(e) => setRiskPct(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--btn)]"
        />
        <p className="mt-1 text-[11px] text-ink-soft">
          базовый риск аккаунта — <span className="num">{pct(account.baseRiskPct)}</span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 border-b border-rule py-4">
        <Readout label="Риск, $" value={preview ? money(preview.risk) : "—"} />
        <Readout label="Размер позиции, $" value={preview ? money(preview.size) : "—"} />
        <Readout
          label="Дистанция до стопа"
          value={preview ? pct(preview.distancePct) : "—"}
        />
      </div>

      {preview?.stopError ? (
        <p className="mt-3 text-[12px] text-short">{preview.stopError}</p>
      ) : null}
      {error ? <p className="mt-3 text-[12px] text-short">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 rounded-[3px] bg-btn px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
      >
        {pending ? "Открываю…" : "Открыть сделку"}
      </button>
    </form>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className="num mt-0.5 truncate text-[15px]">{value}</p>
    </div>
  );
}
