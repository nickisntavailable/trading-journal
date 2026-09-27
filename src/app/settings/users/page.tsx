import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InviteForm } from "@/app/settings/users/invite-form";
import { RevokeInviteButton } from "@/app/settings/users/revoke-invite-button";
import { shortDate } from "@/lib/format";
import { inviteStatus, type InviteStatus } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Пользователи — Trading Journal" };

const STATUS: Record<InviteStatus, { label: string; tone: string }> = {
  pending: { label: "ждёт", tone: "text-amber" },
  accepted: { label: "принято", tone: "text-long" },
  revoked: { label: "отозвано", tone: "text-ink-soft" },
  expired: { label: "истекло", tone: "text-ink-soft" },
};

/** Приглашения и список пользователей. Только для админа — остальным 404. */
export default async function UsersPage() {
  const session = await getSession();
  if (session?.user.role !== "admin") notFound();

  const [invites, users] = await Promise.all([
    prisma.invite.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <AppShell>
      <h1 className="border-b border-rule pb-3 text-[13px] font-medium">
        <Link href="/settings" className="text-ink-soft hover:text-ink">
          Настройки
        </Link>
        <span className="text-ink-soft"> / </span>
        Пользователи
      </h1>

      <section className="border-b border-rule py-5">
        <h2 className="text-[12px] text-ink-soft">Пригласить</h2>
        <InviteForm />
      </section>

      <section className="border-b border-rule py-5">
        <h2 className="text-[12px] text-ink-soft">Приглашения</h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-soft">Пока ни одного</p>
        ) : (
          <div className="mt-3">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div
                  key={invite.id}
                  className="flex items-baseline justify-between gap-3 border-b border-rule py-2 text-[13px] first:border-t"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{invite.email}</span>
                    <span className="num block text-[12px] text-ink-soft">
                      {status === "pending"
                        ? `до ${shortDate(invite.expiresAt)}`
                        : shortDate(invite.acceptedAt ?? invite.revokedAt ?? invite.expiresAt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3">
                    <span className={"text-[12px] " + STATUS[status].tone}>
                      {STATUS[status].label}
                    </span>
                    {status === "pending" ? <RevokeInviteButton id={invite.id} /> : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="py-5">
        <h2 className="text-[12px] text-ink-soft">Пользователи</h2>
        <div className="mt-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-baseline justify-between gap-3 border-b border-rule py-2 text-[13px] first:border-t"
            >
              <span className="min-w-0 truncate">{user.email}</span>
              <span className="num shrink-0 text-[12px] text-ink-soft">
                {user.role === "admin" ? "админ" : `с ${shortDate(user.createdAt)}`}
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
