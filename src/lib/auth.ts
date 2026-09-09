export const SESSION_COOKIE = "tj_session";

/**
 * MVP-заглушка вместо полноценного auth: в cookie кладём не сам пароль,
 * а его SHA-256. Работает и в edge-runtime middleware, и в node-хендлерах.
 */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`trading-journal:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Сравнение за постоянное время — токены одинаковой длины (hex sha-256). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
