"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateTag, useSaveNote, useTags, useToggleTradeTag } from "@/lib/query/review";
import { TagPicker } from "@/components/tag-picker";
import { NOTE_MAX } from "@/lib/review-limits";
import type { TagDTO } from "@/lib/tags";

/** Пауза в наборе, после которой заметка сохраняется сама. */
const NOTE_SAVE_DELAY_MS = 800;
const COLLAPSED_KEY = "tj.review.collapsed";

/**
 * «Разбор»: теги причин входа и заметка. Правится когда угодно — при открытии,
 * по ходу сделки и после закрытия. Теги сохраняются по тапу, заметка — сама,
 * через паузу в наборе и при уходе с поля.
 */
export function TradeReview({
  tradeId,
  tagIds,
  note,
  initialTags,
}: {
  tradeId: string;
  tagIds: string[];
  note: string | null;
  initialTags?: TagDTO[];
}) {
  const { data: tags = [] } = useTags(initialTags);
  const toggle = useToggleTradeTag(tradeId);
  const createTag = useCreateTag();
  const collapsed = useCollapsed();

  const selected = new Set(tagIds);
  const selectedNames = tags.filter((tag) => selected.has(tag.id)).map((tag) => tag.name);

  const {
    ref: noteRef,
    text: noteText,
    change: changeNote,
    flush: flushNote,
    status: noteStatus,
    error: noteError,
  } = useNoteAutosave(tradeId, note ?? "");

  async function createAndGetId(name: string): Promise<string | null> {
    try {
      return (await createTag.mutateAsync(name)).tag.id;
    } catch {
      return null; // ошибка видна под блоком (createTag.error)
    }
  }

  const error = toggle.error ?? createTag.error ?? noteError;

  if (collapsed.value) {
    const summary = [selectedNames.join(", "), noteText.trim()].filter(Boolean).join(" · ");
    return (
      <section className="border-b border-rule py-3">
        <button
          type="button"
          onClick={() => collapsed.set(false)}
          className="flex w-full items-baseline gap-2 text-left"
        >
          <span className="shrink-0 text-[13px] font-medium">Разбор</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">
            {summary || "пусто"}
          </span>
          <span className="shrink-0 text-[12px] text-ink-soft underline underline-offset-2">
            развернуть
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="border-b border-rule py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium">Разбор</h2>
        <span className="flex items-baseline gap-3 text-[11px] text-ink-soft">
          <span aria-live="polite">{noteStatus}</span>
          <button
            type="button"
            onClick={() => collapsed.set(true)}
            className="text-[12px] underline underline-offset-2 hover:text-ink"
          >
            свернуть
          </button>
        </span>
      </div>

      <div className="mt-3">
        <TagPicker
          tags={tags}
          selectedIds={tagIds}
          onToggle={toggle.toggle}
          onCreate={createAndGetId}
        />
      </div>

      <textarea
        ref={noteRef}
        aria-label="Заметка"
        placeholder="Почему вход, что видел на графике, что пошло не так…"
        rows={3}
        maxLength={NOTE_MAX}
        value={noteText}
        onChange={(e) => changeNote(e.target.value)}
        onBlur={flushNote}
        className="mt-3 w-full resize-none overflow-hidden rounded-[3px] border border-rule bg-white px-2.5 py-2 text-[14px] leading-[1.45] outline-none focus:border-ink"
      />

      {error ? (
        <p className="mt-1 text-[12px] text-short">
          Не сохранилось: {error.message}
          {noteError ? (
            <>
              {" "}
              <button
                type="button"
                onClick={flushNote}
                className="underline underline-offset-2"
              >
                Повторить
              </button>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Свёрнут ли блок — запоминается на устройстве. На телефоне место дорого, и
 * один раз свернув, не хочется сворачивать на каждой сделке. Хранилище может
 * быть недоступно (приватный режим) — тогда просто не запоминаем.
 */
function useCollapsed() {
  const [value, setValue] = useState(false);

  useEffect(() => {
    try {
      // Читаем после гидрации: на сервере localStorage нет, и разметка разошлась бы.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* без запоминания */
    }
  }, []);

  function set(next: boolean) {
    setValue(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* без запоминания */
    }
  }

  return { value, set };
}

/**
 * Автосохранение заметки: через паузу в наборе и при уходе с поля. Текст в
 * поле — локальное состояние, сервер его не перетирает: пока человек печатает,
 * ответы на прошлые сохранения не должны откатывать набранное.
 */
function useNoteAutosave(tradeId: string, initial: string) {
  const save = useSaveNote(tradeId);
  const [text, setText] = useState(initial);
  // Последний текст, который сервер подтвердил, — от него считается «сохранено».
  const [savedText, setSavedText] = useState(initial);
  // Последний отправленный — чтобы не слать одно и то же дважды (пауза + blur).
  const sentRef = useRef(initial);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Поле растёт по тексту — длинную заметку видно целиком, без прокрутки внутри.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  function send(value: string) {
    sentRef.current = value;
    save.mutate(value, {
      onSuccess: () => setSavedText(value),
      // Не сохранилось — «Повторить» или следующий flush отправят снова.
      onError: () => {
        sentRef.current = savedText;
      },
    });
  }

  function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const value = ref.current?.value ?? text;
    if (value !== sentRef.current) send(value);
  }

  function change(value: string) {
    setText(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, NOTE_SAVE_DELAY_MS);
  }

  // Ушли со страницы посреди набора — сохраняем то, что успели.
  useEffect(() => {
    const el = ref.current;
    return () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      const value = el?.value;
      if (value !== undefined && value !== sentRef.current) save.mutate(value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = save.isPending
    ? "сохраняю…"
    : save.isSuccess && text === savedText
      ? "сохранено"
      : "";

  return { ref, text, change, flush, status, error: save.isError ? save.error : null };
}
