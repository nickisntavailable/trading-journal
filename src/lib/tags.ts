import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TAG_NAME_MAX } from "@/lib/review-limits";

/**
 * Теги причин входа. Набор у каждого счёта свой, имена храним в нижнем
 * регистре: «FVG» и «fvg» — один тег. Удаление — архив, см. схему.
 */

export const tagNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " ").toLowerCase())
  .pipe(
    z
      .string()
      .min(1, "Пустое название")
      .max(TAG_NAME_MAX, `Название — не длиннее ${TAG_NAME_MAX} символов`),
  );

export type TagDTO = {
  id: string;
  name: string;
  archived: boolean;
  /** Сколько сделок с этим тегом — для настроек. */
  tradeCount: number;
};

export async function listTags(accountId: string): Promise<TagDTO[]> {
  const tags = await prisma.tag.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
    include: { _count: { select: { trades: true } } },
  });
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    archived: tag.archivedAt !== null,
    tradeCount: tag._count.trades,
  }));
}

/**
 * Создать тег. Если такой уже есть — вернуть его, а архивный — достать из
 * архива: заново придуманный тег с тем же именем — это тот же тег, и старые
 * сделки с ним должны считаться вместе с новыми.
 */
export async function createTag(accountId: string, name: string) {
  return prisma.tag.upsert({
    where: { accountId_name: { accountId, name } },
    create: { accountId, name },
    update: { archivedAt: null },
  });
}

/** В архив и обратно. false — тега нет у этого счёта. */
export async function setTagArchived(
  accountId: string,
  id: string,
  archived: boolean,
): Promise<boolean> {
  const { count } = await prisma.tag.updateMany({
    where: { id, accountId },
    data: { archivedAt: archived ? new Date() : null },
  });
  return count === 1;
}
