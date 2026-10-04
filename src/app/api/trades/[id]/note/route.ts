import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { handleError, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const NOTE_MAX = 5000;

const bodySchema = z.object({
  note: z.string().max(NOTE_MAX, `Заметка — не длиннее ${NOTE_MAX} символов`),
});

/**
 * Заметка-разбор. Отдельно от PATCH сделки: та правит параметры только у
 * открытой сделки, а разбор пишется и после закрытия. Пустая строка — нет
 * заметки.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await getAccount();
    const { id } = await params;
    const { note } = bodySchema.parse(await request.json());
    const value = note.trim() ? note : null;

    const { count } = await prisma.trade.updateMany({
      where: { id, accountId: account.id },
      data: { note: value },
    });
    if (count === 0) return notFound("Сделка не найдена");
    return NextResponse.json({ note: value });
  } catch (error) {
    return handleError(error);
  }
}
