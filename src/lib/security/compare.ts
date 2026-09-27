import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Сравнение секретов за постоянное время. Обычное `===` выходит на первом
 * несовпавшем символе, и по времени ответа можно угадывать значение
 * посимвольно. Хешируем оба значения, чтобы сравнивать строки одинаковой длины.
 */
export function secretsMatch(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Задержка на неверный пароль: перебору медленнее, человеку незаметно. */
export const FAILURE_DELAY_MS = 500;

export function failureDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
}
