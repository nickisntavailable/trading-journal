"use client";

import { useState } from "react";

/**
 * Одноразовая ссылка (приглашение, сброс пароля). Показывается один раз:
 * в базе лежит только хеш, восстановить ссылку потом нельзя.
 */
export function OneTimeLink({ note, url }: { note: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Буфер обмена недоступен — ссылку можно выделить и скопировать руками.
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 rounded-[3px] border border-rule bg-white px-3 py-2.5">
      <p className="text-[12px] text-ink-soft">{note} Больше её не покажу — отправь сейчас.</p>
      <p className="num mt-1.5 break-all text-[12px] select-all">{url}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-2 rounded-[3px] border border-rule px-3 py-1.5 text-[12px] hover:border-ink"
      >
        {copied ? "Скопировано" : "Копировать"}
      </button>
    </div>
  );
}
