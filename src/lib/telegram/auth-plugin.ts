import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/telegram/init-data";

/**
 * Вход из Telegram Mini App: POST /api/auth/telegram/mini-app с initData.
 *
 * Плагин Better Auth, а не свой маршрут: так сессию создаёт и cookie ставит
 * сама библиотека — ровно как при входе по паролю (подпись cookie, срок,
 * атрибуты). Пускаем только Telegram, привязанный к учётке; регистрации
 * здесь нет.
 */
export function telegramMiniApp() {
  return {
    id: "telegram-mini-app",
    endpoints: {
      telegramMiniAppSignIn: createAuthEndpoint(
        "/telegram/mini-app",
        { method: "POST", body: z.object({ initData: z.string().min(1).max(4096) }) },
        async (ctx) => {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          if (!token) throw new APIError("SERVICE_UNAVAILABLE", { message: "Бот не настроен" });

          const result = verifyInitData(ctx.body.initData, token);
          if (!result.ok) {
            throw new APIError("UNAUTHORIZED", {
              message:
                result.reason === "expired"
                  ? "Данные Telegram устарели — закрой и открой журнал заново"
                  : "Не удалось проверить данные Telegram",
            });
          }

          const link = await prisma.telegramAccount.findUnique({
            where: { telegramId: BigInt(result.user.id) },
            select: { userId: true },
          });
          if (!link) {
            throw new APIError("FORBIDDEN", {
              message: "Этот Telegram не привязан к учётке журнала",
              code: "TELEGRAM_NOT_LINKED",
            });
          }

          const user = await ctx.context.internalAdapter.findUserById(link.userId);
          if (!user) throw new APIError("FORBIDDEN", { message: "Учётка не найдена" });
          if ((user as { banned?: boolean | null }).banned) {
            throw new APIError("FORBIDDEN", { message: "Вход для этого пользователя закрыт" });
          }

          // Уже вошли этой же учёткой — новая сессия не нужна: иначе каждое
          // открытие Mini App плодило бы строку в таблице сессий.
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (current?.user.id === user.id) return ctx.json({ ok: true, reused: true });

          const session = await ctx.context.internalAdapter.createSession(user.id);
          if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Не удалось войти" });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ ok: true, reused: false });
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
