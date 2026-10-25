"use client";

import { useEffect } from "react";
import {
  isTelegramLaunch,
  loadTelegramWebApp,
  rememberTelegramLaunch,
} from "@/lib/telegram/web-app";

/**
 * Внутри Telegram: сказать ему, что журнал готов, и развернуть на весь экран.
 * Флаг запоминается на сеанс — следующие страницы уже не ищут признаки в
 * адресе. В обычном браузере ничего не делает и скрипт Telegram не грузит.
 */
export function TelegramBridge() {
  useEffect(() => {
    if (!isTelegramLaunch()) return;
    rememberTelegramLaunch();
    void loadTelegramWebApp().then((app) => {
      app?.ready();
      app?.expand();
    });
  }, []);
  return null;
}
