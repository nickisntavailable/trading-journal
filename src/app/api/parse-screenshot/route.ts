import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { handleError, badRequest } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

// Дословный промпт из ТЗ (раздел 5). Модель ничего не решает за пользователя.
const PROMPT = `Ты помогаешь трейдеру быстро занести сделку в журнал по скриншоту графика TradingView.
Извлеки из изображения только то, что объективно видно:
- pair: торговая пара, если читается на скриншоте
- currentPrice: текущая цена, если видна
- timeframe: таймфрейм, если виден
- levels: список явно прочерченных горизонтальных линий/уровней на графике (цена каждой линии).
  Не более 6 штук. Не пытайся угадать, какая линия — стоп, а какая — тейк: просто перечисли уровни.

НЕ определяй направление сделки (long/short) и НЕ решай, какой уровень является стоп-лоссом — это
всегда подтверждает пользователь вручную. Если что-то не видно на скриншоте — верни null для этого поля,
не придумывай значения.

Ответь строго JSON без каких-либо пояснений, по схеме:
{"pair": string | null, "currentPrice": number | null, "timeframe": string | null,
 "levels": [{"price": number}]}`;

const parsedSchema = z.object({
  pair: z.string().nullable(),
  currentPrice: z.number().nullable(),
  timeframe: z.string().nullable(),
  levels: z.array(z.object({ price: z.number() })).max(6),
});

export type ParsedScreenshot = z.infer<typeof parsedSchema>;

const EMPTY: ParsedScreenshot = {
  pair: null,
  currentPrice: null,
  timeframe: null,
  levels: [],
};

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

    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return badRequest("Ожидается файл изображения в поле image");
    if (file.size > MAX_BYTES) return badRequest("Изображение больше 5 МБ");

    const mediaType = file.type as (typeof SUPPORTED)[number];
    if (!SUPPORTED.includes(mediaType)) {
      return badRequest("Поддерживаются только PNG, JPEG, GIF и WebP");
    }

    // Файл живёт только в памяти этого запроса и никуда не сохраняется.
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
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

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return NextResponse.json(safeParse(text));
  } catch (error) {
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
