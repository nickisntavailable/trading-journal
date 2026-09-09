"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type EventType = "deposit" | "withdrawal" | "manual_adjustment";

const TYPE_LABELS: { value: EventType; label: string }[] = [
  { value: "deposit", label: "Пополнение" },
  { value: "withdrawal", label: "Снятие" },
  { value: "manual_adjustment", label: "Корректировка" },
];

const inputClass =
  "num w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function BalanceForm() {
  const router = useRouter();
  const [type, setType] = useState<EventType>("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const response = await fetch("/api/account/balance-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        amount: Number(amount),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось изменить баланс");
      return;
    }

    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 max-w-[560px]">
      <div className="flex flex-wrap gap-1.5">
        {TYPE_LABELS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setType(option.value)}
            className={
              "rounded-[3px] border px-3 py-1.5 text-[12px] " +
              (type === option.value
                ? "border-ink text-ink"
                : "border-rule bg-white text-ink-soft")
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_auto]">
        <div>
          <label htmlFor="amount" className="block text-[11px] text-ink-soft">
            Сумма
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass + " mt-1"}
          />
        </div>
        <div>
          <label htmlFor="note" className="block text-[11px] text-ink-soft">
            Комментарий
          </label>
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending || !amount}
            className="w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {pending ? "…" : "Записать"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">
        {type === "manual_adjustment"
          ? "Корректировка принимает знак как есть: отрицательное значение уменьшит баланс."
          : "Знак проставляется автоматически по типу операции."}
      </p>

      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
    </form>
  );
}
