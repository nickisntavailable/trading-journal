const assert = require("node:assert/strict");
const { test } = require("node:test");
const { computeLevels, computeTick, decimalsOf, journalUrl } = require("./levels.js");

// Настоящие числа с графика владельца: ADAUSDT.P, short от 0,2177,
// на графике «Стоп: 0,0021 (0,965 %) 21», счёт 102, риск 1 %.
const ada = {
  direction: -1,
  entry: 0.2177,
  stopLevel: 21,
  profitLevel: 84,
  accountSize: 102,
  amountStop: 100.98,
  qty: 485.7142857142879,
  formattedSample: "0,1235",
};

test("знаки после запятой из форматтера графика", () => {
  assert.equal(decimalsOf("0,1235"), 4);
  assert.equal(decimalsOf("61 234.5"), 1);
  assert.equal(decimalsOf("61234"), 0);
});

test("ADA short: стоп 0,2198, цель 0,2093", () => {
  const levels = computeLevels(ada);
  assert.equal(levels.tick, 0.0001);
  assert.equal(levels.entry, 0.2177);
  assert.equal(levels.stop, 0.2198);
  assert.equal(levels.target, 0.2093);
});

test("лонг: стоп ниже входа", () => {
  const levels = computeLevels({ ...ada, direction: 1, amountStop: 100.98 });
  assert.equal(levels.stop, 0.2156);
  assert.equal(levels.target, 0.2261);
});

test("кратный шаг цены не теряется (0,005 при трёх знаках)", () => {
  // 10 тиков по 0,005 = 0,05; риск $5 → количество 100.
  const tick = computeTick({ decimals: 3, stopLevel: 10, accountSize: 1000, amountStop: 995, qty: 100 });
  assert.ok(Math.abs(tick - 0.005) < 1e-12);
});

test("округление сумм до центов не сдвигает тик", () => {
  // Маленький риск: $0,13 на 13 тиков по 0,0001 — сумма неточная, тик всё равно 0,0001.
  const tick = computeTick({ decimals: 4, stopLevel: 13, accountSize: 13, amountStop: 12.87, qty: 100.4 });
  assert.equal(tick, 0.0001);
});

test("нет сумм — тик по форматтеру", () => {
  assert.equal(computeTick({ decimals: 2, stopLevel: 5 }), 0.01);
});

test("не хватает данных — null, пункт не показываем", () => {
  assert.equal(computeLevels({ ...ada, entry: undefined }), null);
  assert.equal(computeLevels({ ...ada, stopLevel: 0 }), null);
  assert.equal(computeLevels({ ...ada, direction: 0 }), null);
});

test("ссылка в журнал", () => {
  const url = journalUrl("https://journal.example", "BINANCE:ADAUSDT.P", computeLevels(ada));
  assert.equal(
    url,
    "https://journal.example/trades/new?pair=BINANCE%3AADAUSDT.P&side=short&entry=0.2177&stop=0.2198&source=tv",
  );
});
