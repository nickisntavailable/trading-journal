"use client";

import { useState } from "react";
import { TAG_NAME_MAX } from "@/lib/review-limits";
import type { TagDTO } from "@/lib/tags";

const chipBase = "num rounded-[3px] border px-2 py-1 text-[12px] leading-none";
const chipOn = chipBase + " border-ink text-ink";
const chipOff = chipBase + " border-rule bg-white text-ink-soft";
/** Архивный тег, который остался в сделке: виден, снимается, но не выбирается заново. */
const chipArchived = chipBase + " border-dashed border-rule text-ink-soft";

/**
 * Теги причин входа чипами + «+ тег» на месте. Общий для формы новой сделки
 * и страницы сделки: где хранится выбор — решает тот, кто его использует.
 */
export function TagPicker({
  tags,
  selectedIds,
  onToggle,
  onCreate,
}: {
  tags: TagDTO[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  /** Создать тег (или вернуть существующий); id тега или null при ошибке. */
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = new Set(selectedIds);
  // Выбор — активные теги; архивные показываем, только если они уже выбраны.
  const visible = tags.filter((tag) => !tag.archived || selected.has(tag.id));

  async function add(event: React.SyntheticEvent) {
    // Поле живёт и внутри формы новой сделки (вложенная <form> — невалидный
    // HTML), поэтому Enter здесь гасим: иначе он отправил бы всю сделку.
    event.preventDefault();
    const value = name.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    setCreating(true);
    const id = await onCreate(value);
    setCreating(false);
    if (!id) return; // ошибку показывает родитель, поле остаётся открытым
    if (!selected.has(id)) onToggle(id);
    setName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((tag) => {
        const on = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(tag.id)}
            className={on ? (tag.archived ? chipArchived : chipOn) : chipOff}
            title={tag.archived ? "Тег в архиве — снимается, но заново не выбирается" : undefined}
          >
            {tag.name}
          </button>
        );
      })}

      {adding ? (
        <span className="flex items-center gap-1.5">
          <input
            autoFocus
            aria-label="Новый тег"
            placeholder="новый тег"
            maxLength={TAG_NAME_MAX}
            autoCapitalize="none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add(e);
              if (e.key === "Escape") {
                setName("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!name.trim()) setAdding(false);
            }}
            className="num w-[140px] rounded-[3px] border border-ink bg-white px-2 py-1 text-[12px] outline-none"
          />
          <button
            type="button"
            onClick={(e) => void add(e)}
            disabled={creating}
            className="text-[12px] underline underline-offset-2 disabled:opacity-40"
          >
            {creating ? "…" : "ок"}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={chipBase + " border-dashed border-rule text-ink-soft hover:border-ink"}
        >
          + тег
        </button>
      )}
    </div>
  );
}
