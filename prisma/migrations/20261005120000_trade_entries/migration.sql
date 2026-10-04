-- CreateTable
CREATE TABLE "TradeEntry" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "size" DECIMAL(18,2) NOT NULL,
    "riskPct" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeEntry_tradeId_createdAt_idx" ON "TradeEntry"("tradeId", "createdAt");

-- AddForeignKey
ALTER TABLE "TradeEntry" ADD CONSTRAINT "TradeEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Перенос: у каждой существующей сделки — один вход из её нынешних цифр.
-- id детерминированный, чтобы повторный прогон не плодил дубликатов.
INSERT INTO "TradeEntry" ("id", "tradeId", "price", "size", "riskPct", "createdAt")
SELECT 'e_' || t."id", t."id", t."entryPrice", t."positionSize", t."riskPct", t."createdAt"
FROM "Trade" t
ON CONFLICT ("id") DO NOTHING;
