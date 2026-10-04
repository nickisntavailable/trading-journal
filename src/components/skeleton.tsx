import { AppShell } from "@/components/app-shell";

/**
 * Скелеты страниц для loading.tsx. Next показывает их в тот же кадр, что и
 * клик по ссылке, пока сервер готовит настоящую страницу: без них на экране
 * до ответа оставалась старая страница, и казалось, что клик не сработал.
 *
 * Раскладка повторяет настоящую страницу, чтобы при подмене ничего не прыгало.
 */
export function SkeletonPage({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div role="status" aria-busy="true">
        <span className="sr-only">Загрузка…</span>
        <div aria-hidden="true">{children}</div>
      </div>
    </AppShell>
  );
}

/** Серая полоса на месте текста или поля. */
export function Bar({ className = "" }: { className?: string }) {
  return <div className={"rounded-[2px] bg-rule motion-safe:animate-pulse " + className} />;
}

/** Подпись + значение, как Param/Metric на настоящих страницах. */
export function LabeledBar({ valueWidth = "w-24" }: { valueWidth?: string }) {
  return (
    <div>
      <Bar className="h-2.5 w-14" />
      <Bar className={"mt-2 h-4 " + valueWidth} />
    </div>
  );
}

/** Поле ввода с подписью. */
export function FieldBar() {
  return (
    <div>
      <Bar className="h-2.5 w-16" />
      <Bar className="mt-1.5 h-10 w-full" />
    </div>
  );
}

/** Строка списка: слева пара/дата, справа сумма. */
export function RowBar() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule py-3">
      <div>
        <Bar className="h-3.5 w-24" />
        <Bar className="mt-1.5 h-2.5 w-16" />
      </div>
      <Bar className="h-3.5 w-20" />
    </div>
  );
}
