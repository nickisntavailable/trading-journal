import { botConfigured, callBot } from "@/lib/telegram/bot";

export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

type MenuButton = { type: string; text?: string; web_app?: { url: string } };

/**
 * Постоянный адрес прода из BETTER_AUTH_URL, а не адрес текущего запроса: у
 * каждого деплоя Vercel есть и свой адрес, и бот, привязанный к нему,
 * замолчал бы после следующего деплоя.
 */
function siteBase(): string | null {
  return process.env.BETTER_AUTH_URL ?? null;
}

/** Куда Telegram шлёт сообщения бота. */
export function webhookUrl(): string | null {
  const base = siteBase();
  return base ? new URL("/api/telegram/webhook", base).toString() : null;
}

/**
 * Куда ведёт кнопка «Журнал» в боте — сразу в журнал, с меткой tgapp: с живой
 * сессией он откроется мгновенно, без промежуточной страницы входа.
 */
export function miniAppUrl(): string | null {
  const base = siteBase();
  return base ? new URL("/?tgapp=1", base).toString() : null;
}

/** Зарегистрировать webhook, команды и кнопку «Журнал» в меню бота. */
export async function connectWebhook(url: string): Promise<WebhookInfo | null> {
  await callBot("setWebhook", {
    url,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
  });
  await callBot("setMyCommands", { commands: [{ command: "start", description: "Начать" }] });
  const appUrl = miniAppUrl() ?? new URL("/?tgapp=1", url).toString();
  await callBot("setChatMenuButton", {
    menu_button: { type: "web_app", text: "Журнал", web_app: { url: appUrl } },
  });
  return callBot<WebhookInfo>("getWebhookInfo");
}

let ensured = false;

/**
 * Подключить бота, если он ещё не подключён к сайту: webhook и кнопка
 * «Журнал». Вызывается перед привязкой Telegram и на входящих сообщениях,
 * чтобы не нужно было помнить про отдельную кнопку. Проверка — раз на запуск
 * функции; ошибки не мешают основному делу, только в лог.
 */
export async function ensureWebhook(): Promise<void> {
  if (ensured || !botConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) return;
  const url = webhookUrl();
  const appUrl = miniAppUrl();
  if (!url || !appUrl) return;
  try {
    const [info, menu] = await Promise.all([
      callBot<WebhookInfo>("getWebhookInfo"),
      callBot<MenuButton>("getChatMenuButton"),
    ]);
    if (info?.url !== url || menu?.web_app?.url !== appUrl) await connectWebhook(url);
    ensured = true;
  } catch (error) {
    console.error("[telegram] не удалось подключить бота", error);
  }
}
