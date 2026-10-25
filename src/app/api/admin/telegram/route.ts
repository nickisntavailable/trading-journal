import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { botConfigured, botUsername, callBot, TelegramError } from "@/lib/telegram/bot";

type WebhookInfo = { url: string; pending_update_count: number; last_error_message?: string };

/** Состояние бота: подключён ли webhook и куда. */
export async function GET() {
  try {
    await requireAdmin();
    if (!botConfigured()) return NextResponse.json({ configured: false });
    const [username, info] = await Promise.all([
      botUsername(),
      callBot<WebhookInfo>("getWebhookInfo"),
    ]);
    return NextResponse.json({ configured: true, username, webhook: info });
  } catch (error) {
    if (error instanceof TelegramError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleError(error);
  }
}

/**
 * «Подключить бота»: говорим Telegram, куда слать сообщения (этот же сайт),
 * с секретом в заголовке, и задаём команды в меню бота. Нажимать на проде —
 * адрес берётся из текущего запроса.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!botConfigured() || !secret) {
      return NextResponse.json(
        { error: "Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET" },
        { status: 400 },
      );
    }
    const url = new URL("/api/telegram/webhook", request.url).toString();
    await callBot("setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    await callBot("setMyCommands", {
      commands: [{ command: "start", description: "Начать" }],
    });
    const info = await callBot<WebhookInfo>("getWebhookInfo");
    return NextResponse.json({ ok: true, webhook: info });
  } catch (error) {
    if (error instanceof TelegramError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return handleError(error);
  }
}
