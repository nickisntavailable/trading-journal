import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { createInvite, InviteError } from "@/lib/invites";
import { requireAdmin } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().trim().email("Некорректная почта").max(200),
});

/** Новое приглашение. В ответе — готовая ссылка: её админ пересылает сам. */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { email } = bodySchema.parse(await request.json());
    const token = await createInvite(email, admin.id);
    const url = new URL(`/invite/${token}`, request.url).toString();
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    if (error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return handleError(error);
  }
}
