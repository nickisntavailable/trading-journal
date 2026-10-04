"use client";

import { suggestTags } from "@/lib/tag-suggest";
import type { TagDTO } from "@/lib/tags";

/**
 * «Похоже на: + cme» под заметкой — теги, упомянутые в тексте, но не
 * отмеченные. Тап отмечает тег, и подсказка исчезает.
 */
export function TagSuggestions({
  note,
  tags,
  selectedIds,
  onPick,
}: {
  note: string;
  tags: TagDTO[];
  selectedIds: string[];
  onPick: (tagId: string) => void;
}) {
  const suggested = suggestTags(note, tags, selectedIds);
  if (suggested.length === 0) return null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-soft">
      <span>Похоже на:</span>
      {suggested.map((tag) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => onPick(tag.id)}
          className="num rounded-[3px] border border-dashed border-ink px-2 py-1 text-[12px] leading-none text-ink"
        >
          + {tag.name}
        </button>
      ))}
    </p>
  );
}
