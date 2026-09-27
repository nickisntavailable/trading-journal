import { NextResponse } from "next/server";
import { auth } from "@/lib/better-auth";
import { handleError } from "@/lib/api";

/** Выход: сессия удаляется из базы, cookie стираются (через nextCookies). */
export async function POST(request: Request) {
  try {
    await auth.api.signOut({ headers: request.headers });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
