/**
 * Очередь запросов по ключу: следующий уходит, только когда закончился
 * предыдущий. Нужна, чтобы быстрые тапы «включить → выключить» дошли до
 * сервера в том же порядке.
 *
 * Встроенный `scope` у мутаций TanStack Query делает то же самое, но
 * продолжает очередь только на видимой странице (focusManager): тапнул теги,
 * свернул Safari — и хвост очереди ждёт возвращения, а при закрытой вкладке
 * теряется. Своя цепочка промисов от видимости не зависит.
 */
const tails = new Map<string, Promise<unknown>>();

export function serial<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  // Ошибка предыдущего запроса не должна останавливать следующие.
  const next = previous.catch(() => undefined).then(run);
  tails.set(key, next);
  // Хвост закончился и новых не появилось — ключ больше не нужен.
  void next
    .catch(() => undefined)
    .then(() => {
      if (tails.get(key) === next) tails.delete(key);
    });
  return next;
}
