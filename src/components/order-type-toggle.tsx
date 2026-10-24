"use client";

import { ORDER_TYPE_LABELS, ORDER_TYPES, type OrderType } from "@/lib/trading-math";

/**
 * «рынок / лимит» — от этого зависит комиссия: лимитная заявка платит
 * maker, рыночная — taker.
 */
export function OrderTypeToggle({
  value,
  onChange,
  className = "",
}: {
  value: OrderType;
  onChange: (value: OrderType) => void;
  className?: string;
}) {
  return (
    <div className={"inline-grid grid-cols-2 gap-1 " + className} role="radiogroup">
      {ORDER_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          role="radio"
          aria-checked={value === type}
          onClick={() => onChange(type)}
          className={
            "rounded-[3px] border px-2.5 py-1 text-[12px] " +
            (value === type ? "border-ink text-ink" : "border-rule bg-white text-ink-soft")
          }
        >
          {ORDER_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
