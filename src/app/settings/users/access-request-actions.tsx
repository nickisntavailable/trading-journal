"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** «Пустить / Отклонить» заявку из бота — запасной путь к кнопкам в Telegram. */
export function AccessRequestActions({ id, rejected }: { id: string; rejected: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/admin/access-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) setError(data.error ?? "Не получилось");
    router.refresh();
  }

  return (
    <span className="flex shrink-0 items-baseline gap-3 text-[12px]">
      <button
        type="button"
        onClick={() => decide("approve")}
        disabled={pending}
        className="text-long underline underline-offset-2 disabled:opacity-40"
      >
        пустить
      </button>
      {rejected ? null : (
        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={pending}
          className="text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
        >
          отклонить
        </button>
      )}
      {error ? <span className="text-short">{error}</span> : null}
    </span>
  );
}
