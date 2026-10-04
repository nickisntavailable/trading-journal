/**
 * Подсказка тегов по тексту заметки: тег упомянут в заметке, но не отмечен.
 * Простое сравнение строк, без ИИ.
 *
 * Правила:
 * - регистр не важен;
 * - короткие теги (до SHORT_TAG символов: ob, fvg, cme) — только целым
 *   словом, иначе «ob» всплывал бы в каждом «observe»;
 * - длинные — по началу слова и без последней буквы, если в слове от
 *   STEM_FROM букв: русские окончания не мешают, «дивергенция» находится в
 *   «дивергенции», «ликвидность» — в «ликвидности», «дивер» — в «дивергенция»;
 * - в тегах из нескольких слов между словами любое число пробелов.
 *
 * Границы слов — через \p{L}\p{N} с флагом u: обычный \b в JS понимает
 * только латиницу и на кириллице не работает.
 */
const SHORT_TAG = 3;
const STEM_FROM = 5;

type TagLike = { id: string; name: string; archived: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagPattern(name: string): RegExp {
  const words = name.trim().split(/\s+/);
  const isShort = words.join("").length <= SHORT_TAG;

  // Слова длинного тега сравниваем по основе: окончание при склонении
  // меняется (дивергенциЯ → дивергенциИ, сессиЯ азии → сессиЮ азии).
  // После основы слово может продолжаться любыми буквами — иначе в «order
  // block» урезанное «orde» не стыковалось бы с пробелом.
  const parts = words.map((word) =>
    !isShort && word.length >= STEM_FROM && /\p{L}$/u.test(word)
      ? escapeRegExp(word.slice(0, -1)) + "\\p{L}*"
      : escapeRegExp(word),
  );

  const body = parts.join("\\s+");
  const start = "(?<![\\p{L}\\p{N}])";
  const end = isShort ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(start + body + end, "iu");
}

export function suggestTags<T extends TagLike>(
  note: string,
  tags: T[],
  selectedIds: string[],
): T[] {
  if (!note.trim()) return [];
  const selected = new Set(selectedIds);
  return tags.filter(
    (tag) => !tag.archived && !selected.has(tag.id) && tagPattern(tag.name).test(note),
  );
}
