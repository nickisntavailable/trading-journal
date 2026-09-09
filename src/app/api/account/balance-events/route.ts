import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { balanceEventToDTO } from "@/lib/serialize";
import { badRequest, handleError } from "@/lib/api";

const bodySchema = z.object({
  type: z.enum(["deposit", "withdrawal", "manual_adjustment"]),
  amount: z.number().finite(),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const account = await getAccount();

    // Нормализуем знак: пополнение всегда +, снятие всегда −.
    // manual_adjustment принимает знак как есть.
    let amount = body.amount;
    if (body.type === "deposit") amount = Math.abs(amount);
    if (body.type === "withdrawal") amount = -Math.abs(amount);
    if (amount === 0) return badRequest("Сумма не может быть нулевой");

    const [event] = await prisma.$transaction([
      prisma.balanceEvent.create({
        data: {
          accountId: account.id,
          type: body.type,
          amount,
          note: body.note || null,
        },
      }),
      prisma.account.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      }),
    ]);

    return NextResponse.json({ balanceEvent: balanceEventToDTO(event) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
