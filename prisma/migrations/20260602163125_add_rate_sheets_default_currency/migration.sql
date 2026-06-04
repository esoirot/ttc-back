-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR';

-- CreateTable
CREATE TABLE "RateSheet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "clientId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceLanguage" VARCHAR(2) NOT NULL,
    "targetLanguage" VARCHAR(2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "pricePerWord" DECIMAL(10,6) NOT NULL,
    "matchRates" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateSheet_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RateSheet" ADD CONSTRAINT "RateSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateSheet" ADD CONSTRAINT "RateSheet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
