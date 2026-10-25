"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Тонкая полоска вверху экрана, пока идёт переход между страницами.
 *
 * Зачем: после простоя первый ответ сервера идёт секунды (просыпаются база
 * Neon и функция Vercel), и без индикации кажется, что клик не сработал.
 * Скелеты страниц тут не спасают — их заготовку Next тоже подгружает через
 * сервер. Полоска — чисто браузерная: появляется в момент клика по любой
 * внутренней ссылке и уходит, когда сменился адрес.
 */
const SAFETY_TIMEOUT_MS = 20_000;

type Phase = "idle" | "loading" | "done";

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // Адрес сменился — переход завершён (или показан скелет страницы).
  useEffect(() => {
    clearTimers();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase((current) => (current === "loading" ? "done" : current));
    timers.current.push(setTimeout(() => setPhase("idle"), 400));
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Next <Link> сам вызывает preventDefault для клиентского перехода,
      // поэтому defaultPrevented здесь не признак «перехода не будет».
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || !anchor.href) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Та же страница (или только якорь) — перехода не будет.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      clearTimers();
      setPhase("loading");
      // Если переход так и не случился (ошибка, отмена) — не висим вечно.
      timers.current.push(setTimeout(() => setPhase("idle"), SAFETY_TIMEOUT_MS));
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px]"
      style={{
        opacity: phase === "loading" ? 1 : 0,
        // Догорает до конца и гаснет; в покое — просто невидима.
        transition: phase === "done" ? "opacity 200ms ease-out 150ms" : "none",
      }}
    >
      <div
        className="h-full bg-ink"
        style={{
          width: phase === "loading" ? "85%" : phase === "done" ? "100%" : "0%",
          // Ползёт медленно и замедляется — ожидание может быть долгим.
          transition:
            phase === "loading"
              ? "width 8s cubic-bezier(0.1, 0.6, 0.2, 1)"
              : phase === "done"
                ? "width 150ms ease-out"
                : "none",
        }}
      />
    </div>
  );
}
