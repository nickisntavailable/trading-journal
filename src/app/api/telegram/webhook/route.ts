import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretsMatch } from "@/lib/security/compare";
import { escapeHtml } from "@/lib/security/telegram";
import { adminByTelegram, decideAccess, requestAccess, requestText } from "@/lib/telegram/access";
import {
  closeRequestMessage,
  notifyAdminsOfRequest,
  notifyApplicant,
  openJournalButton,
} from "@/lib/telegram/access-notify";
import { sendMessage } from "@/lib/telegram/bot";
import { parseAccessCallback, parseStart } from "@/lib/telegram/commands";
import { consumeLinkToken, type TelegramUser } from "@/lib/telegram/link";
import { ensureWebhook } from "@/lib/telegram/webhook-setup";

/**
 * Сообщения бота независимы друг от друга: если не дошло одно (Telegram
 * отклонил ответ на старое нажатие, человек заблокировал бота), остальные
 * всё равно уходят — иначе, например, заявитель не узнал бы, что его пустили.
 */
function quietly(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => undefined,
    (error) => console.error("[telegram] сообщение не отправлено", error),
  );
}

type Update = {
  message?: {
    text?: string;
    from?: TelegramUser & { is_bot?: boolean };
    chat: { id: number; type: string };
  };
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

/**
 * Сюда Telegram присылает каждое сообщение боту и нажатия кнопок под его
 * сообщениями. Открыт без сессии — проверяется секрет: Telegram кладёт его в
 * заголовок, и чужой запрос его не знает.
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

  // Кнопка «Журнал» в меню и webhook — на месте ли (раз на запуск функции).
  after(() => ensureWebhook());

  try {
    const update = (await request.json()) as Update;
    const origin = new URL(request.url).origin;
    if (update.callback_query) await handleCallback(update.callback_query, origin);
    else await handleMessage(update, origin);
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
    await quietly(sendMessage(chatId, text, result.status === "linked" ? openJournalButton(origin) : {}));
    return;
  }

  const linked = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(message.from.id) },
    select: { id: true },
  });
  if (linked) {
    await quietly(
      sendMessage(chatId, "Журнал — кнопкой ниже или «Журнал» в меню бота.", openJournalButton(origin)),
    );
    return;
  }

  // Незнакомый Telegram — заявка на доступ, решает админ.
  const result = await requestAccess(message.from);
  const reply = {
    created: "Это бот трейд-журнала. Заявка на доступ отправлена — напишу, когда её рассмотрят.",
    pending: "Заявка уже у админа — напишу, когда её рассмотрят.",
    rejected: "Доступ к журналу не выдан.",
    approved: "Доступ уже открыт — нажми /start ещё раз.",
  }[result.status];
  await Promise.all([
    quietly(sendMessage(chatId, reply)),
    result.status === "created" ? quietly(notifyAdminsOfRequest(result.request)) : undefined,
  ]);
}

async function handleCallback(query: NonNullable<Update["callback_query"]>, origin: string) {
  const parsed = parseAccessCallback(query.data);
  if (!parsed) return;
  const message = query.message
    ? { chatId: query.message.chat.id, messageId: query.message.message_id }
    : null;

  const adminId = await adminByTelegram(BigInt(query.from.id));
  if (!adminId) {
    await quietly(closeRequestMessage(query.id, "Решать заявки может только админ", null, ""));
    return;
  }

  const decision = await decideAccess(parsed.requestId, parsed.decision, adminId);
  if (decision.result === "already") {
    const status = decision.request?.status === "approved" ? "✅ Пущен" : "Отклонена";
    await quietly(
      closeRequestMessage(
        query.id,
        "Уже решено",
        message,
        decision.request ? requestText(decision.request, status) : "Заявка не найдена",
      ),
    );
    return;
  }

  const approved = decision.result === "approved";
  await Promise.all([
    quietly(
      closeRequestMessage(
        query.id,
        approved ? "Пущен" : "Отклонена",
        message,
        requestText(decision.request, approved ? "✅ Пущен" : "Отклонена"),
      ),
    ),
    quietly(notifyApplicant(decision.request, decision.result, origin)),
  ]);
}
