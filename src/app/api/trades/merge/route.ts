import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { handleError } from "@/lib/api";
import { EntryError, mergeTrades } from "@/lib/entries-server";

const bodySchema = z.object({ ids: z.tuple([z.string().min(1), z.string().min(1)]) });

/**
 * Объединить две сделки. Порядок id не важен: к какой сделке добавлять,
 * сервер решает сам — к более ранней.
 */
export async function POST(request: Request) {
  try {
    const { ids } = bodySchema.parse(await request.json());
    const account = await getAccount();
    return NextResponse.json(await mergeTrades(account.id, ids));
  } catch (error) {
    if (error instanceof EntryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
