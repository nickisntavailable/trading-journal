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

/** Сессия есть, но прав не хватает. API превращает её в 403. */
export class ForbiddenError extends Error {
  constructor() {
    super("Недостаточно прав");
  }
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new ForbiddenError();
  return user;
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
