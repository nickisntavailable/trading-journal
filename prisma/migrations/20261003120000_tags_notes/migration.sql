-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeTag" (
    "tradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeTag_pkey" PRIMARY KEY ("tradeId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_accountId_name_key" ON "Tag"("accountId", "name");

-- CreateIndex
CREATE INDEX "TradeTag_tagId_idx" ON "TradeTag"("tagId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeTag" ADD CONSTRAINT "TradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

