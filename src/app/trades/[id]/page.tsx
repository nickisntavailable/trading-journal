import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TradeView } from "@/components/trade-view";
import { getAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { fixToDTO, tradeToDTO } from "@/lib/serialize";
import { listTags } from "@/lib/tags";

export const dynamic = "force-dynamic";

/**
 * SSR отдаёт первый снимок сделки; дальше страница живёт в кеше Query на
 * клиенте, и мутации не требуют перерисовки с сервера.
 */
export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();

  const row = await prisma.trade.findFirst({
    where: { id, accountId: account.id },
    include: {
      fixes: { orderBy: { createdAt: "asc" } },
      tags: { select: { tagId: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) notFound();
  const tags = await listTags(account.id);

  return (
    <AppShell>
      <TradeView
        initialData={{
          trade: tradeToDTO(row),
          fixes: row.fixes.map(fixToDTO),
          tagIds: row.tags.map((t) => t.tagId),
        }}
        initialTags={tags}
      />
    </AppShell>
  );
}
