import Link from "next/link";
import { connection } from "next/server";
import { AcceptInviteForm } from "@/app/invite/[token]/accept-invite-form";
import { findPendingInvite } from "@/lib/invites";

export const metadata = { title: "Приглашение — Trading Journal" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = await findPendingInvite(token);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-[320px]">
        <h1 className="text-[15px] font-medium tracking-tight">Trading Journal</h1>
        {invite ? (
          <>
            <p className="mt-1 text-[13px] text-ink-soft">Тебя пригласили в журнал сделок</p>
            <AcceptInviteForm token={token} email={invite.email} />
          </>
        ) : (
          <p className="mt-6 border-t border-rule pt-5 text-[13px]">
            Ссылка недействительна: её уже использовали, отозвали или прошло 7 дней.
            Попроси новую. Если учётка уже есть —{" "}
            <Link href="/login" className="underline underline-offset-2">
              войти
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  );
}
