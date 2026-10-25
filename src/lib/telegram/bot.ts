/**
 * Клиент Telegram Bot API. Токен — TELEGRAM_BOT_TOKEN (только на проде: на
 * превью и локально бота нет, и вызовы просто пишутся в лог).
 *
 * Бот живёт на тех же функциях Vercel: Telegram сам присылает каждое
 * сообщение на /api/telegram/webhook, постоянный процесс не нужен.
 */
const API = "https://api.telegram.org";
const TIMEOUT_MS = 8_000;

export class TelegramError extends Error {}

export function botConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/** Вызов метода Bot API. Без токена — null и строка в логе. */
export async function callBot<T>(method: string, params: Record<string, unknown> = {}): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn(`[telegram] бот не настроен, пропущен вызов ${method}`);
    return null;
  }
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; description?: string }
    | null;
  if (!data || !data.ok) {
    throw new TelegramError(
      `Telegram ${method}: ${(data && "description" in data && data.description) || response.status}`,
    );
  }
  return data.result;
}

let usernamePromise: Promise<string | null> | null = null;

/** Username бота — спрашиваем у Telegram, чтобы смена бота не требовала правок. */
export function botUsername(): Promise<string | null> {
  usernamePromise ??= callBot<{ username: string }>("getMe")
    .then((me) => me?.username ?? null)
    .catch((error) => {
      usernamePromise = null; // не кешируем ошибку
      throw error;
    });
  return usernamePromise;
}

export function sendMessage(
  chatId: bigint | number | string,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return callBot("sendMessage", {
    chat_id: chatId.toString(),
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  });
}

/** Адрес журнала для ссылок в сообщениях бота. */
export function siteUrl(fallbackOrigin?: string): string {
  return process.env.BETTER_AUTH_URL ?? fallbackOrigin ?? "";
}
