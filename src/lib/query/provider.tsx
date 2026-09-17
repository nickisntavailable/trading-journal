"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * Один QueryClient на вкладку. Создаётся в useState, а не на уровне модуля,
 * чтобы при SSR не делить кеш между запросами разных пользователей.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Данные приходят из SSR свежими; перезапрашивать при каждом
            // фокусе окна незачем — журнал правит один человек.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            // Мутации с деньгами не ретраим молча: пусть ошибка дойдёт до UI.
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
