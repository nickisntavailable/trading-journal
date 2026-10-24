import type { Direction } from "@/lib/trading-math";

/**
 * Заполнение формы новой сделки из адреса:
 * /trades/new?pair=BINANCE:ADAUSDT.P&side=short&entry=0.2177&stop=0.2198&source=tv
 *
 * Ссылку собирает расширение для TradingView (пункт «Открыть сделку в
 * журнале»), но годится и любая другая. Ссылка только заполняет поля —
 * сделку открывает человек кнопкой: иначе чужая ссылка могла бы открыть
 * сделку от его имени одним кликом.
 *
 * Всё некорректное молча пропускается — поле просто остаётся пустым.
 */
export type TradePrefill = {
  pair?: string;
  direction?: Direction;
  entryPrice?: string;
  stopLoss?: string;
  /** Откуда пришли данные — для подписи над формой. */
  source?: "tv";
};

type Params = Record<string, string | string[] | undefined>;

function first(params: Params, key: string): string | undefined {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

/**
 * Тикер в вид журнала: без биржи («BINANCE:») и без суффикса бессрочного
 * контракта TradingView («.P»). BINANCE:ADAUSDT.P → ADAUSDT.
 */
export function normalizePair(raw: string): string | undefined {
  const symbol = raw.split(":").pop()!.replace(/\.P$/i, "").toUpperCase();
  return /^[A-Z0-9]{2,32}$/.test(symbol) ? symbol : undefined;
}

function parseDirection(raw: string | undefined): Direction | undefined {
  switch (raw?.toLowerCase()) {
    case "long":
    case "buy":
    case "1":
      return 1;
    case "short":
    case "sell":
    case "-1":
      return -1;
    default:
      return undefined;
  }
}

/** Положительное число; запятая как разделитель тоже годится. В форму — строкой. */
function parsePrice(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? String(value) : undefined;
}

export function parseTradePrefill(params: Params): TradePrefill {
  const pairRaw = first(params, "pair");
  return {
    pair: pairRaw ? normalizePair(pairRaw) : undefined,
    direction: parseDirection(first(params, "side")),
    entryPrice: parsePrice(first(params, "entry")),
    stopLoss: parsePrice(first(params, "stop")),
    source: first(params, "source") === "tv" ? "tv" : undefined,
  };
}

export function hasPrefill(prefill: TradePrefill): boolean {
  return Boolean(prefill.pair || prefill.direction || prefill.entryPrice || prefill.stopLoss);
}
