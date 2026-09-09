import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { handleError, badRequest } from "@/lib/api";
import { fetchTradingViewSnapshot, SnapshotError } from "@/lib/tradingview-snapshot";

export const runtime = "nodejs";
export const maxDuration = 60;

// Промпт из раздела 5 ТЗ, расширенный ролью уровня и направлением.
// Расширение не заставляет модель РЕШАТЬ, где стоп: она сообщает только то, чем
// уровень уже помечен на самом графике — цветом плашки на ценовой шкале или
// зоной инструмента позиции TradingView. Финальное слово остаётся за
// пользователем: любое поле правится в один клик.
const PROMPT = `Ты помогаешь трейдеру быстро занести сделку в журнал по скриншоту графика TradingView.
Извлеки из изображения только то, что объективно видно:
- pair: торговая пара, если читается на скриншоте
- currentPrice: текущая цена, если видна
- timeframe: таймфрейм, если виден. Обычно он написан в заголовке рядом с названием
  инструмента, отдельным элементом между разделителями — например «· 5 ·» или «· 4H ·»
- levels: список явно прочерченных горизонтальных линий/уровней на графике (цена каждой линии).
  Не более 8 штук. Для каждого уровня укажи role, но ТОЛЬКО если роль уже обозначена на самом
  графике — цветом плашки на ценовой шкале справа или зоной инструмента позиции TradingView:
    "entry"  — цена помечена как вход: серая или тёмная плашка на ценовой шкале либо линия входа
               инструмента позиции
    "stop"   — цена помечена как стоп: красная плашка на ценовой шкале либо дальняя граница
               красной (убыточной) зоны инструмента позиции
    "target" — цена помечена как цель: дальняя граница зелёной (прибыльной) зоны инструмента позиции
    null     — уровень ничем из перечисленного не помечен
  Текущая цена — это НЕ вход: её плашка тоже подсвечена (обычно цветом свечей), но она
  возвращается только в currentPrice, а роль такого уровня — null. Роль "entry" ставь ровно
  одному уровню, и только если он отличается от текущей цены.
- direction: если на графике нарисован инструмент позиции, верни "long", когда зелёная зона выше
  линии входа, и "short", когда зелёная зона ниже. Если инструмента позиции нет — null.

Не выводи роль из логики и не угадывай: если цвет плашки или зоны не читается, ставь role: null,
а direction: null. Если чего-то не видно на скриншоте — верни null для этого поля, не придумывай
значения.

Ответь строго JSON без каких-либо пояснений, по схеме:
{"pair": string | null, "currentPrice": number | null, "timeframe": string | null,
 "direction": "long" | "short" | null,
 "levels": [{"price": number, "role": "entry" | "stop" | "target" | null}]}`;

const parsedSchema = z.object({
  pair: z.string().nullable(),
  currentPrice: z.number().nullable(),
  timeframe: z.string().nullable(),
  direction: z.enum(["long", "short"]).nullable().catch(null),
  levels: z
    .array(
      z.object({
        price: z.number(),
        role: z.enum(["entry", "stop", "target"]).nullable().catch(null),
      }),
    )
    .max(8),
});

export type ParsedScreenshot = z.infer<typeof parsedSchema>;

const EMPTY: ParsedScreenshot = {
  pair: null,
  currentPrice: null,
  timeframe: null,
  direction: null,
  levels: [],
};

// Модель для разбора вынесена в env, чтобы менять её без правки кода.
const VISION_MODEL = process.env.VISION_MODEL ?? "claude-opus-5";

const SUPPORTED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY не задан на сервере" },
        { status: 500 },
      );
    }

    // Два входа: загруженный файл (multipart) и ссылка на снимок (JSON).
    // В обоих случаях картинка живёт только в памяти запроса и не сохраняется.
    let base64: string;
    let mediaType: (typeof SUPPORTED)[number];

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      // safeParse, а не parse: ниже ZodError трактуется как «модель вернула мусор»
      // и гасится пустым результатом, а битый адрес — это ошибка запроса.
      const body = z.object({ url: z.string().url() }).safeParse(await request.json());
      if (!body.success) return badRequest("Это не похоже на адрес — вставь ссылку целиком");
      const snapshot = await fetchTradingViewSnapshot(body.data.url);
      base64 = snapshot.bytes.toString("base64");
      mediaType = snapshot.mediaType;
    } else {
      const form = await request.formData();
      const file = form.get("image");
      if (!(file instanceof File)) return badRequest("Ожидается файл изображения в поле image");
      if (file.size > MAX_BYTES) return badRequest("Изображение больше 5 МБ");

      mediaType = file.type as (typeof SUPPORTED)[number];
      if (!SUPPORTED.includes(mediaType)) {
        return badRequest("Поддерживаются только PNG, JPEG, GIF и WebP");
      }
      base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });

    // У моделей с рассуждением его токены тоже входят в max_tokens, поэтому на
    // насыщенном графике потолок реально достижим. Обрезанный JSON не разберётся,
    // и молча отдать «ничего не найдено» здесь нельзя: это выглядит как пустой
    // график, хотя на самом деле разбор не доехал.
    if (response.stop_reason === "max_tokens") {
      console.error("parse-screenshot: ответ модели обрезан по max_tokens");
      return NextResponse.json(
        { error: "Слишком насыщенный график — разбор не поместился в ответ, попробуй ещё раз" },
        { status: 502 },
      );
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json(safeParse(text));
  } catch (error) {
    // Проблему со ссылкой объясняем словами: пользователю надо понять, что делать.
    if (error instanceof SnapshotError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ошибку конфигурации/валидации отдаём как есть, всё остальное — не критичный путь.
    if (error instanceof Error && error.name === "ZodError") return NextResponse.json(EMPTY);

    // Ответ провайдера содержит request_id и внутреннюю структуру — в интерфейсе
    // это шум, поэтому наружу отдаём короткий текст, подробности в логи сервера.
    if (error instanceof Anthropic.APIError) {
      console.error("parse-screenshot: ошибка Anthropic API", error.status, error.message);
      return NextResponse.json(
        { error: anthropicErrorMessage(error.status) },
        { status: 502 },
      );
    }

    return handleError(error);
  }
}

function anthropicErrorMessage(status: number | undefined): string {
  if (status === 400) return "Не удалось прочитать изображение — попробуй другой скриншот";
  if (status === 401 || status === 403) return "Ключ Anthropic отклонён — проверь ANTHROPIC_API_KEY";
  if (status === 429) return "Слишком часто — подожди немного и повтори";
  if (status !== undefined && status >= 500) return "Сервис разбора временно недоступен";
  return "Не удалось разобрать скриншот";
}

/** Невалидный ответ модели — не ошибка: форма просто остаётся пустой. */
function safeParse(text: string): ParsedScreenshot {
  const json = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const result = parsedSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : EMPTY;
  } catch {
    return EMPTY;
  }
}
