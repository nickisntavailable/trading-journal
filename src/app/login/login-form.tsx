"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ from }: { from?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => ({ error: "Ошибка входа" }));
    setError(data.error ?? "Ошибка входа");
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-rule pt-5">
      <label htmlFor="password" className="block text-[12px] text-ink-soft">
        Пароль
      </label>
      <input
        id="password"
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="num mt-1.5 w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink"
      />
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || password.length === 0}
        className="mt-4 w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
      >
        {pending ? "Проверяю…" : "Войти"}
      </button>
    </form>
  );
}
