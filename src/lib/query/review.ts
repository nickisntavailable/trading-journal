"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TradeWithFixes } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";
import { serial } from "@/lib/query/serial";
import type { TagDTO } from "@/lib/tags";

/** Теги счёта. На странице сделки SSR отдаёт их сразу, дальше живут в кеше. */
export function useTags(initialTags?: TagDTO[]) {
  const [hydratedAt] = useState(() => Date.now());
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: async () => (await api.getTags()).tags,
    initialData: initialTags,
    initialDataUpdatedAt: initialTags ? hydratedAt : undefined,
  });
}

function withTag(tagIds: string[], tagId: string, on: boolean): string[] {
  if (on) return tagIds.includes(tagId) ? tagIds : [...tagIds, tagId];
  return tagIds.filter((id) => id !== tagId);
}

/**
 * Отметить или снять тег в сделке — оптимистично.
 *
 * Патч кеша (onMutate) срабатывает сразу на каждый тап, а запросы одной
 * сделки уходят строго по одному через serial(). Без очереди «включить →
 * выключить» двойным тапом могли бы дойти до сервера в обратном порядке, и
 * тег остался бы включённым.
 *
 * При ошибке откатываем только этот тег, а не весь снимок: следующие тапы
 * уже могли поменять другие теги, и полный откат стёр бы их.
 */
export function useToggleTradeTag(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  const patch = (tagId: string, on: boolean) =>
    queryClient.setQueryData<TradeWithFixes>(key, (current) =>
      current ? { ...current, tagIds: withTag(current.tagIds, tagId, on) } : current,
    );

  const mutation = useMutation({
    mutationFn: ({ tagId, on }: { tagId: string; on: boolean }) =>
      serial(`trade-tags:${tradeId}`, () => api.setTradeTag(tradeId, tagId, on)),
    onMutate: ({ tagId, on }) => {
      patch(tagId, on);
    },
    onError: (_error, { tagId, on }) => {
      patch(tagId, !on);
    },
  });

  /**
   * Переключить тег. Включён ли он, смотрим в кеше в момент тапа, а не в
   * отрисованном состоянии: Query сообщает компоненту об изменении кеша
   * асинхронно, и второй быстрый тап увидел бы ещё старое значение — на тесте
   * двойной тап «выключить» отправлял «включить» дважды.
   */
  function toggle(tagId: string) {
    const current = queryClient.getQueryData<TradeWithFixes>(key);
    mutation.mutate({ tagId, on: !current?.tagIds.includes(tagId) });
  }

  return { toggle, error: mutation.error };
}

/**
 * «+ тег» прямо в сделке: создать тег (или вернуть существующий) и сразу
 * отметить. Создание ждём — без id тега отмечать нечего, — а отметка дальше
 * идёт обычным оптимистичным путём.
 */
export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createTag(name),
    onSuccess: ({ tag }) => {
      queryClient.setQueryData<TagDTO[]>(queryKeys.tags(), (current) => {
        const list = current ?? [];
        const existing = list.find((t) => t.id === tag.id);
        if (existing) return list.map((t) => (t.id === tag.id ? { ...t, archived: false } : t));
        return [...list, { ...tag, archived: false, tradeCount: 0 }].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
    },
  });
}

/**
 * Заметка. Текст в поле — собственное состояние формы, кеш обновляется по
 * ответу сервера. Тоже через serial(): если два сохранения подряд разойдутся
 * в сети, на сервере всё равно останется более позднее.
 */
export function useSaveNote(tradeId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.trade(tradeId);

  return useMutation({
    mutationFn: (note: string) => serial(`trade-note:${tradeId}`, () => api.setNote(tradeId, note)),
    onSuccess: ({ note }) => {
      queryClient.setQueryData<TradeWithFixes>(key, (current) =>
        current ? { ...current, trade: { ...current.trade, note } } : current,
      );
    },
  });
}
