"use client";

/**
 * Журнал внутри Telegram (Mini App) — браузерная часть.
 *
 * Кнопка «Журнал» в боте открывает сразу `/?tgapp=1`. С живой сессией
 * журнал открывается мгновенно; без неё proxy отправляет на /login, и та,
 * поняв, что мы в Telegram, входит сама по initData.
 *
 * Скрипт Telegram грузим только внутри Telegram — в обычном браузере он не
 * нужен и не подгружается.
 */
export type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const FLAG = "tj.tg";
const SCRIPT_SRC = "https://telegram.org/js/telegram-web-app.js";
const SCRIPT_TIMEOUT_MS = 4_000;

/**
 * Открыт ли журнал из Telegram. Признаки: метка tgapp в адресе (в том числе
 * внутри from после редиректа на /login), параметры запуска Telegram в
 * хеше адреса — или уже запомненный в этом сеансе флаг.
 */
export function isTelegramLaunch(): boolean {
  try {
    if (window.sessionStorage.getItem(FLAG) === "1") return true;
  } catch {
    /* нет хранилища — смотрим на адрес */
  }
  const { hash, search } = window.location;
  if (hash.includes("tgWebAppData")) return true;
  const params = new URLSearchParams(search);
  return params.has("tgapp") || (params.get("from") ?? "").includes("tgapp");
}

export function rememberTelegramLaunch(): void {
  try {
    window.sessionStorage.setItem(FLAG, "1");
  } catch {
    /* без запоминания — признаки в адресе всё равно сработают на первом экране */
  }
}

const MANUAL = "tj.tg.manual";

/**
 * После «Выйти» внутри Telegram страница входа не входит сама — иначе выход
 * тут же отменился бы. Вместо этого — кнопка «Войти через Telegram».
 */
export function markTelegramManual(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(MANUAL, "1");
    else window.sessionStorage.removeItem(MANUAL);
  } catch {
    /* без запоминания */
  }
}

export function isTelegramManual(): boolean {
  try {
    return window.sessionStorage.getItem(MANUAL) === "1";
  } catch {
    return false;
  }
}

let loading: Promise<TelegramWebApp | null> | null = null;

/** Подгрузить скрипт Telegram один раз; null — если не вышло или не в Telegram. */
export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loading ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    const timer = setTimeout(() => resolve(window.Telegram?.WebApp ?? null), SCRIPT_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      resolve(window.Telegram?.WebApp ?? null);
    };
    script.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type TelegramSignIn =
  | { kind: "ok" }
  | { kind: "not-linked" }
  | { kind: "error"; message: string };

/** Обменять initData на сессию журнала. Подпись проверяет сервер. */
export async function signInWithTelegram(initData: string): Promise<TelegramSignIn> {
  const response = await fetch("/api/auth/telegram/mini-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  }).catch(() => null);
  if (response?.ok) return { kind: "ok" };
  const data = await response?.json().catch(() => null);
  if (data?.code === "TELEGRAM_NOT_LINKED") return { kind: "not-linked" };
  return { kind: "error", message: data?.message ?? "Не удалось войти через Telegram" };
}
