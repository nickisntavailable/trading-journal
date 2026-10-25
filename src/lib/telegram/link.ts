import { prisma } from "@/lib/prisma";
import { hashToken, newToken } from "@/lib/tokens";

/**
 * Привязка Telegram к уже существующей учётке: в настройках создаётся
 * одноразовая ссылка t.me/<бот>?start=link_<токен>, человек жмёт Start, бот
 * получает токен и привязывает его Telegram к этой учётке. Сделки и пароль
 * при этом никуда не деваются — это второй способ входа в ту же учётку.
 */
export const LINK_TTL_MS = 10 * 60 * 1000;

export async function createLinkToken(userId: string): Promise<string> {
  const { token, tokenHash } = newToken();
  await prisma.$transaction([
    prisma.telegramLinkToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.telegramLinkToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + LINK_TTL_MS) },
    }),
  ]);
  return token;
}

export type TelegramUser = { id: number; username?: string; first_name?: string };

export type LinkResult =
  | { status: "linked"; email: string }
  | { status: "invalid" }
  | { status: "taken" };

/**
 * Применить ссылку. Токен «занимается» условным UPDATE — сработает ровно
 * один раз. Если этот Telegram уже привязан к другой учётке, отказ: один
 * Telegram — одна учётка, иначе непонятно, в какую входить.
 */
export async function consumeLinkToken(token: string, from: TelegramUser): Promise<LinkResult> {
  const row = await prisma.telegramLinkToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true } } },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return { status: "invalid" };

  const telegramId = BigInt(from.id);
  const other = await prisma.telegramAccount.findUnique({ where: { telegramId } });
  if (other && other.userId !== row.userId) return { status: "taken" };

  const { count } = await prisma.telegramLinkToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) return { status: "invalid" };

  const data = { telegramId, username: from.username ?? null, firstName: from.first_name ?? null };
  await prisma.telegramAccount.upsert({
    where: { userId: row.userId },
    create: { userId: row.userId, ...data },
    update: data,
  });
  return { status: "linked", email: row.user.email };
}

export async function unlinkTelegram(userId: string): Promise<void> {
  await prisma.telegramAccount.deleteMany({ where: { userId } });
}

/** Телеграмы админов — им идут сигналы безопасности и (позже) заявки. */
export async function adminTelegramIds(): Promise<bigint[]> {
  const rows = await prisma.telegramAccount.findMany({
    where: { user: { role: "admin" } },
    select: { telegramId: true },
  });
  return rows.map((r) => r.telegramId);
}
