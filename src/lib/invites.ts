import { createHash, randomBytes } from "node:crypto";
import { ACCOUNT_DEFAULTS } from "@/lib/account-defaults";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";

/**
 * Приглашения по ссылке.
 *
 * Токен — 32 случайных байта, в ссылке в base64url. В базе только SHA-256 от
 * него: подобрать 256 бит нельзя, а утёкшая база не даёт рабочих ссылок.
 * Медленный хеш, как у паролей, здесь не нужен — токен случайный, перебирать
 * по словарю нечего.
 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class InviteError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export function inviteStatus(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}

/**
 * Новое приглашение. Прежние неиспользованные на ту же почту отзываются —
 * рабочей остаётся только последняя ссылка.
 */
export async function createInvite(rawEmail: string, createdById: string): Promise<string> {
  const email = normalizeEmail(rawEmail);
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new InviteError("У этой почты уже есть учётка", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    prisma.invite.updateMany({
      where: { email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.invite.create({
      data: {
        email,
        tokenHash: hashToken(token),
        createdById,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** Действующее приглашение по токену из ссылки или null. */
export async function findPendingInvite(token: string) {
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  return invite && inviteStatus(invite) === "pending" ? invite : null;
}

export async function revokeInvite(id: string): Promise<void> {
  const { count } = await prisma.invite.updateMany({
    where: { id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new InviteError("Приглашение уже использовано или отозвано", 409);
}

/**
 * Принять приглашение: завести пользователя с паролем и пустой счёт.
 *
 * Приглашение сначала «занимается» условным UPDATE — из двух одновременных
 * запросов по одной ссылке пройдёт ровно один. Если создать учётку не
 * вышло, приглашение освобождается, и ссылкой можно воспользоваться снова.
 */
export async function acceptInvite(token: string, password: string): Promise<{ email: string }> {
  const invite = await findPendingInvite(token);
  if (!invite) throw new InviteError("Ссылка недействительна или устарела", 404);

  const acceptedAt = new Date();
  const { count } = await prisma.invite.updateMany({
    where: { id: invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: acceptedAt } },
    data: { acceptedAt },
  });
  if (count === 0) throw new InviteError("Ссылка недействительна или устарела", 404);

  let userId: string;
  try {
    // Вызов без headers: иначе плагин admin потребует сессию админа.
    const { user } = await auth.api.createUser({
      body: {
        email: invite.email,
        password,
        name: invite.email.split("@")[0],
        role: "user",
      },
    });
    userId = user.id;
  } catch (error) {
    await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: null } });
    throw error;
  }

  // Если здесь упадёт — учётка уже есть, счёт досоздаст getAccount() при входе.
  await prisma.account.create({ data: { userId, ...ACCOUNT_DEFAULTS } });
  return { email: invite.email };
}
