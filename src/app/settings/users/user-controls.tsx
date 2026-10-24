"use client";

import { useState } from "react";
import { OneTimeLink } from "@/components/one-time-link";

/**
 * Ссылка для сброса пароля. Только обычному пользователю: админы меняют
 * пароль сами в настройках.
 */
export function UserControls({
  userId,
  email,
  isSelf,
  isAdmin,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
  isAdmin: boolean;
}) {
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createResetLink() {
    setPending(true);
    setError(null);
    setResetUrl(null);
    const response = await fetch(`/api/admin/users/${userId}/reset-link`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось создать ссылку");
      return;
    }
    setResetUrl(data.url);
  }

  return (
    <div className="mt-1.5">
      <div className="flex justify-end">
        {isSelf || isAdmin ? (
          <span className="text-[11px] text-ink-soft">
            {isSelf ? "это ты" : "пароль меняет сам"}
          </span>
        ) : (
          <button
            type="button"
            onClick={createResetLink}
            disabled={pending}
            className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
          >
            {pending ? "…" : "ссылка для сброса пароля"}
          </button>
        )}
      </div>

      {error ? <p className="mt-1 text-[12px] text-short">{error}</p> : null}
      {resetUrl ? (
        <OneTimeLink
          note={`Сброс пароля для ${email}: одноразовая ссылка на 24 часа.`}
          url={resetUrl}
        />
      ) : null}
    </div>
  );
}
