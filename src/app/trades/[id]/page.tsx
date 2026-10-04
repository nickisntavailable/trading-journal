import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TradeView } from "@/components/trade-view";
import { getAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { entryToDTO, fixToDTO, tradeToDTO } from "@/lib/serialize";
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
      entries: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) notFound();
  const tags = await listTags(account.id);

  // Кандидаты на объединение: открытые, та же пара и направление, без
  // фиксаций — и только если у этой сделки фиксаций тоже нет.
  const candidates =
    row.status === "open" && row.fixes.length === 0
      ? await prisma.trade.findMany({
          where: {
            accountId: account.id,
            id: { not: row.id },
            status: "open",
            pair: row.pair,
            direction: row.direction,
            fixes: { none: {} },
          },
          include: { entries: { orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return (
    <AppShell>
      <TradeView
        initialData={{
          trade: tradeToDTO(row),
          fixes: row.fixes.map(fixToDTO),
          tagIds: row.tags.map((t) => t.tagId),
          entries: row.entries.map(entryToDTO),
        }}
        initialTags={tags}
        defaultRiskPct={Number(account.baseRiskPct)}
        mergeCandidates={candidates.map((c) => ({
          id: c.id,
          createdAt: c.createdAt.toISOString(),
          stopLoss: Number(c.stopLoss),
          riskAmount: Number(c.riskAmount),
          entries: c.entries.map(entryToDTO),
        }))}
      />
    </AppShell>
  );
}
