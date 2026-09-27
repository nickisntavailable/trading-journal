import Link from "next/link";
import { LoginForm } from "@/app/login/login-form";
import { setupAvailable } from "@/lib/owner-setup";

export const metadata = { title: "Вход — Trading Journal" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const firstRun = await setupAvailable();
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Trading Journal</h1>
        <p className="mt-1 text-[13px] text-ink-soft">Личный журнал сделок</p>
        {firstRun ? (
          <p className="mt-6 border-t border-rule pt-5 text-[13px]">
            Вход теперь по почте и паролю.{" "}
            <Link href="/setup" className="underline underline-offset-2">
              Создать учётку владельца
            </Link>
          </p>
        ) : (
          <LoginForm from={from} />
        )}
      </div>
    </main>
  );
}
