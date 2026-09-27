import { prisma } from "@/lib/prisma";

/**
 * Первый вход после перехода на пользователей. Пока в базе нет ни одного
 * пользователя, владелец создаёт себе учётку сам: вводит почту из OWNER_EMAIL,
 * новый пароль и старый общий APP_PASSWORD как доказательство, что это он.
 * Как только владелец создан, настройка закрывается навсегда, а APP_PASSWORD
 * можно удалить из переменных Vercel.
 */
export async function setupAvailable(): Promise<boolean> {
  if (!process.env.OWNER_EMAIL || !process.env.APP_PASSWORD) return false;
  return (await prisma.user.count()) === 0;
}

/**
 * Отдаёт владельцу существующий торговый счёт со всеми сделками. Если счёта
 * ещё нет (пустая база), создаёт с теми же значениями, что и сид.
 */
export async function attachOwnerAccount(userId: string): Promise<void> {
  const orphan = await prisma.account.findFirst({
    where: { userId: null },
    orderBy: { createdAt: "asc" },
  });
  if (orphan) {
    await prisma.account.update({ where: { id: orphan.id }, data: { userId } });
    return;
  }
  await prisma.account.create({
    data: {
      userId,
      balance: "0",
      baseRiskPct: "1.00",
      riskLimitPct: "3.00",
      defaultLeverage: "5",
      feeRatePct: "0.0600",
    },
  });
}
