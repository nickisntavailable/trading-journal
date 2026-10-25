import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Проверка initData — данных, которые Telegram передаёт Mini App.
 *
 * По документации Telegram: data-check-string — все поля, кроме hash,
 * отсортированные по ключу, «key=value» через перевод строки; secret_key =
 * HMAC-SHA256(ключ "WebAppData", сообщение = токен бота); подпись =
 * hex(HMAC-SHA256(ключ secret_key, сообщение = data-check-string)).
 *
 * Про поле signature (появилось в Bot API 8.0) документация молчит, входит ли
 * оно в строку. Пробуем оба варианта: безопасность не страдает — любой из них
 * подписан токеном бота, без токена не подделать.
 *
 * auth_date — когда открыто приложение. Старые данные не принимаем, чтобы
 * перехваченную строку нельзя было использовать бесконечно.
 */
export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

export type TelegramInitUser = { id: number; username?: string; first_name?: string };

export type InitDataResult =
  | { ok: true; user: TelegramInitUser; authDate: number }
  | { ok: false; reason: "missing" | "signature" | "expired" | "user" };

function sign(fields: [string, string][], botToken: string): string {
  const dataCheckString = fields
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString).digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function verifyInitData(
  initData: string,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): InitDataResult {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "missing" };

  const fields = [...params.entries()].filter(([key]) => key !== "hash");
  const valid =
    sameHex(sign([...fields], botToken), hash) ||
    sameHex(sign(fields.filter(([key]) => key !== "signature"), botToken), hash);
  if (!valid) return { ok: false, reason: "signature" };

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowSec - authDate > INIT_DATA_MAX_AGE_SEC) {
    return { ok: false, reason: "expired" };
  }

  try {
    const user = JSON.parse(params.get("user") ?? "null") as TelegramInitUser | null;
    if (!user || typeof user.id !== "number") return { ok: false, reason: "user" };
    return { ok: true, user, authDate };
  } catch {
    return { ok: false, reason: "user" };
  }
}

/** Подписать initData — только для тестов. */
export function signInitDataForTest(fields: Record<string, string>, botToken: string): string {
  const entries = Object.entries(fields);
  const params = new URLSearchParams(entries);
  params.set("hash", sign(entries, botToken));
  return params.toString();
}
