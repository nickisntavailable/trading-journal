import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPrefill, normalizePair, parseTradePrefill } from "@/lib/trade-prefill";

test("тикер TradingView → тикер журнала", () => {
  assert.equal(normalizePair("BINANCE:ADAUSDT.P"), "ADAUSDT");
  assert.equal(normalizePair("BYBIT:btcusdt"), "BTCUSDT");
  assert.equal(normalizePair("SOLUSDT"), "SOLUSDT");
  assert.equal(normalizePair("<script>"), undefined);
  assert.equal(normalizePair("BINANCE:"), undefined);
});

test("ссылка из расширения заполняет все поля", () => {
  const p = parseTradePrefill({
    pair: "BINANCE:ADAUSDT.P",
    side: "short",
    entry: "0.2177",
    stop: "0.2198",
    source: "tv",
  });
  assert.deepEqual(p, {
    pair: "ADAUSDT",
    direction: -1,
    entryPrice: "0.2177",
    stopLoss: "0.2198",
    source: "tv",
  });
  assert.equal(hasPrefill(p), true);
});

test("направление и цены в разных записях", () => {
  assert.equal(parseTradePrefill({ side: "LONG" }).direction, 1);
  assert.equal(parseTradePrefill({ side: "sell" }).direction, -1);
  assert.equal(parseTradePrefill({ entry: "0,2177" }).entryPrice, "0.2177");
});

test("мусор молча пропускается", () => {
  const p = parseTradePrefill({ pair: "!!", side: "up", entry: "-1", stop: "abc", source: "x" });
  assert.deepEqual(p, {
    pair: undefined,
    direction: undefined,
    entryPrice: undefined,
    stopLoss: undefined,
    source: undefined,
  });
  assert.equal(hasPrefill(p), false);
});

test("повторяющийся параметр — берём первый", () => {
  assert.equal(parseTradePrefill({ entry: ["1.5", "2"] }).entryPrice, "1.5");
});
