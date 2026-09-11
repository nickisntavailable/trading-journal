-- AlterTable
ALTER TABLE "Account" ADD COLUMN "defaultLeverage" DECIMAL(5,2) NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN "leverage" DECIMAL(5,2) NOT NULL DEFAULT 5;
