import { prisma } from "@/lib/prisma";
import { describeUserAgent, type RequestInfo } from "@/lib/security/request-info";
import { escapeHtml, sendSecurityAlert } from "@/lib/security/telegram";

/**
 * Ограничение перебора пароля и сигналы о подозрительных входах.
 *
 * Попытка записывается в базу ДО проверки пароля. Иначе пачка параллельных
 * запросов проскочила бы проверку лимита раньше, чем первый из них успел
 * записаться. Если пароль верный — запись помечается успешной.
 */

/** Сколько неудачных попыток с одного IP допускается за окно. */
export const IP_FAILURE_LIMIT = 5;
export const IP_WINDOW_MS = 15 * 60 * 1000;

/** Порог сигнала о массовом переборе с разных IP. Вход при этом не закрывается. */
export const GLOBAL_FAILURE_ALERT = 30;
export const GLOBAL_WINDOW_MS = 60 * 60 * 1000;

/** Журнал попыток старше этого срока чистится. */
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type AttemptStart =
  | { locked: true; retryAfterSec: number }
  | { locked: false; attemptId: string };

export async function beginAttempt(info: RequestInfo): Promise<AttemptStart> {
  const attempt = await prisma.loginAttempt.create({
    data: {
      ip: info.ip,
      success: false,
      country: info.country,
      city: info.city,
      userAgent: info.userAgent,
    },
  });

  const since = new Date(Date.now() - IP_WINDOW_MS);
  const failures = await prisma.loginAttempt.findMany({
    where: { ip: info.ip, success: false, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  // Текущая попытка уже в счёте, поэтому «больше лимита», а не «не меньше».
  // Попытки во время блокировки тоже копятся — долбёжка продлевает блокировку.
  if (failures.length > IP_FAILURE_LIMIT) {
    const oldestInWindow = failures[failures.length - IP_FAILURE_LIMIT].createdAt;
    const unlockAt = oldestInWindow.getTime() + IP_WINDOW_MS;
    return { locked: true, retryAfterSec: Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000)) };
  }

  return { locked: false, attemptId: attempt.id };
}

/**
 * Пароль неверный: попытка уже записана как неудачная, решаем, пора ли сигналить.
 *
 * Условие «ровно N» здесь не годится: при пачке параллельных запросов счётчик
 * перескакивает через порог, и сигнал не ушёл бы именно во время атаки. Поэтому
 * «порог превышен и такого сигнала за окно ещё не было».
 */
export async function onFailure(info: RequestInfo): Promise<void> {
  const [ipFailures, globalFailures] = await Promise.all([
    prisma.loginAttempt.count({
      where: {
        ip: info.ip,
        success: false,
        createdAt: { gte: new Date(Date.now() - IP_WINDOW_MS) },
      },
    }),
    prisma.loginAttempt.count({
      where: { success: false, createdAt: { gte: new Date(Date.now() - GLOBAL_WINDOW_MS) } },
    }),
  ]);

  if (ipFailures >= IP_FAILURE_LIMIT) await alertLockout(info);

  if (globalFailures >= GLOBAL_FAILURE_ALERT) {
    await alertOnce("mass-failures", GLOBAL_WINDOW_MS, [
      `<b>Похоже на массовый перебор</b> ${envLabel()}`,
      `${globalFailures} неверных паролей за час с разных адресов.`,
      "Вход не закрыт. Если это не ты — смени APP_PASSWORD и посмотри Vercel → Firewall.",
    ]);
  }
}

/**
 * Попытка отбита блокировкой. Сигнал нужен и здесь: пачка параллельных
 * запросов с нового IP может целиком упереться в лимит, не дойдя до проверки
 * пароля, — и тогда onFailure не вызовется ни разу. На тесте так и было:
 * 15 параллельных запросов, 15 отказов, ни одного сигнала.
 */
export async function onLocked(info: RequestInfo): Promise<void> {
  await alertLockout(info);
}

function alertLockout(info: RequestInfo): Promise<void> {
  return alertOnce(`ip-lockout:${info.ip}`, IP_WINDOW_MS, [
    `<b>Вход заблокирован</b> ${envLabel()}`,
    `Больше ${IP_FAILURE_LIMIT} попыток за ${IP_WINDOW_MS / 60_000} мин с ${who(info)}.`,
    `IP закрыт на ${IP_WINDOW_MS / 60_000} мин.`,
  ]);
}

/**
 * Отправляет сигнал не чаще одного раза за окно.
 *
 * Ключ дополняется номером окна времени и вставляется в таблицу с уникальным
 * индексом через INSERT … ON CONFLICT DO NOTHING (skipDuplicates). Вставку
 * проходит ровно один из параллельных запросов — он и отправляет сигнал,
 * остальные получают count 0 и выходят без исключений и шума в логах.
 * Проверка «было ли уже» + вставка отдельными запросами так не работает: при
 * атаке все запросы одновременно видят «ещё не было» — на тесте это дало
 * 14 одинаковых сообщений подряд.
 */
async function alertOnce(key: string, windowMs: number, lines: string[]): Promise<void> {
  const bucket = Math.floor(Date.now() / windowMs);
  const { count } = await prisma.securityAlert.createMany({
    data: [{ key: `${key}:${bucket}` }],
    skipDuplicates: true,
  });
  if (count === 1) await sendSecurityAlert(lines);
}

/**
 * Пароль верный: помечаем попытку успешной. Делается до ответа — иначе при сбое
 * успешный вход остался бы в журнале неудачным и считался против лимита.
 */
export async function markSuccess(attemptId: string): Promise<void> {
  await prisma.loginAttempt.update({ where: { id: attemptId }, data: { success: true } });
}

/** После ответа: сигнал о входе с нового адреса и чистка старого журнала. */
export async function afterSuccess(attemptId: string, info: RequestInfo): Promise<void> {
  const others = { id: { not: attemptId }, success: true };
  const [seenIp, seenCountry] = await Promise.all([
    prisma.loginAttempt.count({ where: { ...others, ip: info.ip } }),
    info.country
      ? prisma.loginAttempt.count({ where: { ...others, country: info.country } })
      : Promise.resolve(1),
  ]);

  if (seenIp === 0) {
    await sendSecurityAlert(
      [
        `<b>Вход с нового адреса</b> ${envLabel()}`,
        who(info),
        seenCountry === 0 ? "Из этой страны раньше не входили." : "",
        "Если это не ты — смени APP_PASSWORD.",
      ].filter(Boolean),
    );
  }

  // Старые записи журналов никому не нужны — чистим при успешном входе, это редко.
  const expired = { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } };
  await Promise.all([
    prisma.loginAttempt.deleteMany({ where: expired }),
    prisma.securityAlert.deleteMany({ where: expired }),
  ]);
}

function who(info: RequestInfo): string {
  const place = [info.city, info.country].filter(Boolean).join(", ");
  return [
    `<code>${escapeHtml(info.ip)}</code>`,
    place ? escapeHtml(place) : null,
    escapeHtml(describeUserAgent(info.userAgent)),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Прод и превью шлют в один чат — подписываем, откуда сигнал. */
function envLabel(): string {
  const env = process.env.VERCEL_ENV;
  return env && env !== "production" ? `[${env}]` : "";
}
