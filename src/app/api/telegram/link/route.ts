import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { botConfigured, botUsername } from "@/lib/telegram/bot";
import { createLinkToken, unlinkTelegram } from "@/lib/telegram/link";
import { ensureWebhook } from "@/lib/telegram/webhook-setup";

/** Привязан ли Telegram — настройки опрашивают это, пока открыта ссылка на бота. */
export async function GET() {
  try {
    const user = await requireUser();
    const account = await prisma.telegramAccount.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return NextResponse.json({ linked: Boolean(account) });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Одноразовая ссылка на бота для привязки Telegram к текущей учётке. Заодно
 * проверяем, что бот подключён к сайту: иначе Telegram не перешлёт Start.
 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!botConfigured()) {
      return NextResponse.json({ error: "Бот не настроен" }, { status: 400 });
    }
    const [username] = await Promise.all([botUsername(), ensureWebhook()]);
    if (!username) return NextResponse.json({ error: "Бот не отвечает" }, { status: 502 });

    const token = await createLinkToken(user.id);
    return NextResponse.json({ url: `https://t.me/${username}?start=link_${token}` });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await unlinkTelegram(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
