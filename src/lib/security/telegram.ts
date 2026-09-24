/**
 * Сигналы безопасности в Telegram.
 *
 * Бот создаётся через @BotFather, токен и id чата кладутся в TELEGRAM_BOT_TOKEN
 * и TELEGRAM_CHAT_ID. Если переменных нет — сигнал пишется в лог и молча
 * пропускается: отсутствие бота не должно ломать вход.
 */
const TIMEOUT_MS = 5_000;

export async function sendSecurityAlert(lines: string[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const text = lines.join("\n");

  if (!token || !chatId) {
    console.warn(`security alert (Telegram не настроен):\n${text}`);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("security alert: Telegram ответил", response.status, await response.text());
    }
  } catch (error) {
    console.error("security alert: не удалось отправить в Telegram", error);
  }
}

/** Экранирование для parse_mode=HTML: значения приходят из заголовков запроса. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
