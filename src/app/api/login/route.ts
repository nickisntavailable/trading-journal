import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { handleError } from "@/lib/api";

const bodySchema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      return NextResponse.json({ error: "APP_PASSWORD не задан" }, { status: 500 });
    }

    const { password } = bodySchema.parse(await request.json());
    if (password !== appPassword) {
      return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
    }

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
