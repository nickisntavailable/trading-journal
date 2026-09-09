/**
 * Загрузка картинки снимка TradingView по ссылке вида
 * https://www.tradingview.com/x/PfnQGGE0/
 *
 * Страница снимка отдаёт прямую ссылку на PNG в og:image
 * (https://s3.tradingview.com/snapshots/p/PfnQGGE0.png). Ссылку на живой график
 * (/chart/<id>/) так забрать нельзя: там JS-приложение, а og:image — стоковая
 * заглушка, одинаковая для всех графиков.
 *
 * Ходим строго на tradingview.com: адрес приходит от пользователя, поэтому оба
 * запроса ограничены доменом, таймаутом и размером ответа.
 */

const ALLOWED_HOST = /(^|\.)tradingview\.com$/i;
const PAGE_TIMEOUT_MS = 15_000;
const IMAGE_TIMEOUT_MS = 30_000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export class SnapshotError extends Error {}

export type SnapshotImage = {
  bytes: Buffer;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
};

function assertAllowedHost(url: URL) {
  if (url.protocol !== "https:" || !ALLOWED_HOST.test(url.hostname)) {
    throw new SnapshotError("Ссылка должна вести на tradingview.com");
  }
}

/** Извлекает id из /x/<id>/ — только для ссылок-снимков. */
export function snapshotIdFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!ALLOWED_HOST.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/x\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1] : null;
}

async function readCapped(response: Response, limit: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > limit) throw new SnapshotError("Файл снимка слишком большой");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new SnapshotError("Файл снимка слишком большой");
  return bytes;
}

const MEDIA_TYPES: Record<string, SnapshotImage["mediaType"]> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export async function fetchTradingViewSnapshot(raw: string): Promise<SnapshotImage> {
  const id = snapshotIdFromUrl(raw);
  if (!id) {
    throw new SnapshotError(
      "Нужна ссылка на снимок графика вида tradingview.com/x/… — ссылку на сам график открыть нельзя",
    );
  }

  const pageUrl = new URL(`https://www.tradingview.com/x/${id}/`);
  assertAllowedHost(pageUrl);

  const page = await fetch(pageUrl, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    redirect: "follow",
  }).catch(() => {
    throw new SnapshotError("TradingView не ответил на запрос снимка");
  });

  if (!page.ok) {
    throw new SnapshotError(
      page.status === 404 ? "Снимок не найден — проверь ссылку" : "TradingView вернул ошибку",
    );
  }

  const html = (await readCapped(page, MAX_PAGE_BYTES)).toString("utf8");
  const og = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  );

  // Запасной вариант: снимки лежат по предсказуемому адресу.
  const imageHref =
    og?.[1] ?? `https://s3.tradingview.com/snapshots/${id[0].toLowerCase()}/${id}.png`;

  const imageUrl = new URL(imageHref);
  assertAllowedHost(imageUrl);

  const image = await fetch(imageUrl, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    redirect: "follow",
  }).catch(() => {
    throw new SnapshotError("Не удалось скачать картинку снимка");
  });

  if (!image.ok) throw new SnapshotError("Не удалось скачать картинку снимка");

  const contentType = (image.headers.get("content-type") ?? "").split(";")[0].trim();
  const mediaType = MEDIA_TYPES[contentType];
  if (!mediaType) {
    throw new SnapshotError("По ссылке пришла не картинка — похоже, это не снимок графика");
  }

  return { bytes: await readCapped(image, MAX_IMAGE_BYTES), mediaType };
}
