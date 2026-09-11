import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Синглтон-аккаунт: приложение однопользовательское, но accountId остаётся
// явным внешним ключом везде, чтобы переход на multi-user был миграцией данных.
async function main() {
  const existing = await prisma.account.findFirst();
  if (existing) {
    console.log(`Account already exists: ${existing.id}`);
    return;
  }

  const account = await prisma.account.create({
    data: {
      balance: "0",
      baseRiskPct: "1.00",
      riskLimitPct: "3.00",
      defaultLeverage: "5",
      feeRatePct: "0.0600",
    },
  });
  console.log(`Created account ${account.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
