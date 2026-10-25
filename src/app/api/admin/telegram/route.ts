import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { botConfigured, botUsername, callBot, TelegramError } from "@/lib/telegram/bot";
import { connectWebhook, webhookUrl, type WebhookInfo } from "@/lib/telegram/webhook-setup";

/** Состояние бота: подключён ли webhook и куда. */
export async function GET() {
  try {
    await requireAdmin();
    if (!botConfigured()) return NextResponse.json({ configured: false });
    const [username, info] = await Promise.all([
      botUsername(),
      callBot<WebhookInfo>("getWebhookInfo"),
    ]);
    return NextResponse.json({ configured: true, username, webhook: info, expectedUrl: webhookUrl() });
  } catch (error) {
    if (error instanceof TelegramError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleError(error);
  }
}

/**
 * «Подключить заново» — ручной запасной путь: обычно бот подключается сам при
 * первой привязке Telegram (ensureWebhook). Адрес — постоянный адрес прода из
 * BETTER_AUTH_URL, а без него — адрес текущего запроса.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    if (!botConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET" },
        { status: 400 },
      );
    }
    const url = webhookUrl() ?? new URL("/api/telegram/webhook", request.url).toString();
    const info = await connectWebhook(url);
    return NextResponse.json({ ok: true, webhook: info });
  } catch (error) {
    if (error instanceof TelegramError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleError(error);
  }
}
