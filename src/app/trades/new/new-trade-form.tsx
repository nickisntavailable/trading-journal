"use client";

import { useMemo, useState } from "react";
import {
  ScreenshotBlock,
  ScreenshotCandidates,
  type ParsedScreenshot,
} from "@/app/trades/new/screenshot-block";
import { TradeView } from "@/components/trade-view";
import { money, pct } from "@/lib/format";
import type { TradeWithFixes } from "@/lib/query/api";
import { useCreateTrade } from "@/lib/query/trade";
import type { AccountDTO, TradeDTO } from "@/lib/serialize";
import { parseTradingViewLink } from "@/lib/tradingview-link";
import {
  margin,
  positionSize,
  riskAmount,
  stopDistancePct,
  validateStopDirection,
  type Direction,
} from "@/lib/trading-math";

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function NewTradeForm({ account }: { account: AccountDTO }) {
  const createTrade = useCreateTrade();
  // Открытая сделка показывается на месте формы: перехода на другую страницу
  // и ожидания SSR нет, URL подменяется, чтобы обновление страницы работало.
  const [opened, setOpened] = useState<TradeWithFixes | null>(null);

  const [pair, setPair] = useState("");
  const [direction, setDirection] = useState<Direction>(1);
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [riskPct, setRiskPct] = useState(account.baseRiskPct);
  const [leverage, setLeverage] = useState(String(account.defaultLeverage));
  const [tvLink, setTvLink] = useState("");
  const [parsed, setParsed] = useState<ParsedScreenshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Поля, на которые ругнулись при отправке: подсвечиваются, пока не заполнены.
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [parsingSnapshot, setParsingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  // Основной путь — картинка. Поле ссылки открывается само, когда со скриншотом
  // не вышло, либо вручную: ссылка сохраняется со сделкой и открывается с её
  // страницы, так что она нужна и когда разбор прошёл успешно.
  const [showLink, setShowLink] = useState(false);

  // Live-превью считается тем же кодом, что и на сервере, без похода на бэкенд.
  const preview = useMemo(() => {
    const entry = Number(entryPrice);
    const stop = Number(stopLoss);
    if (!entryPrice || !stopLoss || !Number.isFinite(entry) || !Number.isFinite(stop)) {
      return null;
    }
    if (entry <= 0 || stop <= 0 || entry === stop) return null;

    const risk = riskAmount(account.balance, riskPct);
    const size = positionSize(risk, entry, stop);
    const lev = Number(leverage);
    const marginValue = Number.isFinite(lev) && lev > 0 ? margin(size, lev) : null;
    return {
      risk,
      size,
      margin: marginValue,
      // Маржа больше баланса — биржа такую сделку не откроет.
      marginError:
        marginValue !== null && marginValue > account.balance
          ? `Маржа ${money(marginValue)} больше баланса — при таком плече сделка не откроется`
          : null,
      distancePct: stopDistancePct(entry, stop),
      stopError: validateStopDirection(entry, stop, direction),
    };
  }, [entryPrice, stopLoss, riskPct, direction, leverage, account.balance]);

  function applyParsed(result: ParsedScreenshot) {
    if (result.pair) setPair(result.pair.toUpperCase());
    setParsed(result);

    // Разбор формально успешен, но пустой — предлагаем запасной путь.
    const empty =
      result.pair === null && result.currentPrice === null && result.levels.length === 0;
    if (empty) setShowLink(true);

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

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const entry = Number(entryPrice);
    const stop = Number(stopLoss);

    // Кнопка всегда активна: вместо молчаливого disabled — перечисляем, чего не
    // хватает, подсвечиваем поля и ставим курсор в первое из них.
    const problems: { id: string; label: string }[] = [];
    if (pair.trim().length === 0) problems.push({ id: "pair", label: "пара" });
    if (!entryPrice.trim() || !Number.isFinite(entry) || entry <= 0) {
      problems.push({ id: "entryPrice", label: "цена входа" });
    }
    if (!stopLoss.trim() || !Number.isFinite(stop) || stop <= 0) {
      problems.push({ id: "stopLoss", label: "стоп-лосс" });
    }
    if (problems.length > 0) {
      setMissing(new Set(problems.map((p) => p.id)));
      setError(`Не заполнено: ${problems.map((p) => p.label).join(", ")}`);
      document.getElementById(problems[0].id)?.focus();
      return;
    }
    setMissing(new Set());

    const stopError = validateStopDirection(entry, stop, direction);
    if (stopError) {
      setError(stopError);
      document.getElementById("stopLoss")?.focus();
      return;
    }

    const lev = Number(leverage) > 0 ? Number(leverage) : account.defaultLeverage;
    const riskAmountValue = riskAmount(account.balance, riskPct);
    const positionSizeValue = positionSize(riskAmountValue, entry, stop);

    // DTO считаем локально теми же формулами, что и сервер: карточка сразу
    // показывает те цифры, которые он потом подтвердит.
    const trade: TradeDTO = {
      id: crypto.randomUUID(),
      accountId: account.id,
      pair: pair.trim().toUpperCase(),
      direction,
      entryPrice: entry,
      stopLoss: stop,
      riskPct,
      depositAtEntry: account.balance,
      feeRateAtEntry: account.feeRatePct,
      riskAmount: riskAmountValue,
      positionSize: positionSizeValue,
      leverage: lev,
      tvLink: tvLink.trim() ? tvLink.trim() : null,
      status: "open",
      createdAt: new Date().toISOString(),
      closedAt: null,
      grossPnL: null,
      totalFees: null,
      netPnL: null,
      netPnlPctOfDeposit: null,
      realizedAvgExit: null,
      realizedRR: null,
    };
    const snapshot: TradeWithFixes = { trade, fixes: [] };

    setOpened(snapshot);
    window.history.replaceState(null, "", `/trades/${trade.id}`);
    createTrade.mutate({
      snapshot,
      body: {
        id: trade.id,
        pair: trade.pair,
        direction,
        entryPrice: entry,
        stopLoss: stop,
        riskPct,
        leverage: lev,
        ...(trade.tvLink ? { tvLink: trade.tvLink } : {}),
      },
    });
  }

  function backToForm() {
    createTrade.reset();
    setOpened(null);
    window.history.replaceState(null, "", "/trades/new");
  }

  // Подсветка поля снимается, как только в него что-то ввели.
  const fieldClass = (id: string, filled: boolean) =>
    inputClass + " mt-1" + (missing.has(id) && !filled ? " border-short" : "");

  if (opened) {
    return (
      <TradeView
        initialData={opened}
        creation={
          createTrade.isError
            ? {
                message: createTrade.error.message,
                retry: () => createTrade.mutate(createTrade.variables!),
                back: backToForm,
              }
            : null
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-[560px]">
      <h1 className="mb-4 text-[13px] font-medium">Новая сделка</h1>
      <ScreenshotBlock onParsed={applyParsed} onFailure={() => setShowLink(true)} />
      <ScreenshotCandidates
        parsed={parsed}
        entryPrice={entryPrice}
        stopLoss={stopLoss}
        onPickEntry={(v) => setEntryPrice(String(v))}
        onPickStop={(v) => setStopLoss(String(v))}
      />

      {showLink ? (
        <div className="border-b border-rule py-4">
          <label htmlFor="tvLink" className="block text-[11px] text-ink-soft">
            Ссылка на TradingView
          </label>
          <input
            id="tvLink"
            type="url"
            inputMode="url"
            autoFocus
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
      ) : (
        <div className="border-b border-rule py-3">
          <button
            type="button"
            onClick={() => setShowLink(true)}
            className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Добавить ссылку на TradingView
          </button>
        </div>
      )}

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
            className={fieldClass("pair", pair.trim().length > 0)}
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
            className={fieldClass("entryPrice", entryPrice.trim().length > 0)}
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
            className={fieldClass("stopLoss", stopLoss.trim().length > 0)}
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
        <div className="mt-2 flex items-center justify-between gap-4">
          <p className="text-[11px] text-ink-soft">
            базовый риск аккаунта — <span className="num">{pct(account.baseRiskPct)}</span>
          </p>
          <label className="flex items-center gap-2 text-[11px] text-ink-soft">
            Плечо
            <input
              type="number"
              step="1"
              min="1"
              inputMode="decimal"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
              className="num w-16 rounded-[3px] border border-rule bg-white px-2 py-1 text-[13px] text-ink outline-none focus:border-ink"
            />
            ×
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-rule py-4 md:grid-cols-4">
        <Readout label="Риск, $" value={preview ? money(preview.risk) : "—"} />
        <Readout label="Позиция, $" value={preview ? money(preview.size) : "—"} />
        <Readout
          label={`Маржа при ${Number(leverage) > 0 ? leverage : "—"}×`}
          value={preview?.margin !== null && preview?.margin !== undefined ? money(preview.margin) : "—"}
        />
        <Readout label="Дистанция" value={preview ? pct(preview.distancePct) : "—"} />
      </div>

      {preview?.stopError ? (
        <p className="mt-3 text-[12px] text-short">{preview.stopError}</p>
      ) : null}
      {preview?.marginError ? (
        <p className="mt-3 text-[12px] text-amber">{preview.marginError}</p>
      ) : null}
      {error ? <p className="mt-3 text-[12px] text-short">{error}</p> : null}

      <button
        type="submit"
        className="mt-5 rounded-[3px] bg-btn px-4 py-2 text-[13px] font-medium text-white"
      >
        Открыть сделку
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
        Запасной путь, если со скриншотом не вышло: снимок графика
        (<span className="num">tradingview.com/x/…</span>, в TradingView Alt+S) разбирается
        так же, как загруженная картинка. Ссылка на сам график даст только тикер и
        таймфрейм, но сохранится вместе со сделкой.
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
