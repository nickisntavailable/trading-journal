import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Не найдено") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Единый обработчик: zod-ошибки → 400 с человекочитаемым текстом. */
export function handleError(error: unknown) {
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
