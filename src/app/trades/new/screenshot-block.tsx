"use client";

import { useRef, useState } from "react";
import { price } from "@/lib/format";

export type ParsedScreenshot = {
  pair: string | null;
  currentPrice: number | null;
  timeframe: string | null;
  levels: { price: number }[];
};

/**
 * Разбор скриншота — вспомогательный путь: он только предзаполняет пару и
 * показывает уровни-кандидаты. Ничего не подставляется в поля автоматически.
 */
export function ScreenshotBlock({
  onParsed,
}: {
  onParsed: (parsed: ParsedScreenshot) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    setFileName(file.name);

    const body = new FormData();
    body.append("image", file);

    try {
      const response = await fetch("/api/parse-screenshot", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Не удалось разобрать скриншот");
        return;
      }
      onParsed(data as ParsedScreenshot);
    } catch {
      setError("Не удалось разобрать скриншот");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-b border-rule py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="rounded-[3px] border border-rule bg-white px-3 py-1.5 text-[12px] disabled:opacity-40"
        >
          {pending ? "Разбираю…" : "Загрузить скриншот"}
        </button>
        <span className="truncate text-[12px] text-ink-soft">
          {error ?? fileName ?? "PNG/JPEG до 5 МБ, файл не сохраняется"}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Уровни-кандидаты рядом с полем стопа: подставляются только по клику. */
export function LevelCandidates({
  levels,
  onPick,
}: {
  levels: { price: number }[];
  onPick: (value: number) => void;
}) {
  if (levels.length === 0) return null;
  return (
    <div className="mt-1.5">
      <p className="text-[11px] text-ink-soft">Уровни со скриншота</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {levels.map((level, index) => (
          <button
            key={`${level.price}-${index}`}
            type="button"
            onClick={() => onPick(level.price)}
            className="num rounded-[3px] border border-rule bg-white px-2 py-1 text-[12px] hover:border-ink"
          >
            {price(level.price)}
          </button>
        ))}
      </div>
    </div>
  );
}
