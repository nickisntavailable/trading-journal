import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return new NextResponse("APP_PASSWORD не задан", { status: 500 });
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const expected = await sessionToken(appPassword);

  if (cookie && safeEqual(cookie, expected)) {
    return NextResponse.next();
  }

  // API отвечает 401, страницы — редиректом на /login
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const from = request.nextUrl.pathname + request.nextUrl.search;
  if (from !== "/") loginUrl.searchParams.set("from", from);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Всё, кроме:
     * - /login и /api/login
     * - статики Next и favicon
     */
    "/((?!login|api/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
