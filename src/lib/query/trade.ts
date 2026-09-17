"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TradeWithFixes } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";
import { clearCreation, trackCreation } from "@/lib/query/pending";
import type { FixDTO, TradeDTO } from "@/lib/serialize";
import { applyFix, reconcileFix, removeFix, validateNewFix } from "@/lib/trade-local";

/**
 * Сделка в кеше Query. SSR отдаёт первые данные через initialData, дальше
 * страница живёт из кеша: мутации патчат его сразу, сервер подтверждает потом.
 */
export function useTrade(id: string, initialData: TradeWithFixes) {
  // Момент гидрации фиксируем один раз: initialData считается свежей ровно
  // столько же, сколько любые данные, иначе Query перезапросит сделку сразу.
  const [hydratedAt] = useState(() => Date.now());
  return useQuery({
    queryKey: queryKeys.trade(id),
    queryFn: () => api.getTrade(id),
    initialData,
    initialDataUpdatedAt: hydratedAt,
  });
}

export type NewFixInput = {
  id: string;
  price: number;
  sizePct: number;
  type: "manual" | "stop";
};

/**
 * Оптимистичное добавление фиксации.
 * onMutate — снимок кеша и мгновенный патч; onError — откат к снимку;
 * onSuccess — серверные данные заменяют оптимистичные; onSettled — сверка.
 */
export function useAddFix(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (input: NewFixInput) => api.addFix(tradeId, input),

    onMutate: async (input) => {
      // Отменяем фоновые перезапросы, чтобы они не перетёрли наш патч.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TradeWithFixes>(key);
      if (!previous) return { previous };

      // Те же правила, что у сервера: не рисуем то, что он точно отвергнет.
      const problem = validateNewFix(previous, input.sizePct);
      if (problem) throw new Error(problem);

      const optimistic: FixDTO = {
        id: input.id,
        tradeId,
        price: input.price,
        sizePct: input.sizePct,
        type: input.type,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<TradeWithFixes>(key, applyFix(previous, optimistic));
      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSuccess: (data) => {
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? reconcileFix(current, data) : current,
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteFix(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (fixId: string) => api.deleteFix(tradeId, fixId),

    onMutate: async (fixId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TradeWithFixes>(key);
      if (previous) queryClient.setQueryData<TradeWithFixes>(key, removeFix(previous, fixId));
      return { previous };
    },

    onError: (_error, _fixId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Правка параметров: без оптимистики — ответ сервера просто кладём в кеш. */
export function useUpdateTrade(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateTrade(tradeId, body),
    onSuccess: (data: { trade: TradeDTO }) => {
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, trade: data.trade } : current,
      );
    },
  });
}

/**
 * Открытие сделки оптимистично: карточка рисуется из локально посчитанного DTO
 * сразу, POST уходит в фоне. Зависимые запросы (фиксации, правка) ждут его
 * через реестр pending — UI при этом ничего не ждёт.
 */
export function useCreateTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { snapshot: TradeWithFixes; body: Record<string, unknown> }) => {
      const promise = api.createTrade(input.body);
      trackCreation(input.snapshot.trade.id, promise);
      return promise;
    },
    onMutate: ({ snapshot }) => {
      queryClient.setQueryData<TradeWithFixes>(queryKeys.trade(snapshot.trade.id), snapshot);
    },
    onSuccess: (data, { snapshot }) => {
      queryClient.setQueryData<TradeWithFixes>(queryKeys.trade(snapshot.trade.id), (current) =>
        current ? { ...current, trade: data.trade } : { trade: data.trade, fixes: [] },
      );
    },
    onError: (_error, { snapshot }) => {
      // Кеш оставляем: карточка с ошибкой и «Повторить» живёт из него.
      clearCreation(snapshot.trade.id);
    },
  });
}
