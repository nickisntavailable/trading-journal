-- Комиссии: maker (лимитка) и taker (рынок) вместо одной ставки.
-- Порядок важен: новые колонки → перенос из старой ставки → удаление старой.

-- Счёт: ставки обычного уровня Binance USDⓈ-M (решение владельца).
ALTER TABLE "Account"
  ADD COLUMN "makerFeePct" DECIMAL(6,4) NOT NULL DEFAULT 0.0200,
  ADD COLUMN "takerFeePct" DECIMAL(6,4) NOT NULL DEFAULT 0.0500;

-- Сделки: снапшот ставок. У старых сделок обе ставки = прежняя единая,
-- и комиссия входа = номинал × она же — их результаты не меняются.
ALTER TABLE "Trade"
  ADD COLUMN "makerFeePct" DECIMAL(6,4),
  ADD COLUMN "takerFeePct" DECIMAL(6,4),
  ADD COLUMN "entryFeeAmount" DECIMAL(18,4);
UPDATE "Trade" SET
  "makerFeePct" = "feeRateAtEntry",
  "takerFeePct" = "feeRateAtEntry",
  "entryFeeAmount" = ROUND("positionSize" * "feeRateAtEntry" / 100, 4);
ALTER TABLE "Trade"
  ALTER COLUMN "makerFeePct" SET NOT NULL,
  ALTER COLUMN "takerFeePct" SET NOT NULL,
  ALTER COLUMN "entryFeeAmount" SET NOT NULL;

-- Входы: тип заявки и ставка, по которой взята комиссия.
ALTER TABLE "TradeEntry"
  ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'market',
  ADD COLUMN "feePct" DECIMAL(6,4);
UPDATE "TradeEntry" e SET "feePct" = t."feeRateAtEntry" FROM "Trade" t WHERE t."id" = e."tradeId";
ALTER TABLE "TradeEntry" ALTER COLUMN "feePct" SET NOT NULL;

-- Фиксации: тип заявки. Старые — рынок; при равных ставках это неважно.
ALTER TABLE "Fix" ADD COLUMN "orderType" TEXT NOT NULL DEFAULT 'market';

ALTER TABLE "Trade" DROP COLUMN "feeRateAtEntry";
ALTER TABLE "Account" DROP COLUMN "feeRatePct";
