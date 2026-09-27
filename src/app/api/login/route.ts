import { createHash, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { handleError } from "@/lib/api";
import { requestInfo } from "@/lib/security/request-info";
import {
  afterSuccess,
  beginAttempt,
  markSuccess,
  onFailure,
  onLocked,
} from "@/lib/security/login-throttle";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

/** Задержка на неверный пароль: перебору медленнее, человеку незаметно. */
const FAILURE_DELAY_MS = 500;

/**
 * Сравнение за постоянное время. Обычное `===` выходит на первом несовпавшем
 * символе, и по времени ответа можно угадывать пароль посимвольно. Хешируем
 * оба значения, чтобы сравнивать строки одинаковой длины.
 */
function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      return NextResponse.json({ error: "APP_PASSWORD не задан" }, { status: 500 });
    }

    const { password } = bodySchema.parse(await request.json());
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

    if (!passwordMatches(password, appPassword)) {
      // Сигналы — после ответа: Telegram не должен тормозить вход.
      after(() => onFailure(info));
      await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
      return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
    }

    await markSuccess(attempt.attemptId);
    after(() => afterSuccess(attempt.attemptId, info));

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await sessionToken(appPassword), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return response;
  } catch (error) {
    return handleError(error);
  }
}
