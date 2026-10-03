import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { handleError, notFound } from "@/lib/api";
import { setTagArchived } from "@/lib/tags";

const bodySchema = z.object({ archived: z.boolean() });

/** В архив и обратно. Удалять теги насовсем нельзя — см. схему. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getAccount();
    const { id } = await params;
    const { archived } = bodySchema.parse(await request.json());
    if (!(await setTagArchived(account.id, id, archived))) return notFound("Тег не найден");
    return NextResponse.json({ ok: true, archived });
  } catch (error) {
    return handleError(error);
  }
}
