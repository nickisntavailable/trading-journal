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

/**
 * Нажатие кнопки под сообщением бота: «ar:a:<id>» — пустить, «ar:r:<id>» —
 * отклонить заявку. callback_data в Telegram — до 64 байт.
 */
export type AccessCallback = { decision: "approve" | "reject"; requestId: string };

export function parseAccessCallback(data: string | undefined): AccessCallback | null {
  const match = data?.match(/^ar:([ar]):([a-z0-9]{10,40})$/);
  if (!match) return null;
  return { decision: match[1] === "a" ? "approve" : "reject", requestId: match[2] };
}

export function accessCallback(decision: "approve" | "reject", requestId: string): string {
  return `ar:${decision === "approve" ? "a" : "r"}:${requestId}`;
}
