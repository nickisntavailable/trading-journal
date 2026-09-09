import { AppShell } from "@/components/app-shell";
import { NewTradeForm } from "@/app/trades/new/new-trade-form";
import { getAccount } from "@/lib/account";
import { accountToDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая сделка — Trading Journal" };

export default async function NewTradePage() {
  const account = await getAccount();
  return (
    <AppShell>
      <h1 className="text-[13px] font-medium">Новая сделка</h1>
      <NewTradeForm account={accountToDTO(account)} />
    </AppShell>
  );
}
