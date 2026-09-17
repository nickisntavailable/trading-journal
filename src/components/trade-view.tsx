"use client";

import Link from "next/link";
import { DirectionTag } from "@/components/direction-tag";
import { ProgressBar } from "@/components/progress-bar";
import { EditTradeForm } from "@/app/trades/[id]/edit-trade-form";
import { FixesPanel } from "@/app/trades/[id]/fixes-panel";
import { dateTime, money, pct, price, rMultiple, signedMoney, signedPct } from "@/lib/format";
import type { TradeWithFixes } from "@/lib/query/api";
import { useAddFix, useDeleteFix, useTrade } from "@/lib/query/trade";
import { closedPctOf } from "@/lib/trade-local";
import { fixNetPnL, margin, realizedSoFar, stopDistancePct } from "@/lib/trading-math";

/**
 * Страница сделки целиком живёт из кеша Query: SSR отдаёт initialData,
 * фиксации добавляются и удаляются оптимистично, сервер подтверждает потом.
 */
export function TradeView({
  initialData,
  creation = null,
}: {
  initialData: TradeWithFixes;
  /** Сделка открыта оптимистично и сервер её отверг — показать причину и выходы. */
  creation?: { message: string; retry: () => void; back: () => void } | null;
}) {
  const { data } = useTrade(initialData.trade.id, initialData);
  const addFix = useAddFix(initialData.trade.id);
  const deleteFix = useDeleteFix(initialData.trade.id);

  const { trade, fixes } = data;
  const closedPct = closedPctOf(fixes);

  // Результат по каждой фиксации и по закрытой части — теми же формулами, что
  // и итог сделки. Открытый остаток не считается: рыночной цены у нас нет.
  const fixesWithPnL = fixes.map((fix) => ({ ...fix, netPnL: fixNetPnL(trade, fix) }));
  const realized = realizedSoFar(trade, fixes);
  const realizedTone =
    realized.netPnL > 0 ? "text-long" : realized.netPnL < 0 ? "text-short" : "text-ink";

  return (
    <>
      {creation ? (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-l-2 border-short pl-3 text-[12px]">
          <span className="text-short">Сделка не сохранилась: {creation.message}</span>
          <span className="flex gap-3">
            <button
              type="button"
              onClick={creation.retry}
              className="underline underline-offset-2 hover:text-ink"
            >
              Повторить
            </button>
            <button
              type="button"
              onClick={creation.back}
              className="text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              К форме
            </button>
          </span>
        </div>
      ) : null}

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

      <section className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-rule py-4 md:grid-cols-6">
        <Param label="Вход" value={price(trade.entryPrice)} />
        <Param label="Стоп-лосс" value={price(trade.stopLoss)} />
        <Param label="Дистанция" value={pct(stopDistancePct(trade.entryPrice, trade.stopLoss))} />
        <Param label="Риск" value={`${money(trade.riskAmount)} · ${pct(trade.riskPct)}`} />
        <Param label="Позиция" value={money(trade.positionSize)} />
        <Param
          label={`Маржа · ${trade.leverage}×`}
          value={money(margin(trade.positionSize, trade.leverage))}
        />
      </section>

      {trade.status === "open" ? (
        <section className="border-b border-rule py-4">
          <EditTradeForm trade={trade} hasFixes={fixes.length > 0} />
        </section>
      ) : null}

      <section className="border-b border-rule py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-ink-soft">Закрыто позиции</span>
          <span className="num text-[13px]">{closedPct.toFixed(2)}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={closedPct} />
        </div>
        {trade.status === "open" && fixes.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[11px] text-ink-soft">
              Реализовано по закрытым {closedPct.toFixed(0)}%
              {closedPct < 100 ? " · остаток без рыночной цены не считается" : ""}
            </span>
            <span className={"num text-[14px] " + realizedTone}>
              {signedMoney(realized.netPnL)}
              <span className="text-[12px] text-ink-soft"> · {rMultiple(realized.rMultiple)}</span>
            </span>
          </div>
        ) : null}
      </section>

      {trade.status === "closed" ? <ResultBlock trade={trade} /> : null}

      <FixesPanel
        status={trade.status}
        fixes={fixesWithPnL}
        closedPct={closedPct}
        positionSize={trade.positionSize}
        addFix={addFix}
        deleteFix={deleteFix}
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
    </>
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
        <Param label="Realized R:R" value={rMultiple(trade.realizedRR)} tone={tone} />
      </div>
      <p className="mt-3 text-[11px] text-ink-soft">
        средняя цена выхода <span className="num">{price(trade.realizedAvgExit)}</span>
      </p>
    </section>
  );
}

function Param({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className={"num mt-0.5 truncate text-[15px] " + (tone ?? "")}>{value}</p>
    </div>
  );
}
