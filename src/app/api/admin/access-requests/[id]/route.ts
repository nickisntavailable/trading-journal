import { NextResponse } from "next/server";
import { z } from "zod";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/session";
import { decideAccess } from "@/lib/telegram/access";
import { notifyApplicant } from "@/lib/telegram/access-notify";

const bodySchema = z.object({ decision: z.enum(["approve", "reject"]) });

/** «Пустить / Отклонить» заявку с сайта — то же, что кнопки в боте. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { decision } = bodySchema.parse(await request.json());
    const result = await decideAccess(id, decision, admin.id);
    if (result.result === "already") {
      return NextResponse.json({ error: "Заявка уже решена" }, { status: 409 });
    }
    await notifyApplicant(result.request, result.result, new URL(request.url).origin).catch((error) =>
      console.error("[telegram] не удалось сообщить о решении", error),
    );
    return NextResponse.json({ ok: true, result: result.result });
  } catch (error) {
    return handleError(error);
  }
}
