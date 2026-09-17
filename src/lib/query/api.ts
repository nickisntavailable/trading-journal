import type { FixDTO, TradeDTO } from "@/lib/serialize";

export type TradeWithFixes = { trade: TradeDTO; fixes: FixDTO[] };

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

  addFix: (tradeId: string, body: { id: string; price: number; sizePct: number; type: "manual" | "stop" }) =>
    request<{ fix: FixDTO; trade: TradeDTO; closed: boolean }>(`/api/trades/${tradeId}/fixes`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteFix: (tradeId: string, fixId: string) =>
    request<{ ok: true }>(`/api/trades/${tradeId}/fixes/${fixId}`, { method: "DELETE" }),

  createTrade: (body: Record<string, unknown>) =>
    request<{ trade: TradeDTO }>("/api/trades", { method: "POST", body: JSON.stringify(body) }),

  updateTrade: (id: string, body: Record<string, unknown>) =>
    request<{ trade: TradeDTO }>(`/api/trades/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
