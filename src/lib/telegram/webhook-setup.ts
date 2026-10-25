import { botConfigured, callBot } from "@/lib/telegram/bot";

export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

/**
 * Куда Telegram должен слать сообщения бота. Берём постоянный адрес прода из
 * BETTER_AUTH_URL, а не адрес текущего запроса: у каждого деплоя Vercel есть
 * и свой адрес, и webhook на него замолчал бы после следующего деплоя.
 */
export function webhookUrl(): string | null {
  const base = process.env.BETTER_AUTH_URL;
  return base ? new URL("/api/telegram/webhook", base).toString() : null;
}

/** Зарегистрировать webhook и команды бота. */
export async function connectWebhook(url: string): Promise<WebhookInfo | null> {
  await callBot("setWebhook", {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  await callBot("setMyCommands", { commands: [{ command: "start", description: "Начать" }] });
  return callBot<WebhookInfo>("getWebhookInfo");
}

let ensured = false;

/**
 * Подключить бота, если он ещё не подключён к этому сайту. Вызывается перед
 * привязкой Telegram, чтобы не нужно было помнить про отдельную кнопку.
 * Проверка — раз на запуск функции; ошибки не мешают привязке, только в лог.
 */
export async function ensureWebhook(): Promise<void> {
  if (ensured || !botConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) return;
  const url = webhookUrl();
  if (!url) return;
  try {
    const info = await callBot<WebhookInfo>("getWebhookInfo");
    if (info?.url !== url) await connectWebhook(url);
    ensured = true;
  } catch (error) {
    console.error("[telegram] не удалось подключить бота", error);
  }
}
