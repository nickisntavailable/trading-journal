"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField } from "@/components/auth-field";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
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
      {/* Почта не редактируется: учётка заводится только на ту, куда выписано приглашение. */}
      <AuthField id="email" label="Почта" type="email" autoComplete="username" value={email} readOnly />
      <AuthField
        id="new-password"
        label="Пароль"
        hint="Минимум 8 символов"
        type="password"
        autoFocus
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || password.length < 8}
        className="mt-4 w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
      >
        {pending ? "Создаю…" : "Создать учётку"}
      </button>
    </form>
  );
}
