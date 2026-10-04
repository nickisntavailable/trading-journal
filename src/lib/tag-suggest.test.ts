import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestTags } from "@/lib/tag-suggest";

const tag = (name: string, archived = false) => ({ id: name, name, archived });
const names = (note: string, tags = TAGS, selected: string[] = []) =>
  suggestTags(note, tags, selected).map((t) => t.name);

const TAGS = [
  tag("fvg"),
  tag("ob"),
  tag("cme"),
  tag("дивергенция"),
  tag("дивер"),
  tag("ликвидность"),
  tag("order block"),
  tag("сессия азии"),
  tag("старый", true),
];

test("регистр не важен", () => {
  assert.deepEqual(names("Вход от FVG на 1h"), ["fvg"]);
});

test("короткий тег — только целым словом", () => {
  assert.deepEqual(names("observe, robot, obvious"), []);
  assert.deepEqual(names("вход от ob, потом cme-гэп"), ["ob", "cme"]);
  assert.deepEqual(names("ob."), ["ob"]);
});

test("длинный тег находится в другой форме слова", () => {
  assert.deepEqual(names("Были дивергенции на RSI"), ["дивергенция", "дивер"]);
  assert.deepEqual(names("сняли ликвидности под минимумом"), ["ликвидность"]);
});

test("тег должен начинаться с начала слова", () => {
  assert.deepEqual(names("суперликвидность"), []);
});

test("теги из нескольких слов — любое число пробелов", () => {
  assert.deepEqual(names("от order   block на 4h"), ["order block"]);
  assert.deepEqual(names("в сессию азии"), ["сессия азии"]);
});

test("отмеченные и архивные не подсказываются", () => {
  assert.deepEqual(names("fvg и ob", TAGS, ["fvg"]), ["ob"]);
  assert.deepEqual(names("старый уровень"), []);
});

test("спецсимволы в имени тега не ломают поиск", () => {
  const tags = [tag("s&p"), tag("1:2"), tag("(x)")];
  assert.deepEqual(names("s&p и 1:2 и (x)", tags), ["s&p", "1:2", "(x)"]);
});

test("пустая заметка — без подсказок", () => {
  assert.deepEqual(names("   "), []);
});
