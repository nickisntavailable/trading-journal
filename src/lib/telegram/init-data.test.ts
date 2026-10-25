import assert from "node:assert/strict";
import { test } from "node:test";
import { signInitDataForTest, verifyInitData } from "@/lib/telegram/init-data";

const TOKEN = "123456:TEST-token";
const NOW = 1_800_000_000;
const user = JSON.stringify({ id: 4242, username: "dan", first_name: "Dan" });
const base = { auth_date: String(NOW - 60), query_id: "AAE1", user };

test("подписанные Telegram данные принимаются", () => {
  const result = verifyInitData(signInitDataForTest(base, TOKEN), TOKEN, NOW);
  assert.deepEqual(result, { ok: true, user: JSON.parse(user), authDate: NOW - 60 });
});

test("с полем signature тоже", () => {
  const withSignature = { ...base, signature: "ed25519-sig" };
  assert.equal(verifyInitData(signInitDataForTest(withSignature, TOKEN), TOKEN, NOW).ok, true);
});

test("чужой токен — отказ", () => {
  const result = verifyInitData(signInitDataForTest(base, TOKEN), "999:other", NOW);
  assert.deepEqual(result, { ok: false, reason: "signature" });
});

test("подменённый пользователь — отказ", () => {
  const signed = new URLSearchParams(signInitDataForTest(base, TOKEN));
  signed.set("user", JSON.stringify({ id: 1, username: "evil" }));
  assert.deepEqual(verifyInitData(signed.toString(), TOKEN, NOW), { ok: false, reason: "signature" });
});

test("старые данные — отказ", () => {
  const old = { ...base, auth_date: String(NOW - 2 * 24 * 60 * 60) };
  assert.deepEqual(verifyInitData(signInitDataForTest(old, TOKEN), TOKEN, NOW), {
    ok: false,
    reason: "expired",
  });
});

test("без подписи и без пользователя", () => {
  assert.deepEqual(verifyInitData("auth_date=1&user=%7B%7D", TOKEN, NOW), { ok: false, reason: "missing" });
  const noUser = { auth_date: String(NOW), query_id: "x" };
  assert.deepEqual(verifyInitData(signInitDataForTest(noUser, TOKEN), TOKEN, NOW), {
    ok: false,
    reason: "user",
  });
});
