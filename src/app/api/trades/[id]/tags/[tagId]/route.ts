import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { handleError, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; tagId: string }> };

/**
 * Отметить тег в сделке. Идемпотентно: повтор запроса (двойной тап, ретрай)
 * ничего не ломает. И сделка, и тег должны принадлежать счёту из сессии —
 * иначе можно было бы повесить свой тег на чужую сделку или наоборот.
 */
export async function PUT(_request: Request, { params }: Params) {
  try {
    const account = await getAccount();
    const { id, tagId } = await params;

    const [trade, tag] = await Promise.all([
      prisma.trade.findFirst({ where: { id, accountId: account.id }, select: { id: true } }),
      prisma.tag.findFirst({
        where: { id: tagId, accountId: account.id, archivedAt: null },
        select: { id: true },
      }),
    ]);
    if (!trade) return notFound("Сделка не найдена");
    if (!tag) return notFound("Тег не найден или в архиве");

    await prisma.tradeTag.createMany({ data: [{ tradeId: id, tagId }], skipDuplicates: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Снять тег. Архивный тоже можно снять — он виден в старых сделках. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const account = await getAccount();
    const { id, tagId } = await params;

    const trade = await prisma.trade.findFirst({
      where: { id, accountId: account.id },
      select: { id: true },
    });
    if (!trade) return notFound("Сделка не найдена");

    await prisma.tradeTag.deleteMany({ where: { tradeId: id, tagId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
