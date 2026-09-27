"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "num mt-1 w-full rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink";

export function PasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setPending(true);

    const response = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось сменить пароль");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setDone(true);
    // Список устройств теперь из одного — перечитываем страницу.
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 max-w-[560px]">
      {/* Скрытое поле с логином — чтобы менеджер паролей iPhone понял, для какой учётки новый пароль. */}
      <input type="email" autoComplete="username" value={email} hidden readOnly />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="currentPassword" className="block text-[11px] text-ink-soft">
            Текущий пароль
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-[11px] text-ink-soft">
            Новый пароль
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending || !currentPassword || newPassword.length < 8}
            className="w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {pending ? "…" : "Сменить"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-ink-soft">
        Минимум 8 символов. Остальные устройства сразу разлогинятся.
      </p>
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}
      {done ? <p className="mt-2 text-[12px] text-long">Пароль изменён</p> : null}
    </form>
  );
}
