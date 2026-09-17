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
      <NewTradeForm account={accountToDTO(account)} />
    </AppShell>
  );
}
