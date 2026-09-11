"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DESKTOP_LINKS = [
  { href: "/", label: "Дашборд" },
  { href: "/trades", label: "История" },
  { href: "/settings", label: "Настройки" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Верхняя навигация — только на десктопе (раздел 8, мобильная адаптация). */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="hidden border-b border-rule md:block">
      <nav className="mx-auto flex h-12 max-w-[920px] items-center gap-6 px-6">
        <Link href="/" className="text-[13px] font-semibold tracking-tight">
          Trading Journal
        </Link>

        <div className="flex items-center gap-5">
          {DESKTOP_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive(pathname, link.href)
                  ? "text-[13px] text-ink"
                  : "text-[13px] text-ink-soft hover:text-ink"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <Link
          href="/trades/new"
          className="ml-auto rounded-[3px] bg-btn px-3 py-1.5 text-[12px] font-medium text-white"
        >
          + Новая сделка
        </Link>
      </nav>
    </header>
  );
}

/** Нижний таб-бар — только на мобильной ширине. */
export function MobileTabBar() {
  const pathname = usePathname();
  const journalActive = pathname === "/" || pathname.startsWith("/settings");
  const historyActive = pathname === "/trades" || /^\/trades\/(?!new)/.test(pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-bg md:hidden">
      <div className="relative mx-auto grid h-14 max-w-[520px] grid-cols-3 items-center">
        <Link
          href="/"
          className={`text-center text-[12px] ${journalActive ? "text-ink" : "text-ink-soft"}`}
        >
          Журнал
        </Link>

        <div aria-hidden />

        <Link
          href="/trades"
          className={`text-center text-[12px] ${historyActive ? "text-ink" : "text-ink-soft"}`}
        >
          История
        </Link>

        <Link
          href="/trades/new"
          aria-label="Новая сделка"
          className="absolute left-1/2 -top-5 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-btn text-[22px] leading-none text-white shadow-[0_2px_10px_rgba(21,22,26,0.25)]"
        >
          +
        </Link>
      </div>
    </nav>
  );
}
