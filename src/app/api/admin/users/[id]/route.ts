import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, handleError, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const bodySchema = z.object({ canParseScreenshots: z.boolean() });

/** Выдать или забрать доступ к разбору скриншотов. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { canParseScreenshots } = bodySchema.parse(await request.json());
    // Себе не отключаем — иначе можно случайно остаться без доступа.
    if (id === admin.id) return badRequest("Свой доступ не меняется");

    const { count } = await prisma.user.updateMany({ where: { id }, data: { canParseScreenshots } });
    if (count === 0) return notFound("Пользователь не найден");
    return NextResponse.json({ ok: true, canParseScreenshots });
  } catch (error) {
    return handleError(error);
  }
}
