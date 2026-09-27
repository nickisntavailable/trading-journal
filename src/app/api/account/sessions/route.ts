import { after, NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { auth } from "@/lib/better-auth";
import { requestInfo } from "@/lib/security/request-info";
import { alertSessionsRevoked } from "@/lib/security/account-alerts";

/** «Выйти на остальных устройствах»: удаляет все сессии, кроме текущей. */
export async function DELETE(request: Request) {
  try {
    await auth.api.revokeOtherSessions({ headers: request.headers });
    const info = requestInfo(request);
    after(() => alertSessionsRevoked(info));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
