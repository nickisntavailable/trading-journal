import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { handleError } from "@/lib/api";
import { EntryError, removeLastEntry } from "@/lib/entries-server";

/** Снять последний добор. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  try {
    const { id, entryId } = await params;
    const account = await getAccount();
    return NextResponse.json(await removeLastEntry(account.id, id, entryId));
  } catch (error) {
    if (error instanceof EntryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
