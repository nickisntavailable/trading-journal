import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { handleError } from "@/lib/api";
import { addEntry, EntryError } from "@/lib/entries-server";

const bodySchema = z.object({
  // id генерирует клиент (uuid): оптимистичный UI рисует вход сразу, повтор
  // запроса не создаёт дубль.
  id: z.string().uuid().optional(),
  price: z.number().finite().positive(),
  riskPct: z.number().finite().gt(0).max(100),
  stopLoss: z.number().finite().positive(),
});

/** Добор в открытую сделку. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const account = await getAccount();
    return NextResponse.json(await addEntry(account.id, id, body), { status: 201 });
  } catch (error) {
    if (error instanceof EntryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
