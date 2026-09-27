import { ACCOUNT_DEFAULTS } from "@/lib/account-defaults";
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

  // Учётка создана, а счёт — нет (упало между двумя шагами в /setup или при
  // принятии приглашения). Досоздаём при первом обращении, чтобы не чинить
  // базу руками. Владельцу достаётся существующий счёт со сделками.
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (ownerEmail && user.email === ownerEmail) {
    await attachOwnerAccount(user.id);
  } else {
    await prisma.account.create({ data: { userId: user.id, ...ACCOUNT_DEFAULTS } });
  }
  return prisma.account.findUniqueOrThrow({ where: { userId: user.id } });
}
