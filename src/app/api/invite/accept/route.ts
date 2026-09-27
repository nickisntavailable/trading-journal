import { after, NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { acceptInvite, InviteError } from "@/lib/invites";
import { alertNewUser } from "@/lib/security/account-alerts";
import { requestInfo } from "@/lib/security/request-info";

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8, "Пароль — минимум 8 символов").max(128),
});

/**
 * Принятие приглашения: учётка на почту из приглашения и сразу вход.
 * Открыт без сессии (исключён в proxy.ts) — пускает сама ссылка.
 */
export async function POST(request: Request) {
  try {
    const { token, password } = bodySchema.parse(await request.json());
    const { email } = await acceptInvite(token, password);

    const info = requestInfo(request);
    after(() => alertNewUser(email, info));

    // Cookie сессии поставит nextCookies.
    await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: request.headers,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
