import { APIError } from "better-auth/api";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { failureDelay } from "@/lib/security/compare";
import { requestInfo } from "@/lib/security/request-info";
import { beginAttempt, markSuccess, onFailure, onLocked } from "@/lib/security/login-throttle";
import { alertPasswordChanged } from "@/lib/security/account-alerts";

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, "Новый пароль — минимум 8 символов").max(128),
});

/**
 * Смена пароля. Текущий пароль — это тоже проверка пароля, поэтому её
 * прикрывает тот же журнал попыток, что и вход: укравший сессию не сможет
 * подбирать текущий пароль, чтобы сменить его и забрать учётку.
 *
 * Остальные сессии при смене удаляются: если пароль меняют из-за утечки,
 * тот, кто им воспользовался, должен вылететь.
 */
export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = bodySchema.parse(await request.json());
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
      // Better Auth удалит все сессии и выдаст этому устройству новую —
      // её cookie поставит nextCookies.
      await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: request.headers,
      });
    } catch (error) {
      if (!(error instanceof APIError) || error.body?.code !== "INVALID_PASSWORD") throw error;
      after(() => onFailure(info));
      await failureDelay();
      return NextResponse.json({ error: "Текущий пароль неверный" }, { status: 400 });
    }

    await markSuccess(attempt.attemptId);
    after(() => alertPasswordChanged(info));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
