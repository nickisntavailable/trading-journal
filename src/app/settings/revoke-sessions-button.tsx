"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeSessionsButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/account/sessions", { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не получилось");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-[12px] hover:border-ink disabled:opacity-40"
      >
        {pending ? "Выхожу…" : "Выйти на остальных устройствах"}
      </button>
      <p className="mt-1 text-[11px] text-ink-soft">
        Сессии удаляются сразу, но уже открытые страницы работают до 5 минут.
      </p>
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
    </div>
  );
}
