"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OneTimeLink } from "@/components/one-time-link";

/**
 * Управление пользователем: доступ к скриншотам и ссылка для сброса пароля.
 * Свой доступ не отключается. Ссылку сброса можно выписать только обычному
 * пользователю: админы меняют пароль сами в настройках.
 */
export function UserControls({
  userId,
  email,
  canParseScreenshots,
  isSelf,
  isAdmin,
}: {
  userId: string;
  email: string;
  canParseScreenshots: boolean;
  isSelf: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [screenshots, setScreenshots] = useState(canParseScreenshots);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"toggle" | "reset" | null>(null);

  async function toggle() {
    const next = !screenshots;
    setPending("toggle");
    setError(null);
    setScreenshots(next); // сразу — откатим, если сервер не согласится
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canParseScreenshots: next }),
    });
    setPending(null);
    if (!response.ok) {
      setScreenshots(!next);
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не удалось изменить доступ");
      return;
    }
    router.refresh();
  }

  async function createResetLink() {
    setPending("reset");
    setError(null);
    setResetUrl(null);
    const response = await fetch(`/api/admin/users/${userId}/reset-link`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setPending(null);
    if (!response.ok) {
      setError(data.error ?? "Не удалось создать ссылку");
      return;
    }
    setResetUrl(data.url);
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <button
          type="button"
          role="switch"
          aria-checked={screenshots}
          onClick={toggle}
          disabled={isSelf || pending !== null}
          className="flex items-center gap-2 text-[12px] disabled:cursor-default"
        >
          <span
            className={
              "relative inline-block h-[16px] w-[28px] rounded-full transition-colors " +
              (screenshots ? "bg-long" : "bg-rule")
            }
          >
            <span
              className={
                "absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white transition-all " +
                (screenshots ? "left-[14px]" : "left-[2px]")
              }
            />
          </span>
          <span className={screenshots ? "text-ink" : "text-ink-soft"}>скриншоты</span>
        </button>

        {isSelf || isAdmin ? (
          <span className="text-[11px] text-ink-soft">
            {isSelf ? "это ты" : "пароль меняет сам"}
          </span>
        ) : (
          <button
            type="button"
            onClick={createResetLink}
            disabled={pending !== null}
            className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
          >
            {pending === "reset" ? "…" : "ссылка для сброса пароля"}
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
