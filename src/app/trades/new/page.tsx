import { AppShell } from "@/components/app-shell";
import { NewTradeForm } from "@/app/trades/new/new-trade-form";
import { getAccount } from "@/lib/account";
import { accountToDTO } from "@/lib/serialize";
import { requireUser } from "@/lib/session";
import { listTags } from "@/lib/tags";
import { parseTradePrefill } from "@/lib/trade-prefill";

export const dynamic = "force-dynamic";
export const metadata = { title: "Новая сделка — Trading Journal" };

export default async function NewTradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [account, user, params] = await Promise.all([getAccount(), requireUser(), searchParams]);
  const tags = await listTags(account.id);
  return (
    <AppShell>
      <NewTradeForm
        account={accountToDTO(account)}
        canParseScreenshots={user.canParseScreenshots === true}
        initialTags={tags}
        prefill={parseTradePrefill(params)}
      />
    </AppShell>
  );
}
