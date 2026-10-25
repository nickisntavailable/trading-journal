import { redirect } from "next/navigation";

/**
 * Прежний адрес Mini App. Кнопка бота теперь ведёт сразу в журнал
 * (`/?tgapp=1`), а этот адрес остался для уже разосланных кнопок под
 * сообщениями. Хеш с данными Telegram браузер при редиректе сохраняет.
 */
export default function MiniAppPage() {
  redirect("/?tgapp=1");
}
