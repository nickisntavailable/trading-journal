/** Форматирование только для вывода — в БД значения хранятся неокруглёнными. */

const MONEY = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return MONEY.format(Number(value));
}

export function signedMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${MONEY.format(Math.abs(n))}`;
}

export function pct(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${PCT.format(Number(value))}%`;
}

export function signedPct(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${PCT.format(Math.abs(n))}%`;
}

/** Цены показываем без принудительного округления до 2 знаков. */
export function price(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  const decimals = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 1 ? 4 : 8;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function ratio(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(2);
}

export function shortDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

export function dateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
