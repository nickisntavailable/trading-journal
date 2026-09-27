import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { InviteError, revokeInvite } from "@/lib/invites";
import { requireAdmin } from "@/lib/session";

/** Отозвать ещё не использованное приглашение: ссылка перестаёт работать. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await revokeInvite(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
