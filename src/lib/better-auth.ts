import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

/**
 * Адрес приложения. На проде и локально берётся из BETTER_AUTH_URL. У превью
 * адрес свой у каждого деплоя, поэтому там разрешаем ровно два хоста этого
 * деплоя — его собственный и адрес ветки. Их Vercel кладёт в системные
 * переменные. По адресу Better Auth проверяет Origin у POST-запросов: чужой
 * сайт не сможет отправить форму от имени залогиненного пользователя.
 */
function previewBaseURL() {
  if (process.env.VERCEL_ENV !== "preview") return undefined;
  const allowedHosts = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(
    (host): host is string => Boolean(host),
  );
  return allowedHosts.length > 0 ? { allowedHosts, protocol: "https" as const } : undefined;
}

/**
 * Конфиг Better Auth. Из него же CLI генерирует таблицы в prisma/schema.prisma
 * (`npx auth@latest generate`), поэтому модели авторизации в схему руками не
 * пишутся — правится этот файл, схема перегенерируется.
 */
export const auth = betterAuth({
  baseURL: previewBaseURL(),
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

  session: {
    // Сессия живёт 30 дней с последнего захода и продлевается раз в сутки:
    // с телефона не придётся логиниться заново, пока журналом пользуешься.
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    // Копия сессии в подписанной cookie на 5 минут. Proxy проверяет сессию на
    // каждом запросе, и без кеша это был бы поход в базу на каждый клик.
    // Цена — отозванная сессия (выход на другом устройстве, бан) доживает
    // до 5 минут.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // Вход по паролю идёт только через наш /api/login: там журнал попыток,
  // блокировка перебора и сигналы. Одноимённый эндпоинт самого Better Auth
  // закрыт, чтобы его нельзя было дёргать в обход. Серверный вызов
  // auth.api.signInEmail это не затрагивает — закрыт только HTTP-маршрут.
  disabledPaths: ["/sign-in/email"],

  // Встроенный лимит запросов на остальные эндпоинты /api/auth/*. В serverless
  // память между вызовами не общая, поэтому счётчики храним в базе.
  rateLimit: { enabled: true, storage: "database" },

  telemetry: { enabled: false },

  plugins: [
    // Роли (admin / user), создание пользователей админом, бан, отзыв сессий.
    admin(),
    // Позволяет серверным вызовам auth.api ставить cookie сессии через
    // next/headers. Должен быть последним.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
