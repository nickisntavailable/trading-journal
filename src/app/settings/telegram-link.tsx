"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Привязка Telegram к учётке: одноразовая ссылка на бота, человек жмёт
 * Start — и его Telegram привязан. Ссылку показываем кнопкой, а не
 * открываем сами: браузер блокирует окна, открытые после запроса.
 */
export function TelegramLink({
  linked,
  configured,
}: {
  linked: { username: string | null; firstName: string | null } | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createLink() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/telegram/link", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setError(data.error ?? "Не удалось создать ссылку");
      return;
    }
    setUrl(data.url);
  }

  async function unlink() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/telegram/link", { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      setError("Не удалось отвязать");
      return;
    }
    router.refresh();
  }

  if (!configured) {
    return <p className="mt-2 text-[12px] text-ink-soft">Бот не настроен в этом окружении.</p>;
  }

  if (linked) {
    return (
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-[13px]">
        <span>
          Привязан{" "}
          <span className="num">
            {linked.username ? `@${linked.username}` : (linked.firstName ?? "")}
          </span>
        </span>
        <button
          type="button"
          onClick={unlink}
          disabled={pending}
          className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
        >
          {pending ? "…" : "отвязать"}
        </button>
        {error ? <p className="w-full text-[12px] text-short">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 text-[13px]">
      {url ? (
        <div className="rounded-[3px] border border-rule bg-white px-3 py-2.5">
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="text-[13px] font-medium underline underline-offset-2"
          >
            Открыть бота и нажать Start
          </a>
          <p className="mt-1 text-[11px] text-ink-soft">
            Ссылка одноразовая, работает 10 минут. После Start в боте —{" "}
            <button type="button" onClick={() => router.refresh()} className="underline underline-offset-2">
              обновить
            </button>
            .
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={createLink}
          disabled={pending}
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-[12px] hover:border-ink disabled:opacity-40"
        >
          {pending ? "…" : "Привязать Telegram"}
        </button>
      )}
      <p className="mt-2 text-[11px] text-ink-soft">
        Второй способ входа в эту же учётку: сделки и пароль остаются. Сюда же придут сигналы
        безопасности.
      </p>
      {error ? <p className="mt-1 text-[12px] text-short">{error}</p> : null}
    </div>
  );
}
