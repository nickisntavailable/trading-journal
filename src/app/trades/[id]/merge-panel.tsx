"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { positionFromEntries, validateEntriesAgainstStop } from "@/lib/entries-math";
import { dateTime, money, pct, price } from "@/lib/format";
import { useMergeTrades } from "@/lib/query/entries";
import type { EntryDTO, TradeDTO } from "@/lib/serialize";

export type MergeCandidate = {
  id: string;
  createdAt: string;
  stopLoss: number;
  riskAmount: number;
  entries: EntryDTO[];
};

/**
 * «Есть ещё открытая BTCUSDT long — объединить». Предпросмотр считается
 * здесь же теми же формулами, что и сервер: к более ранней сделке
 * добавляются входы более поздней, стоп — у поздней.
 */
export function MergePanel({
  trade,
  entries,
  candidates,
}: {
  trade: TradeDTO;
  entries: EntryDTO[];
  candidates: MergeCandidate[];
}) {
  const router = useRouter();
  const merge = useMergeTrades();
  const [openId, setOpenId] = useState<string | null>(null);

  if (candidates.length === 0) return null;

  function preview(candidate: MergeCandidate) {
    const currentFirst = trade.createdAt <= candidate.createdAt;
    const stopLoss = currentFirst ? candidate.stopLoss : trade.stopLoss;
    const all = [...entries, ...candidate.entries].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    return {
      stopLoss,
      entries: all,
      before: trade.riskAmount + candidate.riskAmount,
      error: validateEntriesAgainstStop(all, stopLoss, trade.direction),
      position: positionFromEntries(all, stopLoss, trade.direction, trade.depositAtEntry),
    };
  }

  function onMerge(candidate: MergeCandidate) {
    merge.mutate([trade.id, candidate.id], {
      onSuccess: (data) => {
        setOpenId(null);
        // Были на поздней сделке — её больше нет, переходим к объединённой.
        if (data.removedId === trade.id) router.replace(`/trades/${data.trade.id}`);
        // Дашборд и список подсказок обновятся с сервера.
        router.refresh();
      },
    });
  }

  return (
    <section className="border-b border-rule py-4">
      {candidates.map((candidate) => {
        const isOpen = openId === candidate.id;
        const p = isOpen ? preview(candidate) : null;
        return (
          <div key={candidate.id} className="text-[12px]">
            <p className="rounded-[3px] bg-white px-3 py-2 text-ink-soft">
              Есть ещё открытая{" "}
              <span className="text-ink">
                {trade.pair} {trade.direction === 1 ? "long" : "short"}
              </span>{" "}
              от <span className="num">{dateTime(candidate.createdAt)}</span> —{" "}
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : candidate.id)}
                className="text-ink underline underline-offset-2"
              >
                {isOpen ? "скрыть" : "объединить"}
              </button>
            </p>

            {p ? (
              <div className="mt-3 max-w-[420px]">
                <p className="text-[13px] font-medium">Объединить в одну позицию</p>
                <Row label="Входы" value={p.entries.map((e) => price(e.price)).join(" · ")} />
                <Row label="Средний вход" value={price(p.position.entryPrice)} />
                <Row label="Стоп (от последней)" value={price(p.stopLoss)} />
                <Row
                  label="Риск"
                  value={`${money(p.before)} → ${money(p.position.riskAmount)} · ${pct(p.position.riskPct)}`}
                />
                <p className="mt-2 text-[11px] text-ink-soft">
                  Теги и заметки сложатся. Более поздняя сделка исчезнет из списка и станет
                  добором. Отменить объединение нельзя.
                </p>
                {p.error ? (
                  <p className="mt-2 text-[12px] text-short">
                    Со стопом последней сделки: {p.error.toLowerCase()}
                  </p>
                ) : null}
                {merge.error ? (
                  <p className="mt-2 text-[12px] text-short">Не получилось: {merge.error.message}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onMerge(candidate)}
                    disabled={merge.isPending || !!p.error}
                    className="rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                  >
                    {merge.isPending ? "Объединяю…" : "Объединить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule py-1.5">
      <span className="text-ink-soft">{label}</span>
      <span className="num text-right">{value}</span>
    </div>
  );
}
