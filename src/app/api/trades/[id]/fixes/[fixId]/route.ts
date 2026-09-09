import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { badRequest, handleError, notFound } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fixId: string }> },
) {
  try {
    const { id, fixId } = await params;
    const account = await getAccount();

    const trade = await prisma.trade.findFirst({
      where: { id, accountId: account.id },
    });
    if (!trade) return notFound("Сделка не найдена");

    // История закрытой сделки immutable.
    if (trade.status === "closed") {
      return badRequest("Сделка закрыта — фиксации нельзя удалять");
    }

    const fix = await prisma.fix.findFirst({ where: { id: fixId, tradeId: id } });
    if (!fix) return notFound("Фиксация не найдена");

    await prisma.fix.delete({ where: { id: fixId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
