/**
 * Разбор ссылки TradingView. Работает офлайн: и пара, и таймфрейм лежат прямо
 * в query-параметрах ссылки на график, обращаться к модели незачем.
 *
 * Поддерживаются два вида ссылок:
 *   https://ru.tradingview.com/chart/OuLzFVvQ/?symbol=BITGET%3ABTCUSDT&interval=60
 *   https://www.tradingview.com/x/AbCdEfGh/   — снимок графика
 */

export type TradingViewLink = {
  /** Тикер без биржи: BTCUSDT */
  pair: string | null;
  /** Биржа, если указана в символе: BITGET */
  exchange: string | null;
  /** Человекочитаемый таймфрейм: 1H, 4H, 1D */
  timeframe: string | null;
  /** Идентификатор снимка для ссылок вида /x/<id>/ */
  snapshotId: string | null;
};

const TV_HOST = /(^|\.)tradingview\.com$/i;

// Значения параметра interval в ссылках TradingView.
const INTERVAL_LABELS: Record<string, string> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "45": "45m",
  "60": "1H",
  "120": "2H",
  "180": "3H",
  "240": "4H",
  "360": "6H",
  "480": "8H",
  "720": "12H",
  D: "1D",
  "1D": "1D",
  W: "1W",
  "1W": "1W",
  M: "1M",
  "1M": "1M",
};

function normalizeInterval(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return INTERVAL_LABELS[key] ?? null;
}

/** Возвращает null, если это не ссылка на TradingView. */
export function parseTradingViewLink(raw: string): TradingViewLink | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!TV_HOST.test(url.hostname)) return null;

  // symbol приходит как BITGET:BTCUSDT (двоеточие обычно url-кодировано)
  const symbol = url.searchParams.get("symbol");
  let pair: string | null = null;
  let exchange: string | null = null;
  if (symbol) {
    const parts = symbol.split(":");
    if (parts.length > 1) {
      exchange = parts[0].toUpperCase() || null;
      pair = parts.slice(1).join(":").toUpperCase() || null;
    } else {
      pair = parts[0].toUpperCase() || null;
    }
  }

  const snapshotMatch = url.pathname.match(/^\/x\/([A-Za-z0-9]+)\/?$/);

  return {
    pair,
    exchange,
    timeframe: normalizeInterval(url.searchParams.get("interval")),
    snapshotId: snapshotMatch ? snapshotMatch[1] : null,
  };
}
