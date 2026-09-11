import { prisma } from "@/lib/prisma";
import { margin } from "@/lib/trading-math";

export type DashboardStats = {
  openRiskAmount: number;
  /** Сумма маржи открытых позиций — сколько депозита реально в сделках. */
  openMargin: number;
  pnl30d: number;
  winRate: number | null;
  closedCount: number;
};

/** Агрегаты дашборда — используются и GET /api/account, и страницей `/`. */
export async function getDashboardStats(accountId: string): Promise<DashboardStats> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [openTrades, pnl30d, closedTotal, closedWins] = await Promise.all([
    prisma.trade.findMany({
      where: { accountId, status: "open" },
      select: { riskAmount: true, positionSize: true, leverage: true },
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

  const openRiskAmount = openTrades.reduce((acc, t) => acc + Number(t.riskAmount), 0);
  const openMargin = openTrades.reduce(
    (acc, t) => acc + margin(Number(t.positionSize), Number(t.leverage)),
    0,
  );

  return {
    openRiskAmount,
    openMargin,
    pnl30d: Number(pnl30d._sum.netPnL ?? 0),
    winRate: closedTotal > 0 ? (closedWins / closedTotal) * 100 : null,
    closedCount: closedTotal,
  };
}
