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
