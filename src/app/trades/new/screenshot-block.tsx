"use client";

import { useEffect, useRef, useState } from "react";
import { price as fmtPrice, pct } from "@/lib/format";

export type LevelRole = "entry" | "stop" | "target" | null;

export type ParsedScreenshot = {
  pair: string | null;
  currentPrice: number | null;
  timeframe: string | null;
  /** Направление, если на графике нарисован инструмент позиции. */
  direction: "long" | "short" | null;
  levels: { price: number; role: LevelRole }[];
};

/**
 * Разбор скриншота. Предзаполняет пару, а также вход/стоп/направление — но
 * только те, что уже помечены на самом графике; всё остальное остаётся
 * кандидатами, которые пользователь переносит в поля сам.
 * Файл живёт в памяти браузера и запроса, на сервере не сохраняется.
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // object URL держим ровно до замены файла или ухода со страницы
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function upload(file: File) {
    setPending(true);
    setError(null);
    setFileName(file.name);
    setExpanded(false);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });

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
          {pending ? "Разбираю…" : previewUrl ? "Другой скриншот" : "Загрузить скриншот"}
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

      {previewUrl ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="block w-full text-left"
            aria-expanded={expanded}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Загруженный скриншот графика"
              className={
                expanded
                  ? "w-full rounded-[4px] border border-rule"
                  : "h-24 w-auto rounded-[4px] border border-rule object-cover"
              }
            />
          </button>
          <p className="mt-1 text-[11px] text-ink-soft">
            {expanded ? "Клик по картинке — свернуть" : "Клик по картинке — развернуть"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Кандидаты со скриншота. Когда вход и стоп уже определены, список сворачивается
 * в одну строку — разворачивается кликом, если модель ошиблась с ролями.
 */
export function ScreenshotCandidates({
  parsed,
  entryPrice,
  stopLoss,
  onPickEntry,
  onPickStop,
}: {
  parsed: ParsedScreenshot | null;
  entryPrice: string;
  stopLoss: string;
  onPickEntry: (value: number) => void;
  onPickStop: (value: number) => void;
}) {
  // null — режим по умолчанию: свёрнуто, когда обе цены уже есть
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);

  if (!parsed) return null;

  const entry = Number(entryPrice);
  const stop = Number(stopLoss);
  const hasEntry = entryPrice.trim().length > 0 && Number.isFinite(entry) && entry > 0;
  const hasStop = stopLoss.trim().length > 0 && Number.isFinite(stop) && stop > 0;

  const rows: { key: string; label: string; value: number }[] = [];
  if (parsed.currentPrice !== null) {
    rows.push({ key: "current", label: "текущая", value: parsed.currentPrice });
  }
  parsed.levels.forEach((level, index) => {
    rows.push({
      key: `level-${index}`,
      label: ROLE_LABELS[level.role ?? "none"],
      value: level.price,
    });
  });

  if (rows.length === 0) {
    return (
      <div className="border-b border-rule py-4">
        <p className="text-[11px] text-ink-soft">
          На скриншоте не нашлось ни цены, ни прочерченных уровней — заполни поля вручную.
        </p>
      </div>
    );
  }

  const resolved = hasEntry && hasStop;
  const open = manualOpen ?? !resolved;
  const marked = parsed.levels.some((level) => level.role !== null);

  if (!open) {
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule py-3">
        <p className="text-[11px] text-ink-soft">
          Со скриншота: вход <span className="num text-ink">{fmtPrice(entry)}</span>, стоп{" "}
          <span className="num text-ink">{fmtPrice(stop)}</span>
        </p>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink"
        >
          показать уровни ({rows.length})
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-rule py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] text-ink-soft">
          {marked
            ? "Со скриншота — помеченное подставлено, поправь кнопками"
            : "Со скриншота — подставь в нужное поле"}
        </p>
        <div className="flex items-baseline gap-3">
          {parsed.timeframe ? (
            <p className="num text-[11px] text-ink-soft">{parsed.timeframe}</p>
          ) : null}
          {resolved ? (
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="text-[11px] text-ink-soft underline underline-offset-2 hover:text-ink"
            >
              свернуть
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        {rows.map((row) => {
          const distance = hasEntry ? (Math.abs(row.value - entry) / entry) * 100 : null;
          const isEntry = hasEntry && row.value === entry;
          const isStop = hasStop && row.value === stop;

          return (
            <div
              key={row.key}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-rule py-1.5 last:border-b-0"
            >
              <span className="min-w-0 truncate text-[12px]">
                <span className="num text-[13px]">{fmtPrice(row.value)}</span>
                <span className="ml-2 text-ink-soft">{row.label}</span>
                {distance !== null && distance > 0 ? (
                  <span className="num ml-2 text-ink-soft">·&nbsp;{pct(distance)}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => onPickEntry(row.value)}
                className={
                  "rounded-[3px] border px-2 py-0.5 text-[11px] " +
                  (isEntry
                    ? "border-ink bg-white text-ink"
                    : "border-rule bg-white hover:border-ink")
                }
              >
                {isEntry ? "✓ вход" : "в вход"}
              </button>
              <button
                type="button"
                onClick={() => onPickStop(row.value)}
                className={
                  "rounded-[3px] border px-2 py-0.5 text-[11px] " +
                  (isStop
                    ? "border-short bg-white text-short"
                    : "border-rule bg-white hover:border-ink")
                }
              >
                {isStop ? "✓ стоп" : "в стоп"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  entry: "вход по графику",
  stop: "стоп по графику",
  target: "цель по графику",
  none: "уровень",
};
