import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  openRiskAmount: number;
  pnl30d: number;
  winRate: number | null;
  closedCount: number;
};

/** Агрегаты дашборда — используются и GET /api/account, и страницей `/`. */
export async function getDashboardStats(accountId: string): Promise<DashboardStats> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [openRisk, pnl30d, closedTotal, closedWins] = await Promise.all([
    prisma.trade.aggregate({
      where: { accountId, status: "open" },
      _sum: { riskAmount: true },
    }),
    prisma.trade.aggregate({
      where: { accountId, status: "closed", closedAt: { gte: since } },
      _sum: { netPnL: true },
    }),
    prisma.trade.count({ where: { accountId, status: "closed" } }),
    prisma.trade.count({
      where: { accountId, status: "closed", netPnL: { gt: 0 } },
    }),
  ]);

  return {
    openRiskAmount: Number(openRisk._sum.riskAmount ?? 0),
    pnl30d: Number(pnl30d._sum.netPnL ?? 0),
    winRate: closedTotal > 0 ? (closedWins / closedTotal) * 100 : null,
    closedCount: closedTotal,
  };
}
