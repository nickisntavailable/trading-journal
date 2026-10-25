"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type State =
  | { kind: "loading" }
  | { kind: "outside" }
  | { kind: "not-linked" }
  | { kind: "error"; message: string };

/** Сколько ждать скрипт Telegram, прежде чем решить, что мы не в Telegram. */
const WAIT_FOR_TELEGRAM_MS = 3_000;

/**
 * Вход из Mini App: берём initData у Telegram и меняем на сессию журнала.
 * Подпись проверяет сервер — сам клиент ничему из initData не доверяет.
 */
export function MiniAppLogin() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function signIn(app: TelegramWebApp) {
      app.ready();
      app.expand();
      const response = await fetch("/api/auth/telegram/mini-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: app.initData }),
      }).catch(() => null);
      if (cancelled) return;
      if (response?.ok) {
        // Полная загрузка, а не переход внутри Next: серверные страницы должны
        // увидеть только что поставленную cookie сессии.
        window.location.replace("/");
        return;
      }
      const data = await response?.json().catch(() => null);
      if (data?.code === "TELEGRAM_NOT_LINKED") setState({ kind: "not-linked" });
      else setState({ kind: "error", message: data?.message ?? "Не удалось войти" });
    }

    const timer = setInterval(() => {
      const app = window.Telegram?.WebApp;
      if (app?.initData) {
        clearInterval(timer);
        void signIn(app);
      } else if (Date.now() - started > WAIT_FOR_TELEGRAM_MS) {
        clearInterval(timer);
        setState({ kind: "outside" });
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (state.kind === "loading") {
    return <p className="mt-6 text-[13px] text-ink-soft">Вхожу через Telegram…</p>;
  }

  if (state.kind === "not-linked") {
    return (
      <p className="mt-6 border-t border-rule pt-5 text-[13px]">
        Этот Telegram пока не привязан к журналу. Войди на сайте по почте и привяжи Telegram в
        настройках — после этого вход отсюда будет в один тап.
      </p>
    );
  }

  if (state.kind === "outside") {
    return (
      <p className="mt-6 border-t border-rule pt-5 text-[13px]">
        Эта страница открывается из Telegram — кнопкой «Журнал» в боте. В браузере —{" "}
        <Link href="/login" className="underline underline-offset-2">
          обычный вход
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="mt-6 border-t border-rule pt-5 text-[13px] text-short">
      {state.message}.{" "}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-ink underline underline-offset-2"
      >
        Попробовать ещё раз
      </button>
    </p>
  );
}
