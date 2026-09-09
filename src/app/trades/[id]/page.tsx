import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DirectionTag } from "@/components/direction-tag";
import { ProgressBar } from "@/components/progress-bar";
import { FixesPanel } from "@/app/trades/[id]/fixes-panel";
import { getAccount } from "@/lib/account";
import { dateTime, money, pct, price, ratio, signedMoney, signedPct } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
import { stopDistancePct } from "@/lib/trading-math";

export const dynamic = "force-dynamic";

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();

  const row = await prisma.trade.findFirst({
    where: { id, accountId: account.id },
    include: { fixes: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) notFound();

  const trade = tradeToDTO(row);
  const fixes = row.fixes.map(fixToDTO);
  const closedPct = fixes.reduce((acc, f) => acc + f.sizePct, 0);

  return (
    <AppShell>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
        <h1 className="text-[15px] font-medium">
          {trade.pair}{" "}
          <span className="text-[13px] font-normal">
            <DirectionTag direction={trade.direction} />
          </span>
        </h1>
        <span className="text-[12px] text-ink-soft">
          {trade.status === "open" ? "открыта" : "закрыта"} ·{" "}
          <span className="num">{dateTime(trade.createdAt)}</span>
        </span>
      </div>

      <section className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-rule py-4 md:grid-cols-5">
        <Param label="Вход" value={price(trade.entryPrice)} />
        <Param label="Стоп-лосс" value={price(trade.stopLoss)} />
        <Param
          label="Дистанция"
          value={pct(stopDistancePct(trade.entryPrice, trade.stopLoss))}
        />
        <Param label="Риск" value={`${money(trade.riskAmount)} · ${pct(trade.riskPct)}`} />
        <Param label="Размер позиции" value={money(trade.positionSize)} />
      </section>

      <section className="border-b border-rule py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-ink-soft">Закрыто позиции</span>
          <span className="num text-[13px]">{closedPct.toFixed(2)}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={closedPct} />
        </div>
      </section>

      {trade.status === "closed" ? <ResultBlock trade={trade} /> : null}

      <FixesPanel
        tradeId={trade.id}
        status={trade.status}
        fixes={fixes}
        closedPct={closedPct}
        positionSize={trade.positionSize}
      />

      <div className="mt-5 flex gap-4 text-[12px] text-ink-soft">
        <Link href="/" className="underline underline-offset-2 hover:text-ink">
          К дашборду
        </Link>
        {trade.tvLink ? (
          <a
            href={trade.tvLink}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-ink"
          >
            График на TradingView
          </a>
        ) : null}
      </div>
    </AppShell>
  );
}

function ResultBlock({
  trade,
}: {
  trade: {
    grossPnL: number | null;
    totalFees: number | null;
    netPnL: number | null;
    netPnlPctOfDeposit: number | null;
    realizedAvgExit: number | null;
    realizedRR: number | null;
    closedAt: string | null;
  };
}) {
  const tone =
    trade.netPnL === null ? "" : trade.netPnL > 0 ? "text-long" : trade.netPnL < 0 ? "text-short" : "";

  return (
    <section className="border-b border-rule py-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-medium">Результат</h2>
        {trade.closedAt ? (
          <span className="num text-[12px] text-ink-soft">{dateTime(trade.closedAt)}</span>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-5">
        <Param label="Gross P/L" value={signedMoney(trade.grossPnL)} />
        <Param label="Комиссии" value={money(trade.totalFees)} />
        <Param label="Net P/L" value={signedMoney(trade.netPnL)} tone={tone} />
        <Param label="% к депозиту" value={signedPct(trade.netPnlPctOfDeposit)} tone={tone} />
        <Param label="Realized R:R" value={ratio(trade.realizedRR)} />
      </div>
      <p className="mt-3 text-[11px] text-ink-soft">
        средняя цена выхода <span className="num">{price(trade.realizedAvgExit)}</span>
      </p>
    </section>
  );
}

function Param({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className={"num mt-0.5 truncate text-[15px] " + (tone ?? "")}>{value}</p>
    </div>
  );
}
