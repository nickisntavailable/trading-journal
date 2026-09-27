import Link from "next/link";
import { connection } from "next/server";
import { ResetPasswordForm } from "@/app/reset/[token]/reset-password-form";
import { findPendingReset } from "@/lib/password-reset";

export const metadata = { title: "Новый пароль — Trading Journal" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const reset = await findPendingReset(token);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Trading Journal</h1>
        {reset ? (
          <>
            <p className="mt-1 text-[13px] text-ink-soft">Новый пароль для учётки</p>
            <ResetPasswordForm token={token} email={reset.user.email} />
          </>
        ) : (
          <p className="mt-6 border-t border-rule pt-5 text-[13px]">
            Ссылка недействительна: её уже использовали, заменили новой или прошли сутки.
            Попроси новую.{" "}
            <Link href="/login" className="underline underline-offset-2">
              Ко входу
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
