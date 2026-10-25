"use client";

import { useEffect, useState } from "react";
import {
  isTelegramLaunch,
  isTelegramManual,
  loadTelegramWebApp,
  markTelegramManual,
  signInWithTelegram,
} from "@/lib/telegram/web-app";

type State =
  | { kind: "browser" }
  | { kind: "manual" }
  | { kind: "signing" }
  | { kind: "not-linked" }
  | { kind: "error"; message: string };

/**
 * Страница входа внутри Telegram входит сама: сюда попадают, только когда
 * сессии нет (первый раз или после выхода) — с живой сессией кнопка бота
 * открывает журнал сразу. Не вышло — показываем причину и обычную форму.
 */
export function TelegramLogin({
  from,
  children,
}: {
  from?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "browser" });

  async function signIn() {
    setState({ kind: "signing" });
    const app = await loadTelegramWebApp();
    if (!app?.initData) {
      setState({ kind: "browser" });
      return;
    }
    const result = await signInWithTelegram(app.initData);
    if (result.kind === "ok") {
      markTelegramManual(false);
      // Полная загрузка: серверные страницы должны увидеть новую cookie.
      const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
      window.location.replace(target);
      return;
    }
    setState(result);
  }

  useEffect(() => {
    if (!isTelegramLaunch()) return;
    if (isTelegramManual()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: "manual" });
      return;
    }
    void signIn();
    // signIn меняется на каждом рендере, а запускать нужно один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === "signing") {
    return <p className="mt-6 text-[13px] text-ink-soft">Вхожу через Telegram…</p>;
  }

  return (
    <>
      {state.kind === "manual" ? (
        <div className="mt-6 border-t border-rule pt-5">
          <button
            type="button"
            onClick={() => void signIn()}
            className="w-full rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white"
          >
            Войти через Telegram
          </button>
        </div>
      ) : null}
      {state.kind === "not-linked" ? (
        <p className="mt-6 border-t border-rule pt-5 text-[13px]">
          Этот Telegram пока не привязан к журналу. Войди по почте и привяжи Telegram в настройках —
          дальше вход отсюда будет сразу.
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="mt-6 border-t border-rule pt-5 text-[13px] text-short">{state.message}</p>
      ) : null}
      {children}
    </>
  );
}
