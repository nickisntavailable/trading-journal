"use client";

import { useRef, useState } from "react";

const ACTION_WIDTH = 72;
const DRAG_THRESHOLD = 6;

/**
 * Свайп влево открывает красную зону с корзиной; тап по ней удаляет.
 * Без библиотек: три touch-события и transform. `touch-action: pan-y` отдаёт
 * вертикальный скролл браузеру, горизонтальное движение обрабатываем сами.
 */
export function SwipeToDelete({
  enabled,
  disabled,
  onDelete,
  className,
  children,
}: {
  enabled: boolean;
  disabled?: boolean;
  onDelete: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, offset: 0 });
  const axis = useRef<"x" | "y" | null>(null);

  if (!enabled) return <div className={className}>{children}</div>;

  const open = offset <= -ACTION_WIDTH / 2;

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, offset };
    axis.current = null;
  }

  function onTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;

    // Первые пиксели решают: это горизонтальный жест или обычная прокрутка.
    if (axis.current === null) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axis.current !== "x") return;

    setDragging(true);
    setOffset(Math.max(-ACTION_WIDTH, Math.min(0, start.current.offset + dx)));
  }

  function onTouchEnd() {
    setDragging(false);
    if (axis.current !== "x") return;
    setOffset(offset <= -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
  }

  return (
    <div className={"relative overflow-hidden " + (className ?? "")}>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Удалить фиксацию"
        tabIndex={open ? 0 : -1}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-short text-white disabled:opacity-40"
        style={{ width: ACTION_WIDTH }}
      >
        <TrashIcon />
      </button>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => {
          if (open) setOffset(0);
        }}
        className="relative bg-bg"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 160ms ease-out",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
