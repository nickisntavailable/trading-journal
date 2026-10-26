"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_EVERY_MS = 2_500;
/** Ссылка живёт 10 минут — дольше ждать незачем. */
const POLL_FOR_MS = 10 * 60 * 1000;

/**
 * Привязка Telegram к учётке: одноразовая ссылка на бота, человек жмёт
 * Start — и его Telegram привязан. Ссылку показываем кнопкой, а не
 * открываем сами: браузер блокирует окна, открытые после запроса.
 */
export function TelegramLink({
  linked,
  configured,
  canUnlink,
}: {
  linked: { username: string | null; firstName: string | null } | null;
  configured: boolean;
  /** Нет пароля — Telegram единственный вход, отвязывать нельзя. */
  canUnlink: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Пока открыта ссылка на бота — раз в пару секунд спрашиваем, привязался ли
  // Telegram, и обновляем страницу сами: не нужно жать «обновить».
  useEffect(() => {
    if (!url) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_FOR_MS) {
        clearInterval(timer);
        return;
      }
      const response = await fetch("/api/telegram/link").catch(() => null);
      const data = await response?.json().catch(() => null);
      if (data?.linked) {
        clearInterval(timer);
        setUrl(null);
        router.refresh();
      }
    }, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, [url, router]);

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
        {canUnlink ? (
          <button
            type="button"
            onClick={unlink}
            disabled={pending}
            className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink disabled:opacity-40"
          >
            {pending ? "…" : "отвязать"}
          </button>
        ) : (
          <span className="text-[12px] text-ink-soft">единственный способ входа</span>
        )}
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
            Ссылка одноразовая, работает 10 минут. После Start в боте страница обновится
            сама.
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
