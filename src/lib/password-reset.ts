import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";
import { hashToken, newToken } from "@/lib/tokens";

/**
 * Сброс пароля по ссылке от админа. Ссылка даёт доступ к учётке с данными,
 * поэтому живёт сутки, а не неделю, как приглашение.
 */
export const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export class ResetError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Новая ссылка. Прежние неиспользованные ссылки этого пользователя удаляются. */
export async function createResetLink(userId: string): Promise<string> {
  const { token, tokenHash } = newToken();
  await prisma.$transaction([
    prisma.passwordReset.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordReset.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);
  return token;
}

/** Действующая ссылка по токену (вместе с почтой пользователя) или null. */
export async function findPendingReset(token: string) {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true } } },
  });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) return null;
  return reset;
}

/**
 * Новый пароль по ссылке. Ссылка сначала «занимается» условным UPDATE —
 * одна ссылка срабатывает один раз даже при одновременных запросах. Все
 * сессии пользователя удаляются: если пароль сбрасывают из-за утечки,
 * старые входы должны отвалиться.
 */
export async function resetPassword(token: string, password: string): Promise<{ email: string }> {
  const reset = await findPendingReset(token);
  if (!reset) throw new ResetError("Ссылка недействительна или устарела", 404);

  const usedAt = new Date();
  const { count } = await prisma.passwordReset.updateMany({
    where: { id: reset.id, usedAt: null, expiresAt: { gt: usedAt } },
    data: { usedAt },
  });
  if (count === 0) throw new ResetError("Ссылка недействительна или устарела", 404);

  try {
    // Публичный auth.api.setUserPassword требует сессию админа, а здесь её нет —
    // пускает сама ссылка. Поэтому те же шаги, что внутри него, через $context.
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    if (await ctx.internalAdapter.findCredentialAccount(reset.userId)) {
      await ctx.internalAdapter.updatePassword(reset.userId, hash);
    } else {
      await ctx.internalAdapter.createAccount({
        userId: reset.userId,
        providerId: "credential",
        accountId: reset.userId,
        password: hash,
      });
    }
    await ctx.internalAdapter.deleteUserSessions(reset.userId);
  } catch (error) {
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: null } });
    throw error;
  }
  return { email: reset.user.email };
}
