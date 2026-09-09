import { AppShell } from "@/components/app-shell";
import { AccountSettingsForm } from "@/app/settings/account-settings-form";
import { BalanceForm } from "@/app/settings/balance-form";
import { getAccount } from "@/lib/account";
import { dateTime, money, signedMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { accountToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Настройки — Trading Journal" };

const EVENT_LABELS: Record<string, string> = {
  deposit: "пополнение",
  withdrawal: "снятие",
  trade_settlement: "расчёт по сделке",
  manual_adjustment: "ручная корректировка",
};

export default async function SettingsPage() {
  const account = await getAccount();
  const events = await prisma.balanceEvent.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell>
      <h1 className="border-b border-rule pb-3 text-[13px] font-medium">Настройки</h1>

      <section className="border-b border-rule py-5">
        <h2 className="text-[12px] text-ink-soft">Параметры аккаунта</h2>
        <AccountSettingsForm account={accountToDTO(account)} />
      </section>

      <section className="border-b border-rule py-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[12px] text-ink-soft">Баланс</h2>
          <span className="num text-[16px]">{money(Number(account.balance))}</span>
        </div>
        <BalanceForm />
      </section>

      <section className="py-5">
        <h2 className="text-[12px] text-ink-soft">История изменений баланса</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-[13px] text-ink-soft">Пока пусто</p>
        ) : (
          <div className="mt-3">
            {events.map((event) => {
              const amount = Number(event.amount);
              const tone = amount > 0 ? "text-long" : amount < 0 ? "text-short" : "";
              return (
                <div
                  key={event.id}
                  className="grid grid-cols-[1fr_auto] items-baseline gap-3 border-b border-rule py-2 text-[13px] first:border-t"
                >
                  <span className="min-w-0">
                    <span className="truncate">{EVENT_LABELS[event.type] ?? event.type}</span>
                    {event.note ? (
                      <span className="ml-2 text-[12px] text-ink-soft">{event.note}</span>
                    ) : null}
                    <span className="num ml-2 text-[12px] text-ink-soft">
                      {dateTime(event.createdAt)}
                    </span>
                  </span>
                  <span className={"num text-right " + tone}>{signedMoney(amount)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
