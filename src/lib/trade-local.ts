import type { FixDTO, TradeDTO } from "@/lib/serialize";
import { closeTrade } from "@/lib/trading-math";

/**
 * Локальное применение изменений к сделке — то, что оптимистичный UI показывает
 * до ответа сервера. Считает теми же формулами, что и сервер (lib/trading-math),
 * поэтому после подтверждения цифры не «прыгают».
 */

export type TradeSnapshot = { trade: TradeDTO; fixes: FixDTO[] };

// Тот же допуск, что и на сервере: Decimal(5,2).
const EPS = 0.005;

export function closedPctOf(fixes: FixDTO[]): number {
  return fixes.reduce((acc, f) => acc + f.sizePct, 0);
}

/** Текст ошибки, если фиксацию нельзя добавить — те же правила, что у сервера. */
export function validateNewFix(snapshot: TradeSnapshot, sizePct: number): string | null {
  if (snapshot.trade.status === "closed") {
    return "Сделка уже закрыта — фиксации не добавляются";
  }
  const existing = closedPctOf(snapshot.fixes);
  if (existing + sizePct > 100 + EPS) {
    return `Суммарный объём фиксаций не может превышать 100%: уже зафиксировано ${existing.toFixed(2)}%, остаток ${(100 - existing).toFixed(2)}%`;
  }
  return null;
}

/** Добавляет фиксацию; при достижении 100% закрывает сделку и считает результат. */
export function applyFix(snapshot: TradeSnapshot, fix: FixDTO): TradeSnapshot {
  const fixes = [...snapshot.fixes, fix];
  const totalPct = closedPctOf(fixes);

  if (totalPct < 100 - EPS) {
    return { trade: snapshot.trade, fixes };
  }

  const result = closeTrade(snapshot.trade, fixes);
  return {
    fixes,
    trade: {
      ...snapshot.trade,
      status: "closed",
      closedAt: new Date().toISOString(),
      grossPnL: result.grossPnL,
      totalFees: result.totalFees,
      netPnL: result.netPnL,
      netPnlPctOfDeposit: result.netPnlPctOfDeposit,
      realizedAvgExit: result.realizedAvgExit,
      realizedRR: result.realizedRR,
    },
  };
}

export function removeFix(snapshot: TradeSnapshot, fixId: string): TradeSnapshot {
  return { trade: snapshot.trade, fixes: snapshot.fixes.filter((f) => f.id !== fixId) };
}

/** Ответ сервера заменяет оптимистичные данные: id совпадает, поля — серверные. */
export function reconcileFix(
  snapshot: TradeSnapshot,
  server: { fix: FixDTO; trade: TradeDTO },
): TradeSnapshot {
  const known = snapshot.fixes.some((f) => f.id === server.fix.id);
  return {
    trade: server.trade,
    fixes: known
      ? snapshot.fixes.map((f) => (f.id === server.fix.id ? server.fix : f))
      : [...snapshot.fixes, server.fix],
  };
}
