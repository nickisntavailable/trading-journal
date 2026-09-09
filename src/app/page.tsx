import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Metric } from "@/components/metric";
import { OpenTradesList, type OpenTradeRow } from "@/components/open-trades-list";
import { RiskBudgetHero } from "@/components/risk-budget-hero";
import { getAccount } from "@/lib/account";
import { money, pct, signedMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "@/lib/queries";
import { riskBudget } from "@/lib/risk-budget";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const account = await getAccount();
  const [stats, openTrades] = await Promise.all([
    getDashboardStats(account.id),
    prisma.trade.findMany({
      where: { accountId: account.id, status: "open" },
      orderBy: { createdAt: "desc" },
      include: { fixes: { select: { sizePct: true } } },
    }),
  ]);

  const rows: OpenTradeRow[] = openTrades.map((trade) => ({
    id: trade.id,
    pair: trade.pair,
    direction: trade.direction === -1 ? -1 : 1,
    entryPrice: Number(trade.entryPrice),
    stopLoss: Number(trade.stopLoss),
    riskAmount: Number(trade.riskAmount),
    positionSize: Number(trade.positionSize),
    closedPct: trade.fixes.reduce((acc, f) => acc + Number(f.sizePct), 0),
    createdAt: trade.createdAt.toISOString(),
  }));

  const budget = riskBudget(
    Number(account.balance),
    Number(account.riskLimitPct),
    stats.openRiskAmount,
  );

  return (
    <AppShell>
      <RiskBudgetHero
        budget={budget}
        riskLimitPct={Number(account.riskLimitPct)}
        segments={rows.map((row) => ({
          id: row.id,
          label: row.pair,
          amount: row.riskAmount,
        }))}
      />

      <section className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-rule py-5 md:grid-cols-4">
        <Metric label="Баланс" value={money(Number(account.balance))} />
        <Metric label="Базовый риск" value={pct(Number(account.baseRiskPct))} />
        <Metric
          label="P/L за 30 дней"
          value={signedMoney(stats.pnl30d)}
          tone={stats.pnl30d > 0 ? "long" : stats.pnl30d < 0 ? "short" : "neutral"}
        />
        <Metric
          label="Win rate"
          value={stats.winRate === null ? "—" : pct(stats.winRate)}
        />
      </section>

      <section className="pt-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium">Открытые позиции</h2>
          {/*
            На десктопе настройки есть в верхней навигации, а таб-бар по ТЗ
            состоит только из Журнал / + / История — поэтому на мобильной
            ссылка на настройки живёт здесь, чтобы раздел не был недостижим.
          */}
          <Link
            href="/settings"
            className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink md:hidden"
          >
            Настройки
          </Link>
          <Link
            href="/trades"
            className="hidden text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink md:inline"
          >
            История
          </Link>
        </div>
        <div className="mt-3">
          <OpenTradesList trades={rows} />
        </div>
      </section>
    </AppShell>
  );
}
