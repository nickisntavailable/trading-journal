import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStart } from "@/lib/telegram/commands";

const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcd"; // 43 символа, как наш base64url

test("ссылка привязки", () => {
  assert.deepEqual(parseStart(`/start link_${token}`), { kind: "link", token });
  assert.deepEqual(parseStart(`/start@trading_journal_crypto_dan_bot link_${token}`), {
    kind: "link",
    token,
  });
});

test("просто /start", () => {
  assert.deepEqual(parseStart("/start"), { kind: "plain" });
  assert.deepEqual(parseStart("  /start  "), { kind: "plain" });
  assert.deepEqual(parseStart("/start something"), { kind: "plain" });
});

test("мусор в payload не принимается за привязку", () => {
  assert.deepEqual(parseStart("/start link_short"), { kind: "plain" });
  assert.deepEqual(parseStart("/start link_<script>alert(1)</script>"), { kind: "plain" });
});

test("не команда start", () => {
  assert.equal(parseStart("привет"), null);
  assert.equal(parseStart("/help"), null);
  assert.equal(parseStart(undefined), null);
  assert.equal(parseStart("/started"), null);
});
