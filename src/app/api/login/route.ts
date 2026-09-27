import { APIError } from "better-auth/api";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { failureDelay } from "@/lib/security/compare";
import { requestInfo } from "@/lib/security/request-info";
import {
  afterSuccess,
  beginAttempt,
  markSuccess,
  onFailure,
  onLocked,
} from "@/lib/security/login-throttle";

const bodySchema = z.object({
  email: z.string().trim().email("Некорректная почта").max(200),
  password: z.string().min(1).max(200),
});

/**
 * Вход по почте и паролю. Пароль проверяет Better Auth (хеш scrypt в таблице
 * authAccount), а вокруг — наш журнал попыток: блокировка перебора по IP и
 * сигналы. Эндпоинт Better Auth /api/auth/sign-in/email закрыт, так что
 * другого пути войти по паролю нет.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = bodySchema.parse(await request.json());
    const info = requestInfo(request);

    const attempt = await beginAttempt(info);
    if (attempt.locked) {
      after(() => onLocked(info));
      const minutes = Math.ceil(attempt.retryAfterSec / 60);
      return NextResponse.json(
        { error: `Слишком много попыток. Попробуй через ${minutes} мин.` },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSec) } },
      );
    }

    try {
      // Cookie сессии ставит плагин nextCookies — они уйдут вместе с ответом.
      await auth.api.signInEmail({
        body: { email, password, rememberMe: true },
        headers: request.headers,
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      // Сигналы — после ответа: Telegram не должен тормозить вход.
      after(() => onFailure(info));
      await failureDelay();
      // Неверная почта и неверный пароль — одно сообщение: иначе по ответу
      // можно выяснять, какие почты зарегистрированы.
      const message =
        error.statusCode === 401
          ? "Неверная почта или пароль"
          : error.statusCode === 403
            ? "Вход для этого пользователя закрыт"
            : "Ошибка входа";
      return NextResponse.json({ error: message }, { status: error.statusCode });
    }

    await markSuccess(attempt.attemptId);
    after(() => afterSuccess(attempt.attemptId, info));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
