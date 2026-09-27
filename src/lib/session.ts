import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/better-auth";

/**
 * Текущая сессия. `cache` — чтобы страница и её хелперы в рамках одного
 * запроса не проверяли сессию по нескольку раз.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

/** Запрос без сессии. API превращает её в 401. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Не авторизован");
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session.user;
}

/**
 * Активные сессии пользователя — для списка устройств в настройках.
 * Свежие сверху; текущую страница помечает по id.
 */
export async function listUserSessions() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  const sessions = await auth.api.listSessions({ headers: await headers() });
  sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { user: session.user, sessions, currentSessionId: session.session.id };
}
