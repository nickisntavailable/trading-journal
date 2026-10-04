"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { entryForRisk, positionFromEntries } from "@/lib/entries-math";
import { api, type TradeWithFixes } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";
import { serial } from "@/lib/query/serial";
import type { EntryDTO, TradeDTO } from "@/lib/serialize";

/** Поля сделки, пересчитанные из входов, — теми же формулами, что и сервер. */
function recompute(trade: TradeDTO, entries: EntryDTO[], stopLoss: number): TradeDTO {
  return {
    ...trade,
    stopLoss,
    ...positionFromEntries(entries, stopLoss, trade.direction, trade.depositAtEntry),
  };
}

type Snapshot = Pick<TradeWithFixes, "trade" | "entries">;

/**
 * Добор — оптимистично: новый вход и пересчитанные цифры видны сразу, сервер
 * подтверждает в фоне. Запросы входов одной сделки идут по очереди.
 * При ошибке возвращаем сделку и входы к снимку до этого добора.
 */
export function useAddEntry(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (input: { id: string; price: number; riskPct: number; stopLoss: number }) =>
      serial(`trade-entries:${tradeId}`, () => api.addEntry(tradeId, input)),

    onMutate: async (input): Promise<{ previous?: Snapshot }> => {
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<TradeWithFixes>(key);
      if (!current) return {};

      const add = entryForRisk(input.price, input.stopLoss, input.riskPct, current.trade.depositAtEntry);
      const entry: EntryDTO = {
        id: input.id,
        price: add.price,
        size: add.size,
        riskPct: input.riskPct,
        createdAt: new Date().toISOString(),
      };
      const entries = [...current.entries, entry];
      queryClient.setQueryData<TradeWithFixes>(key, {
        ...current,
        entries,
        trade: recompute(current.trade, entries, input.stopLoss),
      });
      return { previous: { trade: current.trade, entries: current.entries } };
    },

    onError: (_error, _input, context) => {
      if (!context?.previous) return;
      const previous = context.previous;
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, ...previous } : current,
      );
    },

    onSuccess: (data) => {
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, trade: data.trade, entries: data.entries } : current,
      );
    },
  });
}

/** Снять последний добор — тоже оптимистично. */
export function useRemoveEntry(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (entryId: string) =>
      serial(`trade-entries:${tradeId}`, () => api.removeEntry(tradeId, entryId)),

    onMutate: async (entryId): Promise<{ previous?: Snapshot }> => {
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<TradeWithFixes>(key);
      if (!current) return {};
      const entries = current.entries.filter((e) => e.id !== entryId);
      queryClient.setQueryData<TradeWithFixes>(key, {
        ...current,
        entries,
        trade: recompute(current.trade, entries, current.trade.stopLoss),
      });
      return { previous: { trade: current.trade, entries: current.entries } };
    },

    onError: (_error, _entryId, context) => {
      if (!context?.previous) return;
      const previous = context.previous;
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, ...previous } : current,
      );
    },

    onSuccess: (data) => {
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, trade: data.trade, entries: data.entries } : current,
      );
    },
  });
}
