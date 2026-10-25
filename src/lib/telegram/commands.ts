/**
 * Разбор входящих сообщений бота — без сети и базы, покрыто тестами.
 */
export type StartCommand =
  | { kind: "link"; token: string }
  | { kind: "plain" };

/**
 * «/start» и «/start link_<токен>». Telegram присылает payload ссылки
 * t.me/<бот>?start=<payload> текстом после команды; в группах команда может
 * прийти как «/start@имя_бота». Payload — только [A-Za-z0-9_-], до 64 символов.
 */
export function parseStart(text: string | undefined): StartCommand | null {
  const match = text?.trim().match(/^\/start(?:@\w+)?(?:\s+(\S+))?$/);
  if (!match) return null;
  const payload = match[1];
  const link = payload?.match(/^link_([A-Za-z0-9_-]{20,58})$/);
  if (link) return { kind: "link", token: link[1] };
  return { kind: "plain" };
}
