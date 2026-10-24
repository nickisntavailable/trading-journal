/**
 * Чистые расчёты для расширения: размер тика, цены стопа и цели, ссылка в
 * журнал. Без DOM и без TradingView — поэтому покрыты тестами в Node
 * (levels.test.cjs).
 *
 * Откуда числа. Инструмент «Длинная/Короткая позиция» отдаёт вход ценой, а
 * стоп и цель — в тиках от входа (stopLevel, profitLevel). Размера тика
 * TradingView наружу не отдаёт, поэтому собираем его из двух источников:
 *  - форматтер цен графика: сколько знаков после запятой — шаг цены 10^-n
 *    или кратный ему;
 *  - суммы, которые инструмент сам считает: остаток счёта на стопе
 *    (amountStop) и количество (qty) дают расстояние до стопа в цене.
 * Расстояние / тики ≈ тик; округляем до кратного 10^-n — так округление сумм
 * до центов не сдвигает цену, а экзотический шаг (0,005) не теряется.
 */
(function (root) {
  /** Сколько знаков после разделителя в отформатированной цене («0,1235» → 4). */
  function decimalsOf(formatted) {
    const match = String(formatted).match(/[.,](\d+)/);
    return match ? match[1].length : 0;
  }

  function computeTick({ decimals, stopLevel, accountSize, amountStop, qty }) {
    const base = Math.pow(10, -decimals);
    const amountsKnown =
      stopLevel > 0 && qty > 0 && Number.isFinite(accountSize) && Number.isFinite(amountStop);
    if (amountsKnown) {
      const estimate = Math.abs(accountSize - amountStop) / qty / stopLevel;
      const multiple = Math.round(estimate / base);
      if (multiple >= 1) return base * multiple;
    }
    return base;
  }

  function round(value, decimals) {
    return Number(value.toFixed(decimals));
  }

  /**
   * Цены сделки из свойств инструмента. null — если чего-то не хватает:
   * тогда пункт в меню просто не показываем.
   */
  function computeLevels({ direction, entry, stopLevel, profitLevel, accountSize, amountStop, qty, formattedSample }) {
    if (!(direction === 1 || direction === -1)) return null;
    if (!(entry > 0) || !(stopLevel > 0)) return null;
    const decimals = decimalsOf(formattedSample);
    const tick = computeTick({ decimals, stopLevel, accountSize, amountStop, qty });
    const stop = entry - direction * stopLevel * tick;
    if (!(stop > 0)) return null;
    return {
      direction,
      entry: round(entry, decimals),
      stop: round(stop, decimals),
      target: profitLevel > 0 ? round(entry + direction * profitLevel * tick, decimals) : null,
      tick,
    };
  }

  /** Ссылка на форму новой сделки журнала; тикер журнал нормализует сам. */
  function journalUrl(baseUrl, symbol, levels) {
    const url = new URL("/trades/new", baseUrl);
    url.searchParams.set("pair", symbol);
    url.searchParams.set("side", levels.direction === 1 ? "long" : "short");
    url.searchParams.set("entry", String(levels.entry));
    url.searchParams.set("stop", String(levels.stop));
    url.searchParams.set("source", "tv");
    return url.toString();
  }

  const api = { decimalsOf, computeTick, computeLevels, journalUrl };
  root.TJLevels = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
