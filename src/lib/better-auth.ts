import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

/**
 * Конфиг Better Auth. Из него же CLI генерирует таблицы в prisma/schema.prisma
 * (`npx auth@latest generate`), поэтому модели авторизации в схему руками не
 * пишутся — правится этот файл, схема перегенерируется.
 *
 * Пока конфиг ни к одному маршруту не подключён: вход работает по-старому.
 * Обработчик /api/auth/* и страница входа появятся в следующей задачке.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // У Better Auth своя таблица `account` — способы входа пользователя (пароль,
  // Google). У нас `Account` — торговый счёт с балансом. Их модель переименована,
  // чтобы не трогать наш код и не путать при чтении.
  account: { modelName: "authAccount" },

  user: {
    additionalFields: {
      // Доступ к разбору скриншотов: каждый вызов стоит денег, поэтому право
      // выдаёт админ точечно. Проверяться будет на сервере в /api/parse-screenshot.
      canParseScreenshots: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // пользователь не может выставить себе сам при регистрации
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    // Регистрация только по приглашению — само приглашение в отдельной задачке.
    disableSignUp: true,
  },

  // Встроенный лимит запросов. В serverless память между вызовами не общая,
  // поэтому счётчики храним в базе. Правило для входа — как в нашей защите:
  // не больше 5 попыток за 15 минут.
  rateLimit: {
    enabled: true,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 5 },
    },
  },

  telemetry: { enabled: false },

  plugins: [
    // Роли (admin / user), создание пользователей админом, бан, отзыв сессий.
    admin(),
    // Позволяет серверным экшенам Next ставить cookie сессии. Должен быть последним.
    nextCookies(),
  ],
});
