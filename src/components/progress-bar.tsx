/** Прогресс закрытия позиции: сумма sizePct всех фиксаций. */
export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(value, 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-white ring-1 ring-rule ring-inset">
      <div className="h-full bg-ink-soft" style={{ width: `${clamped}%` }} />
    </div>
  );
}
