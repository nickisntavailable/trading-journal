import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DirectionTag } from "@/components/direction-tag";
import { getAccount } from "@/lib/account";
import { money, plural, rMultiple, shortDate, signedMoney, signedPct } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "История — Trading Journal" };

type SearchParams = { pair?: string; from?: string; to?: string };

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { pair, from, to } = await searchParams;
  const account = await getAccount();

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  // `to` в форме — календарный день, включаем его целиком.
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const trades = await prisma.trade.findMany({
    where: {
      accountId: account.id,
      status: "closed",
      ...(pair ? { pair: { contains: pair.toUpperCase() } } : {}),
      ...(fromDate || toDate
        ? {
            closedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { closedAt: "desc" },
    take: 200,
  });

  const totalNet = trades.reduce((acc, t) => acc + Number(t.netPnL ?? 0), 0);

  return (
    <AppShell>
      <div className="flex items-baseline justify-between border-b border-rule pb-3">
        <h1 className="text-[13px] font-medium">История</h1>
        <span className="text-[12px] text-ink-soft">
          {trades.length} {plural(trades.length, "сделка", "сделки", "сделок")} ·{" "}
          <span
            className={
              "num " + (totalNet > 0 ? "text-long" : totalNet < 0 ? "text-short" : "")
            }
          >
            {signedMoney(totalNet)}
          </span>
        </span>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 border-b border-rule py-4"
      >
        <div>
          <label htmlFor="pair" className="block text-[11px] text-ink-soft">
            Пара
          </label>
          <input
            id="pair"
            name="pair"
            defaultValue={pair ?? ""}
            placeholder="BTCUSDT"
            className="num mt-1 w-32 rounded-[3px] border border-rule bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label htmlFor="from" className="block text-[11px] text-ink-soft">
            С даты
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="num mt-1 rounded-[3px] border border-rule bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-[11px] text-ink-soft">
            По дату
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="num mt-1 rounded-[3px] border border-rule bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink"
          />
        </div>
        <button
          type="submit"
          className="rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Применить
        </button>
        {pair || from || to ? (
          <Link
            href="/trades"
            className="py-1.5 text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            Сбросить
          </Link>
        ) : null}
      </form>

      {trades.length === 0 ? (
        <p className="py-6 text-[13px] text-ink-soft">Закрытых сделок нет</p>
      ) : (
        <div className="pt-4">
          {/* Десктоп */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[0.8fr_1.2fr_0.7fr_1fr_1fr_0.8fr] gap-3 border-y border-rule py-1.5 text-[11px] text-ink-soft">
              <span>Дата</span>
              <span>Пара</span>
              <span>Напр.</span>
              <span className="text-right">Net P/L</span>
              <span className="text-right">% к депозиту</span>
              <span className="text-right">R:R</span>
            </div>
            {trades.map((trade) => {
              const net = Number(trade.netPnL ?? 0);
              const tone = net > 0 ? "text-long" : net < 0 ? "text-short" : "";
              return (
                <Link
                  key={trade.id}
                  href={`/trades/${trade.id}`}
                  className="grid grid-cols-[0.8fr_1.2fr_0.7fr_1fr_1fr_0.8fr] items-center gap-3 border-b border-rule py-2 text-[13px] hover:bg-white"
                >
                  <span className="num text-ink-soft">
                    {shortDate(trade.closedAt ?? trade.createdAt)}
                  </span>
                  <span className="truncate font-medium">{trade.pair}</span>
                  <span className="text-[12px]">
                    <DirectionTag direction={trade.direction === -1 ? -1 : 1} />
                  </span>
                  <span className={"num text-right " + tone}>{signedMoney(net)}</span>
                  <span className={"num text-right " + tone}>
                    {signedPct(trade.netPnlPctOfDeposit ? Number(trade.netPnlPctOfDeposit) : 0)}
                  </span>
                  <span className={"num text-right " + tone}>
                    {rMultiple(trade.realizedRR === null ? null : Number(trade.realizedRR))}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Мобильная */}
          <div className="md:hidden">
            {trades.map((trade) => {
              const net = Number(trade.netPnL ?? 0);
              const tone = net > 0 ? "text-long" : net < 0 ? "text-short" : "";
              return (
                <Link
                  key={trade.id}
                  href={`/trades/${trade.id}`}
                  className="block border-b border-rule py-3 first:border-t"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-medium">
                      {trade.pair}{" "}
                      <span className="text-[12px] font-normal">
                        <DirectionTag direction={trade.direction === -1 ? -1 : 1} />
                      </span>
                    </span>
                    <span className={"num text-[14px] " + tone}>{signedMoney(net)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-ink-soft">
                    <span className="num">
                      {shortDate(trade.closedAt ?? trade.createdAt)}
                    </span>
                    <span className="num">
                      {signedPct(
                        trade.netPnlPctOfDeposit ? Number(trade.netPnlPctOfDeposit) : 0,
                      )}{" "}
                      · {rMultiple(trade.realizedRR === null ? null : Number(trade.realizedRR))}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-ink-soft">
            Комиссии по этим сделкам:{" "}
            <span className="num">
              {money(trades.reduce((acc, t) => acc + Number(t.totalFees ?? 0), 0))}
            </span>
          </p>
        </div>
      )}
    </AppShell>
  );
}
