import Link from "next/link";
import { DirectionTag } from "@/components/direction-tag";
import { ProgressBar } from "@/components/progress-bar";
import { money, price, shortDate } from "@/lib/format";

export type OpenTradeRow = {
  id: string;
  pair: string;
  direction: 1 | -1;
  entryPrice: number;
  stopLoss: number;
  riskAmount: number;
  positionSize: number;
  margin: number;
  leverage: number;
  closedPct: number;
  createdAt: string;
};

/**
 * Плотные строки с hairline-разделителями (раздел 7), не карточки.
 * На мобильной — строка-карточка с прогресс-баром вместо колонок.
 */
export function OpenTradesList({ trades }: { trades: OpenTradeRow[] }) {
  if (trades.length === 0) {
    return (
      <p className="border-t border-rule py-6 text-[13px] text-ink-soft">
        Открытых позиций нет.{" "}
        <Link href="/trades/new" className="underline underline-offset-2">
          Открыть сделку
        </Link>
      </p>
    );
  }

  return (
    <div>
      {/* Десктоп: табличные колонки */}
      <div className="hidden md:block">
        <div className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.9fr_0.9fr_0.9fr_0.7fr] gap-3 border-y border-rule py-1.5 text-[11px] text-ink-soft">
          <span>Пара</span>
          <span>Напр.</span>
          <span className="text-right">Вход</span>
          <span className="text-right">Стоп</span>
          <span className="text-right">Риск, $</span>
          <span className="text-right">Позиция, $</span>
          <span className="text-right">Маржа, $</span>
          <span className="text-right">Закрыто</span>
        </div>
        {trades.map((trade) => (
          <Link
            key={trade.id}
            href={`/trades/${trade.id}`}
            className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.9fr_0.9fr_0.9fr_0.7fr] items-center gap-3 border-b border-rule py-2 text-[13px] hover:bg-white"
          >
            <span className="truncate font-medium">{trade.pair}</span>
            <span className="text-[12px]">
              <DirectionTag direction={trade.direction} />
            </span>
            <span className="num text-right">{price(trade.entryPrice)}</span>
            <span className="num text-right">{price(trade.stopLoss)}</span>
            <span className="num text-right">{money(trade.riskAmount)}</span>
            <span className="num text-right">{money(trade.positionSize)}</span>
            <span className="num text-right">
              {money(trade.margin)}
              <span className="text-ink-soft"> · {trade.leverage}×</span>
            </span>
            <span className="num text-right text-ink-soft">
              {trade.closedPct.toFixed(0)}%
            </span>
          </Link>
        ))}
      </div>

      {/* Мобильная: строка-карточка с прогресс-баром */}
      <div className="md:hidden">
        {trades.map((trade) => (
          <Link
            key={trade.id}
            href={`/trades/${trade.id}`}
            className="block border-b border-rule py-3 first:border-t"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-medium">
                {trade.pair}{" "}
                <span className="text-[12px] font-normal">
                  <DirectionTag direction={trade.direction} />
                </span>
              </span>
              <span className="num text-[13px]">
                {money(trade.riskAmount)}
                <span className="text-ink-soft"> · маржа {money(trade.margin)}</span>
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-ink-soft">
              <span className="num">
                {price(trade.entryPrice)} → {price(trade.stopLoss)}
              </span>
              <span className="num">{shortDate(trade.createdAt)}</span>
            </div>
            <div className="mt-2">
              <ProgressBar value={trade.closedPct} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
