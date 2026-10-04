"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { plural } from "@/lib/format";
import { TAG_NAME_MAX } from "@/lib/review-limits";
import type { TagDTO } from "@/lib/tags";

const chipClass = "num rounded-[3px] border border-ink px-2 py-0.5 text-[12px]";
const archivedChipClass = "num rounded-[3px] border border-rule px-2 py-0.5 text-[12px] text-ink-soft";

/** Теги причин входа: добавить, убрать в архив, вернуть из архива. */
export function TagsManager({ tags }: { tags: TagDTO[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const active = tags.filter((tag) => !tag.archived);
  const archived = tags.filter((tag) => tag.archived);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending("add");
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    setPending(null);
    if (!response.ok) {
      setError(data.error ?? "Не удалось добавить тег");
      return;
    }
    setName("");
    router.refresh();
  }

  async function setArchived(id: string, value: boolean) {
    setError(null);
    setPending(id);
    const response = await fetch(`/api/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: value }),
    });
    setPending(null);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Не получилось");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 max-w-[560px]">
      {active.length === 0 ? (
        <p className="text-[13px] text-ink-soft">
          Причины входа: fvg, ob, дивергенция, cme… Отмечаются в сделке одним тапом.
        </p>
      ) : (
        <div>
          {active.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between gap-3 border-b border-rule py-2 first:border-t"
            >
              <span className={chipClass}>{tag.name}</span>
              <span className="flex items-center gap-3 text-[12px] text-ink-soft">
                <span className="num">
                  {tag.tradeCount} {plural(tag.tradeCount, "сделка", "сделки", "сделок")}
                </span>
                <button
                  type="button"
                  onClick={() => setArchived(tag.id, true)}
                  disabled={pending !== null}
                  className="underline underline-offset-2 hover:text-ink disabled:opacity-40"
                >
                  {pending === tag.id ? "…" : "в архив"}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          aria-label="Новый тег"
          placeholder="новый тег"
          maxLength={TAG_NAME_MAX}
          autoCapitalize="none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="num min-w-0 flex-1 rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending !== null || !name.trim()}
          className="rounded-[3px] bg-btn px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {pending === "add" ? "…" : "Добавить"}
        </button>
      </form>
      {error ? <p className="mt-2 text-[12px] text-short">{error}</p> : null}

      {archived.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="text-[12px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            {showArchive ? "Скрыть архив" : `Архив (${archived.length})`}
          </button>
          {showArchive ? (
            <div className="mt-2">
              <p className="text-[11px] text-ink-soft">
                Архивных тегов нет в выборе, но в старых сделках они остались.
              </p>
              {archived.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between gap-3 border-b border-rule py-2"
                >
                  <span className={archivedChipClass}>{tag.name}</span>
                  <span className="flex items-center gap-3 text-[12px] text-ink-soft">
                    <span className="num">
                      {tag.tradeCount} {plural(tag.tradeCount, "сделка", "сделки", "сделок")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setArchived(tag.id, false)}
                      disabled={pending !== null}
                      className="underline underline-offset-2 hover:text-ink disabled:opacity-40"
                    >
                      {pending === tag.id ? "…" : "вернуть"}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
