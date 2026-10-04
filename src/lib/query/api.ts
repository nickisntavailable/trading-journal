import { awaitCreation } from "@/lib/query/pending";
import type { EntryDTO, FixDTO, FixType, TradeDTO } from "@/lib/serialize";
import type { TagDTO } from "@/lib/tags";

/**
 * Сделка в кеше. Теги лежат рядом, а не внутри trade: ответы на правку
 * сделки тегов не содержат и иначе затирали бы их.
 */
export type TradeWithFixes = {
  trade: TradeDTO;
  fixes: FixDTO[];
  tagIds: string[];
  entries: EntryDTO[];
};

/** Ошибка API с текстом, который сервер подготовил для показа пользователю. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error ?? "Запрос не удался", response.status);
  }
  return data as T;
}

export const api = {
  getTrade: (id: string) => request<TradeWithFixes>(`/api/trades/${id}`),

  addFix: async (
    tradeId: string,
    body: { id: string; price: number; sizePct: number; type: FixType },
  ) => {
    await awaitCreation(tradeId);
    return request<{ fix: FixDTO; trade: TradeDTO; closed: boolean }>(
      `/api/trades/${tradeId}/fixes`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },

  deleteFix: async (tradeId: string, fixId: string) => {
    await awaitCreation(tradeId);
    return request<{ ok: true }>(`/api/trades/${tradeId}/fixes/${fixId}`, { method: "DELETE" });
  },

  createTrade: (body: Record<string, unknown>) =>
    request<{ trade: TradeDTO }>("/api/trades", { method: "POST", body: JSON.stringify(body) }),

  setNote: async (tradeId: string, note: string) => {
    await awaitCreation(tradeId);
    return request<{ note: string | null }>(`/api/trades/${tradeId}/note`, {
      method: "PUT",
      body: JSON.stringify({ note }),
    });
  },

  setTradeTag: async (tradeId: string, tagId: string, on: boolean) => {
    await awaitCreation(tradeId);
    return request<{ ok: true }>(`/api/trades/${tradeId}/tags/${tagId}`, {
      method: on ? "PUT" : "DELETE",
    });
  },

  getTags: () => request<{ tags: TagDTO[] }>("/api/tags"),

  createTag: (name: string) =>
    request<{ tag: { id: string; name: string } }>("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  addEntry: async (
    tradeId: string,
    body: { id: string; price: number; riskPct: number; stopLoss: number },
  ) => {
    await awaitCreation(tradeId);
    return request<{ trade: TradeDTO; entries: EntryDTO[] }>(`/api/trades/${tradeId}/entries`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  removeEntry: async (tradeId: string, entryId: string) => {
    await awaitCreation(tradeId);
    return request<{ trade: TradeDTO; entries: EntryDTO[] }>(
      `/api/trades/${tradeId}/entries/${entryId}`,
      { method: "DELETE" },
    );
  },

  updateTrade: async (id: string, body: Record<string, unknown>) => {
    await awaitCreation(id);
    return request<{ trade: TradeDTO }>(`/api/trades/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};
