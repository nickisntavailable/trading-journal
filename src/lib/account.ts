import { prisma } from "@/lib/prisma";

/**
 * Синглтон-аккаунт. Читается через отдельный хелпер, чтобы бизнес-логика
 * обращалась к нему по accountId, а не по «в БД одна строка».
 */
export async function getAccount() {
  const account = await prisma.account.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    throw new Error(
      "Account не найден. Запусти сид: npx prisma db seed",
    );
  }
  return account;
}
