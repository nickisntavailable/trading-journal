/**
 * Кто стучится: IP, геолокация и браузер из заголовков запроса.
 *
 * На Vercel клиентский IP кладёт в заголовки сама платформа (x-real-ip,
 * x-forwarded-for) и перезаписывает то, что прислал клиент, — подделать их
 * снаружи нельзя. Страну и город Vercel определяет по IP сам. Локально этих
 * заголовков нет, поэтому IP становится "unknown".
 */
export type RequestInfo = {
  ip: string;
  country: string | null;
  city: string | null;
  userAgent: string | null;
};

export function requestInfo(request: Request): RequestInfo {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const city = h.get("x-vercel-ip-city");

  return {
    ip: h.get("x-real-ip") ?? forwarded ?? "unknown",
    country: h.get("x-vercel-ip-country"),
    // Город приходит url-кодированным: «S%C3%A3o%20Paulo».
    city: city ? safeDecode(city) : null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Коротко о браузере для сообщения: «Safari · iPhone», «Chrome · Windows». */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "неизвестный браузер";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl|python|go-http|node|axios/i.test(ua)
            ? "скрипт"
            : "браузер";
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}
