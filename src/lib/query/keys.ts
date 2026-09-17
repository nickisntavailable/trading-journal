/** Ключи кеша в одном месте, чтобы инвалидация и патчи не расходились. */
export const queryKeys = {
  trade: (id: string) => ["trade", id] as const,
};
