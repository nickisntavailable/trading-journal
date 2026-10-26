import type { AccessRequest } from "@prisma/client";
import { ACCOUNT_DEFAULTS } from "@/lib/account-defaults";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/security/telegram";
import type { TelegramUser } from "@/lib/telegram/link";

/**
 * Регистрация через бота с одобрением админа.
 *
 * У такой учётки нет почты, а Better Auth её требует — ставим служебную
 * tg-<id>@telegram.invalid: домен .invalid зарезервирован и никуда не ведёт.
 * Пароля нет: вход только через Telegram. В интерфейсе вместо почты —
 * @username.
 */
export const TELEGRAM_EMAIL_DOMAIN = "telegram.invalid";

export function telegramEmail(telegramId: bigint | number): string {
  return `tg-${telegramId}@${TELEGRAM_EMAIL_DOMAIN}`;
}

export function isTelegramEmail(email: string): boolean {
  return email.endsWith(`@${TELEGRAM_EMAIL_DOMAIN}`);
}

/** «@username (Имя)» для сообщений и списков. */
export function requestLabel(r: Pick<AccessRequest, "username" | "firstName" | "telegramId">): string {
  const parts = [r.username ? `@${r.username}` : null, r.firstName].filter(Boolean);
  return parts.length ? parts.join(" · ") : `id ${r.telegramId}`;
}

export type RequestResult =
  | { status: "created"; request: AccessRequest }
  | { status: "pending" | "rejected" | "approved"; request: AccessRequest };

/** /start от незнакомого Telegram: заявка создаётся один раз. */
export async function requestAccess(from: TelegramUser): Promise<RequestResult> {
  const telegramId = BigInt(from.id);
  const existing = await prisma.accessRequest.findUnique({ where: { telegramId } });
  if (existing) return { status: existing.status as "pending" | "rejected" | "approved", request: existing };
  // Две одновременные /start: уникальный telegramId пропустит одну.
  const created = await prisma.accessRequest
    .create({
      data: { telegramId, username: from.username ?? null, firstName: from.first_name ?? null },
    })
    .catch(async () => prisma.accessRequest.findUnique({ where: { telegramId } }));
  if (!created) throw new Error("Не удалось создать заявку");
  return { status: "created", request: created };
}

export type Decision = "approve" | "reject";

export type DecisionResult =
  | { result: "approved"; request: AccessRequest }
  | { result: "rejected"; request: AccessRequest }
  | { result: "already"; request: AccessRequest | null };

/**
 * Решение по заявке. Заявка «занимается» условным UPDATE — двойной тап или
 * два админа одновременно решат её ровно один раз. Отклонённую потом можно
 * пустить (из «Пользователей»), пущенную обратно не отклонить.
 */
export async function decideAccess(
  requestId: string,
  decision: Decision,
  adminUserId: string,
): Promise<DecisionResult> {
  const from = decision === "approve" ? ["pending", "rejected"] : ["pending"];
  const decidedAt = new Date();
  const { count } = await prisma.accessRequest.updateMany({
    where: { id: requestId, status: { in: from } },
    data: { status: decision === "approve" ? "approved" : "rejected", decidedAt, decidedById: adminUserId },
  });
  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (count === 0 || !request) return { result: "already", request };
  if (decision === "reject") return { result: "rejected", request };

  try {
    const userId = await createTelegramUser(request);
    const updated = await prisma.accessRequest.update({ where: { id: request.id }, data: { userId } });
    return { result: "approved", request: updated };
  } catch (error) {
    // Учётку создать не вышло — заявка снова ждёт решения.
    await prisma.accessRequest.update({
      where: { id: request.id },
      data: { status: "pending", decidedAt: null, decidedById: null },
    });
    throw error;
  }
}

async function createTelegramUser(request: AccessRequest): Promise<string> {
  const email = telegramEmail(request.telegramId);
  const existing = await prisma.user.findUnique({ where: { email } });
  const userId =
    existing?.id ??
    (
      await auth.api.createUser({
        // Без headers: иначе плагин admin потребует сессию админа.
        body: {
          email,
          name: request.firstName ?? request.username ?? `tg ${request.telegramId}`,
          role: "user",
        },
      })
    ).user.id;

  await prisma.account.upsert({
    where: { userId },
    create: { userId, ...ACCOUNT_DEFAULTS },
    update: {},
  });
  // Telegram мог успеть привязаться к другой учётке, пока заявка ждала, —
  // тогда не перехватываем.
  const linked = await prisma.telegramAccount.findUnique({ where: { telegramId: request.telegramId } });
  if (!linked) {
    await prisma.telegramAccount.create({
      data: {
        userId,
        telegramId: request.telegramId,
        username: request.username,
        firstName: request.firstName,
      },
    });
  }
  return userId;
}

/** Решать заявки может только админ, чей Telegram привязан. */
export async function adminByTelegram(telegramId: bigint): Promise<string | null> {
  const row = await prisma.telegramAccount.findUnique({
    where: { telegramId },
    select: { user: { select: { id: true, role: true } } },
  });
  return row?.user.role === "admin" ? row.user.id : null;
}

/** Текст заявки для админа — HTML-экранированный. */
export function requestText(request: AccessRequest, suffix = ""): string {
  return `<b>Заявка в журнал</b>\n${escapeHtml(requestLabel(request))}${suffix ? `\n${suffix}` : ""}`;
}
