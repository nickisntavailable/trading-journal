import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/security/compare";
import { sendMessage, siteUrl } from "@/lib/telegram/bot";
import { parseStart } from "@/lib/telegram/commands";
import { consumeLinkToken, type TelegramUser } from "@/lib/telegram/link";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/security/telegram";

type Update = {
  message?: {
    text?: string;
    from?: TelegramUser & { is_bot?: boolean };
    chat: { id: number; type: string };
  };
};

/**
 * Сюда Telegram присылает каждое сообщение боту (адрес регистрирует кнопка
 * «Подключить бота» в «Пользователях»). Открыт без сессии — проверяется
 * секрет: Telegram кладёт его в заголовок, и чужой запрос его не знает.
 *
 * Отвечаем 200 всегда, даже при ошибке обработки: иначе Telegram будет
 * присылать то же сообщение снова и снова.
 */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secret || !secretsMatch(header, secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const update = (await request.json()) as Update;
    await handleMessage(update, new URL(request.url).origin);
  } catch (error) {
    console.error("[telegram] не удалось обработать сообщение", error);
  }
  return NextResponse.json({ ok: true });
}

async function handleMessage(update: Update, origin: string) {
  const message = update.message;
  // Только личные чаты с живым человеком: группы и другие боты не обслуживаем.
  if (!message?.from || message.from.is_bot || message.chat.type !== "private") return;

  const start = parseStart(message.text);
  if (!start) return;
  const chatId = message.chat.id;

  if (start.kind === "link") {
    const result = await consumeLinkToken(start.token, message.from);
    const text =
      result.status === "linked"
        ? `Готово: Telegram привязан к учётке <b>${escapeHtml(result.email)}</b>. Сюда же будут приходить сигналы безопасности.`
        : result.status === "taken"
          ? "Этот Telegram уже привязан к другой учётке журнала."
          : "Ссылка недействительна или устарела — создай новую в настройках журнала.";
    await sendMessage(chatId, text);
    return;
  }

  const linked = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(message.from.id) },
    select: { id: true },
  });
  const url = siteUrl(origin);
  await sendMessage(
    chatId,
    linked
      ? `Ты уже в журнале: ${escapeHtml(url)}`
      : "Это бот трейд-журнала. Регистрация через бота скоро появится — пока вход по приглашению.",
  );
}
