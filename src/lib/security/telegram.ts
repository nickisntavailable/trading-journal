import { sendMessage } from "@/lib/telegram/bot";
import { adminTelegramIds } from "@/lib/telegram/link";

/**
 * Сигналы безопасности в Telegram — через бота журнала, тем админам, у
 * которых привязан Telegram (Настройки → Telegram). TELEGRAM_CHAT_ID, если
 * задан, перекрывает это — например, чтобы слать в отдельный чат.
 *
 * Нет бота или получателей — сигнал пишется в лог и молча пропускается:
 * отсутствие бота не должно ломать вход.
 */
export async function sendSecurityAlert(lines: string[]): Promise<void> {
  const text = lines.join("\n");
  try {
    const explicit = process.env.TELEGRAM_CHAT_ID;
    const recipients = explicit ? [explicit] : await adminTelegramIds();
    if (!process.env.TELEGRAM_BOT_TOKEN || recipients.length === 0) {
      console.warn(`security alert (Telegram не настроен):\n${text}`);
      return;
    }
    await Promise.all(
      recipients.map((chatId) =>
        sendMessage(chatId, text).catch((error) =>
          console.error("security alert: не удалось отправить в Telegram", error),
        ),
      ),
    );
  } catch (error) {
    console.error("security alert: не удалось отправить", error);
  }
}

/** Экранирование для parse_mode=HTML: значения приходят из заголовков запроса. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
