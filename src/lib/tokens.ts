import { createHash, randomBytes } from "node:crypto";

/**
 * Одноразовые токены для ссылок (приглашение, сброс пароля).
 *
 * Токен — 32 случайных байта, в ссылке в base64url. В базе только SHA-256 от
 * него: подобрать 256 бит нельзя, а утёкшая база не даёт рабочих ссылок.
 * Медленный хеш, как у паролей, здесь не нужен — токен случайный, перебирать
 * по словарю нечего.
 */
export function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
