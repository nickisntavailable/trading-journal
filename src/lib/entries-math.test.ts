import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageEntry,
  entryForRisk,
  positionFromEntries,
  positionRisk,
  validateEntriesAgainstStop,
} from "@/lib/entries-math";
import { closeTrade, fixGrossPnL } from "@/lib/trading-math";

const close = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// Пример из обсуждения: депозит 10 000, по 0,1 BTC по 60 000 и 61 000.
const A = { price: 60_000, size: 6_000 };
const B = { price: 61_000, size: 6_100 };

test("средний вход — по монетам, а не по долларам", () => {
  close(averageEntry([A, B]), 60_500);
});

test("один вход — те же цифры, что и раньше", () => {
  const p = positionFromEntries([A], 59_000, 1, 10_000);
  close(p.entryPrice, 60_000);
  close(p.positionSize, 6_000);
  close(p.riskAmount, 100);
  close(p.riskPct, 1);
});

test("риск позиции зависит от общего стопа", () => {
  close(positionRisk([A, B], 60_000, 1), 100); // стоп как у B
  close(positionRisk([A, B], 59_000, 1), 300); // стоп как у A — втрое больше
});

test("риск по входам = риск от среднего входа", () => {
  const entries = [A, B, { price: 61_500, size: 4_100 }];
  const avg = averageEntry(entries);
  const qty = entries.reduce((s, e) => s + e.size / e.price, 0);
  close(positionRisk(entries, 60_000, 1), qty * (avg - 60_000));
});

test("добор риском 0,5% от общего стопа", () => {
  const add = entryForRisk(61_500, 60_000, 0.5, 10_000);
  close(add.size / add.price, 50 / 1_500); // $50 риска на 1 500 до стопа
  const p = positionFromEntries([A, B, add], 60_000, 1, 10_000);
  close(p.riskAmount, 150);
  close(p.riskPct, 1.5);
});

test("шорт: средний вход и риск", () => {
  const s1 = { price: 3_000, size: 3_000 }; // 1 ETH
  const s2 = { price: 2_900, size: 2_900 }; // 1 ETH
  close(averageEntry([s1, s2]), 2_950);
  close(positionRisk([s1, s2], 3_100, -1), 100 + 200);
});

test("итог сделки по среднему входу = сумма по отдельным входам", () => {
  const entries = [A, B];
  const avg = averageEntry(entries);
  const size = entries.reduce((s, e) => s + e.size, 0);
  const exit = 63_000;
  const separate = entries.reduce((s, e) => s + fixGrossPnL(e.size, 100, exit, e.price, 1), 0);
  close(fixGrossPnL(size, 100, exit, avg, 1), separate, 1e-6);

  const result = closeTrade(
    {
      entryPrice: avg,
      stopLoss: 60_000,
      direction: 1,
      positionSize: size,
      depositAtEntry: 10_000,
      feeRateAtEntry: 0,
      riskAmount: positionRisk(entries, 60_000, 1),
    },
    [{ price: exit, sizePct: 100 }],
  );
  close(result.grossPnL, separate, 0.01);
});

test("стоп выше первого входа, но ниже среднего — риск меньше, без модуля", () => {
  // Часть A на стопе 60 200 закрывается в плюс: −0,1 × 200 + 0,1 × 800 = 60.
  close(positionRisk([A, B], 60_200, 1), 60);
});

test("стоп проверяется относительно среднего входа", () => {
  assert.equal(validateEntriesAgainstStop([A, B], 60_000, 1), null); // на уровне входа A — можно
  assert.equal(validateEntriesAgainstStop([A, B], 60_200, 1), null); // выше A, ниже средней — можно
  assert.notEqual(validateEntriesAgainstStop([A, B], 60_500, 1), null); // на средней — нельзя
  assert.notEqual(validateEntriesAgainstStop([A, B], 60_700, 1), null); // выше средней — нельзя
  assert.notEqual(validateEntriesAgainstStop([{ price: 3_000, size: 3_000 }], 2_900, -1), null);
});
