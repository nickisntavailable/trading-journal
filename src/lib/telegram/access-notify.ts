import type { AccessRequest } from "@prisma/client";
import { requestText } from "@/lib/telegram/access";
import { callBot, sendMessage } from "@/lib/telegram/bot";
import { accessCallback } from "@/lib/telegram/commands";
import { adminTelegramIds } from "@/lib/telegram/link";
import { miniAppUrl } from "@/lib/telegram/webhook-setup";

/** Кнопка «Открыть журнал» под сообщением — открывает Mini App. */
export function openJournalButton(fallbackOrigin: string) {
  const url = miniAppUrl() ?? new URL("/?tgapp=1", fallbackOrigin).toString();
  return {
    reply_markup: { inline_keyboard: [[{ text: "Открыть журнал", web_app: { url } }]] },
  };
}

/** Новая заявка — всем админам с привязанным Telegram, с кнопками решения. */
export async function notifyAdminsOfRequest(request: AccessRequest): Promise<void> {
  const admins = await adminTelegramIds();
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Пустить", callback_data: accessCallback("approve", request.id) },
          { text: "Отклонить", callback_data: accessCallback("reject", request.id) },
        ],
      ],
    },
  };
  await Promise.all(
    admins.map((chatId) =>
      sendMessage(chatId, requestText(request), keyboard).catch((error) =>
        console.error("[telegram] не удалось отправить заявку админу", error),
      ),
    ),
  );
}

/** Сообщить человеку о решении. */
export async function notifyApplicant(
  request: AccessRequest,
  result: "approved" | "rejected",
  fallbackOrigin: string,
): Promise<void> {
  if (result === "approved") {
    await sendMessage(
      request.telegramId,
      "Доступ к журналу открыт. Журнал — кнопкой ниже или «Журнал» в меню бота.",
      openJournalButton(fallbackOrigin),
    );
  } else {
    await sendMessage(request.telegramId, "Доступ к журналу не выдан.");
  }
}

/** Ответ на нажатие кнопки (всплывашка у нажавшего) и правка сообщения заявки. */
export async function closeRequestMessage(
  callbackId: string,
  toast: string,
  message: { chatId: number; messageId: number } | null,
  text: string,
): Promise<void> {
  await callBot("answerCallbackQuery", { callback_query_id: callbackId, text: toast });
  if (message) {
    // Без кнопок — решённую заявку уже не нажать.
    await callBot("editMessageText", {
      chat_id: message.chatId,
      message_id: message.messageId,
      text,
      parse_mode: "HTML",
    });
  }
}
