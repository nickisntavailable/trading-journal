import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { ResetError, resetPassword } from "@/lib/password-reset";
import { alertPasswordReset } from "@/lib/security/account-alerts";
import { requestInfo } from "@/lib/security/request-info";

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8, "Пароль — минимум 8 символов").max(128),
});

/**
 * Новый пароль по ссылке от админа и сразу вход.
 * Открыт без сессии (исключён в proxy.ts) — пускает сама ссылка.
 */
export async function POST(request: Request) {
  try {
    const { token, password } = bodySchema.parse(await request.json());
    const { email } = await resetPassword(token, password);

    const info = requestInfo(request);
    after(() => alertPasswordReset(email, info));

    await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: request.headers,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ResetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
