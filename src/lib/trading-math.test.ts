import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closeTrade,
  fixNetPnL,
  positionSize,
  positionSizeWithFees,
  stopLossBreakdown,
} from "@/lib/trading-math";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// Сделка владельца: BTCUSDT short 83 883 → стоп 84 035 (0,18%), риск $1,09.
const BTC = { entry: 83_883, stop: 84_035, risk: 1.09 };

test("без учёта комиссий на коротком стопе уходит заметно больше риска", () => {
  const size = positionSize(BTC.risk, BTC.entry, BTC.stop);
  close(size, 601.53, 0.01);
  const loss = stopLossBreakdown(size, BTC.entry, BTC.stop, 0.05, 0.05);
  close(loss.price, 1.09, 1e-9);
  assert.ok(loss.feesShare > 0.35, `комиссии ${loss.feesShare}`);
});

test("с учётом комиссий на стопе уходит ровно риск", () => {
  const size = positionSizeWithFees(BTC.risk, BTC.entry, BTC.stop, 0.05, 0.05);
  assert.ok(size < 400 && size > 350, `позиция ${size}`);
  const loss = stopLossBreakdown(size, BTC.entry, BTC.stop, 0.05, 0.05);
  close(loss.total, BTC.risk, 1e-9);
  close(loss.price + loss.fees, loss.total, 1e-12);
});

test("вход лимиткой — меньше комиссия и больше позиция на тот же риск", () => {
  const market = positionSizeWithFees(100, 60_000, 59_400, 0.05, 0.05);
  const limit = positionSizeWithFees(100, 60_000, 59_400, 0.02, 0.05);
  assert.ok(limit > market);
  close(stopLossBreakdown(limit, 60_000, 59_400, 0.02, 0.05).total, 100, 1e-9);
});

test("сделка, выбитая по стопу, — ровно −1R вместе с комиссиями", () => {
  const entry = 60_000;
  const stop = 59_400;
  const size = positionSizeWithFees(100, entry, stop, 0.05, 0.05);
  const result = closeTrade(
    {
      entryPrice: entry,
      stopLoss: stop,
      direction: 1,
      positionSize: size,
      depositAtEntry: 10_000,
      entryFeeAmount: (size * 0.05) / 100,
      makerFeePct: 0.02,
      takerFeePct: 0.05,
      riskAmount: 100,
    },
    [{ price: stop, sizePct: 100, orderType: "market" }],
  );
  close(result.netPnL, -100, 1e-9);
  close(result.realizedRR, -1, 1e-12);
});

test("фиксация лимиткой платит maker, рынком — taker, от цены выхода", () => {
  const trade = {
    entryPrice: 100,
    direction: 1 as const,
    positionSize: 1_000,
    entryFeeAmount: 0,
    makerFeePct: 0.02,
    takerFeePct: 0.05,
  };
  // Выход на 110: номинал выхода 1 100.
  close(fixNetPnL(trade, { price: 110, sizePct: 100, orderType: "limit" }), 100 - 0.22);
  close(fixNetPnL(trade, { price: 110, sizePct: 100, orderType: "market" }), 100 - 0.55);
  close(fixNetPnL(trade, { price: 110, sizePct: 100 }), 100 - 0.55); // старые — рынок
});

test("при равных ставках maker = taker старые сделки считаются как раньше", () => {
  const old = {
    entryPrice: 100,
    direction: 1 as const,
    positionSize: 1_000,
    entryFeeAmount: 0.6,
    makerFeePct: 0.06,
    takerFeePct: 0.06,
  };
  close(
    fixNetPnL(old, { price: 100, sizePct: 100, orderType: "limit" }),
    fixNetPnL(old, { price: 100, sizePct: 100, orderType: "market" }),
  );
  close(fixNetPnL(old, { price: 100, sizePct: 100 }), -1.2); // как б/у раньше: 0,6 + 0,6
});
