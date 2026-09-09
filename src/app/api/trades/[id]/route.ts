import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
import { handleError, notFound } from "@/lib/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const account = await getAccount();

    const trade = await prisma.trade.findFirst({
      where: { id, accountId: account.id },
      include: { fixes: { orderBy: { createdAt: "asc" } } },
    });
    if (!trade) return notFound("Сделка не найдена");

    return NextResponse.json({
      trade: tradeToDTO(trade),
      fixes: trade.fixes.map(fixToDTO),
    });
  } catch (error) {
    return handleError(error);
  }
}
