-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "fixedFee" DECIMAL(10,4),
ADD COLUMN     "hourlyRate" DECIMAL(10,4),
ADD COLUMN     "perWordRate" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "ClientRate" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "RateType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
