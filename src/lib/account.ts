import { prisma } from "@/lib/prisma";
import { attachOwnerAccount } from "@/lib/owner-setup";
import { requireUser } from "@/lib/session";

/**
 * Торговый счёт текущего пользователя. Вся бизнес-логика ходит в базу через
 * accountId отсюда, поэтому чужие сделки не видны: счёт берётся по сессии,
 * а не «первая строка в таблице».
 */
export async function getAccount() {
  const user = await requireUser();
  const account = await prisma.account.findUnique({ where: { userId: user.id } });
  if (account) return account;

  // Настройка владельца создала пользователя, но упала до привязки счёта —
  // досвязываем при первом обращении, чтобы не чинить базу руками.
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (ownerEmail && user.email === ownerEmail) {
    await attachOwnerAccount(user.id);
    return prisma.account.findUniqueOrThrow({ where: { userId: user.id } });
  }
  throw new Error("У пользователя нет торгового счёта");
}
