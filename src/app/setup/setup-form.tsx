"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth-field";

export function SetupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, appPassword }),
    });

    if (response.ok) {
      router.replace("/");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => ({ error: "Не получилось" }));
    setError(data.error ?? "Не получилось");
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 border-t border-rule pt-5">
      <AuthField
        id="email"
        label="Почта"
        type="email"
        autoFocus
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <AuthField
        id="new-password"
        label="Новый пароль"
        hint="Минимум 8 символов"
        type="password"
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <AuthField
        id="app-password"
        label="Старый общий пароль"
        type="password"
        autoComplete="off"
        value={appPassword}
        onChange={(e) => setAppPassword(e.target.value)}
      />
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !email || password.length < 8 || !appPassword}
        className="mt-4 w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
      >
        {pending ? "Создаю…" : "Создать и войти"}
      </button>
    </form>
  );
}
