import { NextResponse } from "next/server";
import { badRequest, handleError, notFound } from "@/lib/api";
import { createResetLink } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

/** Ссылка для сброса пароля. Админ пересылает её сам — писем нет. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return badRequest("Свой пароль меняй в настройках");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return notFound("Пользователь не найден");
    // Ссылка сброса — это вход в чужую учётку. Для админа это был бы захват
    // чужих админских прав, поэтому админы меняют пароль только сами.
    if (target.role === "admin") return badRequest("Админ меняет пароль сам в настройках");

    const token = await createResetLink(id);
    const url = new URL(`/reset/${token}`, request.url).toString();
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
