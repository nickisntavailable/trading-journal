import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handleError, notFound } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { attachOwnerAccount, setupAvailable } from "@/lib/owner-setup";
import { failureDelay, secretsMatch } from "@/lib/security/compare";
import { requestInfo } from "@/lib/security/request-info";
import {
  afterSuccess,
  beginAttempt,
  markSuccess,
  onFailure,
  onLocked,
} from "@/lib/security/login-throttle";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректная почта").max(200),
  password: z.string().min(8, "Пароль — минимум 8 символов").max(128),
  appPassword: z.string().min(1).max(200),
});

/** Создание владельца. Подробности — в src/lib/owner-setup.ts. */
export async function POST(request: Request) {
  try {
    if (!(await setupAvailable())) return notFound();

    const body = bodySchema.parse(await request.json());
    const info = requestInfo(request);

    // APP_PASSWORD здесь всё ещё пароль, поэтому та же защита от перебора, что и у входа.
    const attempt = await beginAttempt(info);
    if (attempt.locked) {
      after(() => onLocked(info));
      const minutes = Math.ceil(attempt.retryAfterSec / 60);
      return NextResponse.json(
        { error: `Слишком много попыток. Попробуй через ${minutes} мин.` },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSec) } },
      );
    }

    const ownerEmail = process.env.OWNER_EMAIL!.trim().toLowerCase();
    // Проверяем оба значения всегда, без раннего выхода, и отвечаем одинаково:
    // по ответу нельзя понять, что именно не подошло.
    const emailOk = secretsMatch(body.email, ownerEmail);
    const appPasswordOk = secretsMatch(body.appPassword, process.env.APP_PASSWORD!);
    if (!emailOk || !appPasswordOk) {
      after(() => onFailure(info));
      await failureDelay();
      return NextResponse.json(
        { error: "Почта или текущий пароль не подходят" },
        { status: 401 },
      );
    }

    // Уникальный email в таблице user не даст создать владельца дважды,
    // даже если две вкладки отправят форму одновременно.
    const { user } = await auth.api.createUser({
      body: {
        email: ownerEmail,
        password: body.password,
        name: ownerEmail.split("@")[0],
        role: "admin",
        data: { canParseScreenshots: true },
      },
    });
    await attachOwnerAccount(user.id);

    await markSuccess(attempt.attemptId);
    after(() => afterSuccess(attempt.attemptId, info));

    // Сразу входим — cookie сессии поставит nextCookies.
    await auth.api.signInEmail({
      body: { email: ownerEmail, password: body.password, rememberMe: true },
      headers: request.headers,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
