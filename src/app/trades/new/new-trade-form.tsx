"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ScreenshotBlock,
  ScreenshotCandidates,
  type ParsedScreenshot,
} from "@/app/trades/new/screenshot-block";
import { money, pct } from "@/lib/format";
import type { AccountDTO } from "@/lib/serialize";
import { parseTradingViewLink } from "@/lib/tradingview-link";
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
  const [parsed, setParsed] = useState<ParsedScreenshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [parsingSnapshot, setParsingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

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

  function applyParsed(result: ParsedScreenshot) {
    if (result.pair) setPair(result.pair.toUpperCase());
    setParsed(result);

    // Подставляем только то, что уже помечено на самом графике: цвет плашки на
    // ценовой шкале и зоны инструмента позиции модель читает, а не выводит.
    // Всё подставленное видно в списке кандидатов и правится одним кликом.
    if (result.direction) setDirection(result.direction === "short" ? -1 : 1);

    // Плашка текущей цены на шкале подсвечена так же, как плашка входа, и модель
    // иногда помечает ролью "entry" обе. Текущую цену как вход не берём: если
    // она действительно нужна, пользователь подставит её кнопкой.
    const entryLevels = result.levels.filter((level) => level.role === "entry");
    const markedEntry =
      entryLevels.find((level) => level.price !== result.currentPrice) ?? null;
    const markedStop = result.levels.find((level) => level.role === "stop");

    if (markedEntry) setEntryPrice(String(markedEntry.price));
    if (markedStop) setStopLoss(String(markedStop.price));
  }

  // Пара и таймфрейм лежат в самой ссылке TradingView — читаем их сразу,
  // без запроса к модели. Пару подставляем только в пустое поле, чтобы не
  // затирать то, что пользователь уже ввёл руками.
  const linkInfo = useMemo(() => parseTradingViewLink(tvLink), [tvLink]);

  function onTvLinkChange(value: string) {
    setTvLink(value);
    setSnapshotError(null);
    const info = parseTradingViewLink(value);
    if (info?.pair && pair.trim().length === 0) setPair(info.pair);
  }

  /** Снимок разбирается тем же путём, что и загруженный файл. */
  async function parseSnapshot() {
    setParsingSnapshot(true);
    setSnapshotError(null);
    try {
      const response = await fetch("/api/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tvLink.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSnapshotError(data.error ?? "Не удалось разобрать снимок");
        return;
      }
      applyParsed(data as ParsedScreenshot);
    } catch {
      setSnapshotError("Не удалось разобрать снимок");
    } finally {
      setParsingSnapshot(false);
    }
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
      <ScreenshotCandidates
        parsed={parsed}
        entryPrice={entryPrice}
        stopLoss={stopLoss}
        onPickEntry={(v) => setEntryPrice(String(v))}
        onPickStop={(v) => setStopLoss(String(v))}
      />

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
          onChange={(e) => onTvLinkChange(e.target.value)}
          className={inputClass + " mt-1"}
        />
        <LinkReadout
          info={linkInfo}
          hasLink={tvLink.trim().length > 0}
          currentPair={pair}
          onUsePair={setPair}
          onParseSnapshot={parseSnapshot}
          parsingSnapshot={parsingSnapshot}
          snapshotError={snapshotError}
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
        <Readout label="Дистанция" value={preview ? pct(preview.distancePct) : "—"} />
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

/**
 * Что удалось вычитать из ссылки, и что с ней можно сделать дальше.
 * Ссылка на снимок (/x/…) разбирается целиком, ссылка на живой график даёт
 * только тикер и таймфрейм — об этом здесь и написано.
 */
function LinkReadout({
  info,
  hasLink,
  currentPair,
  onUsePair,
  onParseSnapshot,
  parsingSnapshot,
  snapshotError,
}: {
  info: ReturnType<typeof parseTradingViewLink>;
  hasLink: boolean;
  currentPair: string;
  onUsePair: (value: string) => void;
  onParseSnapshot: () => void;
  parsingSnapshot: boolean;
  snapshotError: string | null;
}) {
  if (!hasLink) {
    return (
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Ссылка на снимок (<span className="num">tradingview.com/x/…</span>) разбирается
        целиком, как загруженный скриншот. Ссылка на сам график даст только тикер и
        таймфрейм.
      </p>
    );
  }

  if (!info) {
    return (
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Ссылка сохранится вместе со сделкой, но прочитать из неё пару не вышло — это не
        адрес TradingView.
      </p>
    );
  }

  // Снимок: у него нет символа в адресе, зато есть картинка со всей разметкой.
  if (info.snapshotId) {
    return (
      <div className="mt-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onParseSnapshot}
            disabled={parsingSnapshot}
            className="rounded-[3px] border border-rule bg-white px-2.5 py-1 text-[11px] hover:border-ink disabled:opacity-40"
          >
            {parsingSnapshot ? "Разбираю снимок…" : "Разобрать снимок"}
          </button>
          <span className="text-[11px] text-ink-soft">
            {snapshotError ?? "Заберём картинку снимка и прочитаем её как скриншот"}
          </span>
        </div>
      </div>
    );
  }

  const mismatch = currentPair.trim().length > 0 && currentPair.trim() !== info.pair;

  return (
    <div className="mt-1.5">
      {info.pair ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
          <span>Из ссылки:</span>
          <span className="num text-ink">
            {info.exchange ? `${info.exchange}:` : ""}
            {info.pair}
          </span>
          {info.timeframe ? <span className="num">· {info.timeframe}</span> : null}
          {mismatch ? (
            <button
              type="button"
              onClick={() => onUsePair(info.pair as string)}
              className="rounded-[3px] border border-rule bg-white px-2 py-0.5 hover:border-ink"
            >
              подставить <span className="num">{info.pair}</span>
            </button>
          ) : null}
        </p>
      ) : (
        <p className="text-[11px] text-ink-soft">В адресе нет символа — заполни пару вручную.</p>
      )}

      <p className="mt-1 text-[11px] text-ink-soft">
        Это ссылка на живой график: уровни из неё не вытащить, картинки по такому адресу
        не существует. Чтобы разобрать разметку, сделай снимок — в TradingView Alt+S или
        иконка фотоаппарата → «Скопировать ссылку на изображение графика», получится
        адрес вида <span className="num">tradingview.com/x/…</span>.
      </p>
    </div>
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
