/**
 * Сделка, открытая оптимистично, какое-то время существует только на клиенте.
 * Если пользователь тут же добавит фиксацию, её POST не должен обогнать POST
 * самой сделки. Здесь регистрируется обещание «сделка создана», и запросы,
 * зависящие от неё, ждут его перед отправкой. UI при этом не ждёт ничего.
 */
const pending = new Map<string, Promise<unknown>>();

export function trackCreation(tradeId: string, promise: Promise<unknown>) {
  pending.set(tradeId, promise);
  promise.then(
    () => pending.delete(tradeId),
    () => {
      /* оставляем отклонённое обещание: зависимые запросы получат ту же ошибку */
    },
  );
}

export function clearCreation(tradeId: string) {
  pending.delete(tradeId);
}

export async function awaitCreation(tradeId: string): Promise<void> {
  const promise = pending.get(tradeId);
  if (!promise) return;
  try {
    await promise;
  } catch {
    throw new Error("Сделка ещё не сохранена на сервере — повтори после её сохранения");
  }
}
