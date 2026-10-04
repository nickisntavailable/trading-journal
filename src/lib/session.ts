import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";

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
 *
 * Читаем из базы напрямую, а не через auth.api.listSessions: тот требует
 * «свежую» сессию — вход не раньше суток назад (freshAge). Живая, но
 * вчерашняя сессия получала 403, и /settings падал с 500. Для показа своих
 * же устройств такая строгость не нужна.
 */
export async function listUserSessions() {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  const sessions = await prisma.session.findMany({
    where: { userId: session.user.id, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { user: session.user, sessions, currentSessionId: session.session.id };
}
