-- CreateTable
CREATE TABLE "TelegramAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_userId_key" ON "TelegramAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAccount_telegramId_key" ON "TelegramAccount"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_userId_idx" ON "TelegramLinkToken"("userId");

-- AddForeignKey
ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

