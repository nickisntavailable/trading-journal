import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SetupForm } from "@/app/setup/setup-form";
import { setupAvailable } from "@/lib/owner-setup";

export const metadata = { title: "Настройка — Trading Journal" };

/** Одноразовая страница: после создания владельца отдаёт 404. */
export default async function SetupPage() {
  // Без этого Next соберёт страницу статикой и запомнит ответ базы на момент сборки.
  await connection();
  if (!(await setupAvailable())) notFound();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Учётка владельца</h1>
        <p className="mt-1 text-[13px] text-ink-soft">
          Один раз: почта из OWNER_EMAIL, новый пароль и старый общий пароль для
          подтверждения. Все сделки перейдут к этой учётке.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
