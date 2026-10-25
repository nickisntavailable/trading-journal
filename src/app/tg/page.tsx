import Script from "next/script";
import { MiniAppLogin } from "@/app/tg/mini-app-login";

export const metadata = { title: "Trading Journal" };

/**
 * Точка входа Mini App: кнопка «Журнал» в боте открывает эту страницу внутри
 * Telegram. Скрипт Telegram отдаёт подписанные данные пользователя, а мы
 * меняем их на обычную сессию журнала.
 */
export default function MiniAppPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Trading Journal</h1>
        <MiniAppLogin />
      </div>
    </main>
  );
}
