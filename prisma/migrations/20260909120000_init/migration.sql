-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "baseRiskPct" DECIMAL(5,2) NOT NULL,
    "feeRatePct" DECIMAL(6,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "relatedTradeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "direction" INTEGER NOT NULL,
    "entryPrice" DECIMAL(18,8) NOT NULL,
    "stopLoss" DECIMAL(18,8) NOT NULL,
    "riskPct" DECIMAL(5,2) NOT NULL,
    "depositAtEntry" DECIMAL(18,2) NOT NULL,
    "feeRateAtEntry" DECIMAL(6,4) NOT NULL,
    "riskAmount" DECIMAL(18,2) NOT NULL,
    "positionSize" DECIMAL(18,2) NOT NULL,
    "tvLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "grossPnL" DECIMAL(18,2),
    "totalFees" DECIMAL(18,2),
    "netPnL" DECIMAL(18,2),
    "netPnlPctOfDeposit" DECIMAL(8,4),
    "realizedAvgExit" DECIMAL(18,8),
    "realizedRR" DECIMAL(8,4),

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fix" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "sizePct" DECIMAL(5,2) NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BalanceEvent_accountId_idx" ON "BalanceEvent"("accountId");

-- CreateIndex
CREATE INDEX "Trade_accountId_status_idx" ON "Trade"("accountId", "status");

-- CreateIndex
CREATE INDEX "Fix_tradeId_idx" ON "Fix"("tradeId");

-- AddForeignKey
ALTER TABLE "BalanceEvent" ADD CONSTRAINT "BalanceEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fix" ADD CONSTRAINT "Fix_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

