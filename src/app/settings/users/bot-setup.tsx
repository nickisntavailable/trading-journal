"use client";

import { useEffect, useState } from "react";

type Status =
  | { configured: false }
  | {
      configured: true;
      username: string | null;
      webhook: { url: string; pending_update_count: number; last_error_message?: string } | null;
    };

/**
 * Бот журнала: подключён ли он к этому сайту. «Подключить» говорит Telegram,
 * куда слать сообщения боту, — нажимать на проде.
 */
export function BotSetup() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch("/api/admin/telegram");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Не удалось узнать состояние бота");
      return;
    }
    setStatus(data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function connect() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/admin/telegram", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось подключить");
      return;
    }
    await load();
  }

  if (!status) {
    return <p className="mt-2 text-[12px] text-ink-soft">{error ?? "…"}</p>;
  }
  if (!status.configured) {
    return (
      <p className="mt-2 text-[12px] text-ink-soft">
        Бот не настроен: нет TELEGRAM_BOT_TOKEN в этом окружении.
      </p>
    );
  }

  const here = typeof window !== "undefined" ? `${window.location.origin}/api/telegram/webhook` : "";
  const connected = status.webhook?.url === here;
  return (
    <div className="mt-2 text-[13px]">
      <p>
        <span className="num">@{status.username}</span> ·{" "}
        {connected ? (
          <span className="text-long">подключён к этому сайту</span>
        ) : status.webhook?.url ? (
          <span className="text-amber">подключён к другому адресу</span>
        ) : (
          <span className="text-ink-soft">не подключён</span>
        )}
      </p>
      {status.webhook?.last_error_message ? (
        <p className="mt-1 text-[12px] text-short">
          Последняя ошибка Telegram: {status.webhook.last_error_message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="mt-2 rounded-[3px] border border-rule bg-white px-3 py-1.5 text-[12px] hover:border-ink disabled:opacity-40"
      >
        {pending ? "…" : connected ? "Подключить заново" : "Подключить бота"}
      </button>
      {error ? <p className="mt-1 text-[12px] text-short">{error}</p> : null}
    </div>
  );
}
