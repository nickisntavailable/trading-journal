import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/better-auth";

/**
 * Пропускает дальше только запросы с живой сессией.
 *
 * С Next 16 это proxy.ts (бывший middleware.ts) и он работает в Node.js, а не
 * в урезанном edge-рантайме, — поэтому здесь можно проверить сессию целиком,
 * а не только наличие cookie. Подделанная cookie не пройдёт: подпись
 * проверяется секретом BETTER_AUTH_SECRET, а сама сессия ищется в базе — так
 * удалённая сессия (выход, смена пароля) перестаёт работать сразу.
 */
export async function proxy(request: NextRequest) {
  const { response: session, headers } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  if (session) {
    const response = NextResponse.next();
    // Проверка могла продлить сессию — отдаём обновлённые cookie.
    for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
    return response;
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
     * - входа и первой настройки: /login, /setup и их API
     * - /api/auth/* — эндпоинтов Better Auth, они проверяют сессию сами
     * - статики Next и favicon
     */
    "/((?!login|setup|api/login|api/setup|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
