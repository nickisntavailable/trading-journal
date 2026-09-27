import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/session";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Не найдено") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Единый обработчик: zod-ошибки → 400 с человекочитаемым текстом, нет сессии → 401. */
export function handleError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const path = first?.path.join(".");
    return badRequest(
      path ? `${path}: ${first.message}` : (first?.message ?? "Некорректные данные"),
    );
  }
  console.error(error);
  const message = error instanceof Error ? error.message : "Внутренняя ошибка";
  return NextResponse.json({ error: message }, { status: 500 });
}
