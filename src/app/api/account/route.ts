import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAccount } from "@/lib/account";
import { getDashboardStats } from "@/lib/queries";
import { accountToDTO } from "@/lib/serialize";
import { handleError } from "@/lib/api";

export async function GET() {
  try {
    const account = await getAccount();
    const stats = await getDashboardStats(account.id);
    return NextResponse.json({ account: accountToDTO(account), stats });
  } catch (error) {
    return handleError(error);
  }
}

// Баланс здесь не меняется: только через BalanceEvent или закрытие сделки.
const patchSchema = z
  .object({
    baseRiskPct: z.number().gt(0).max(100).optional(),
    riskLimitPct: z.number().gt(0).max(100).optional(),
    feeRatePct: z.number().min(0).max(10).optional(),
  })
  .refine(
    (v) =>
      v.baseRiskPct !== undefined ||
      v.riskLimitPct !== undefined ||
      v.feeRatePct !== undefined,
    { message: "Нечего обновлять" },
  );

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await request.json());
    const account = await getAccount();

    const updated = await prisma.account.update({
      where: { id: account.id },
      data: {
        ...(body.baseRiskPct !== undefined ? { baseRiskPct: body.baseRiskPct } : {}),
        ...(body.riskLimitPct !== undefined ? { riskLimitPct: body.riskLimitPct } : {}),
        ...(body.feeRatePct !== undefined ? { feeRatePct: body.feeRatePct } : {}),
      },
    });

    return NextResponse.json({ account: accountToDTO(updated) });
  } catch (error) {
    return handleError(error);
  }
}
