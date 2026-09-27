import { AppShell } from "@/components/app-shell";
import { NewTradeForm } from "@/app/trades/new/new-trade-form";
import { getAccount } from "@/lib/account";
import { accountToDTO } from "@/lib/serialize";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая сделка — Trading Journal" };

export default async function NewTradePage() {
  const [account, user] = await Promise.all([getAccount(), requireUser()]);
  return (
    <AppShell>
      <NewTradeForm
        account={accountToDTO(account)}
        canParseScreenshots={user.canParseScreenshots === true}
      />
    </AppShell>
  );
}
