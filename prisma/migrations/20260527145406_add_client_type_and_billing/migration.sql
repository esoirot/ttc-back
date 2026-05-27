-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "billingEndOfMonth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'COMPANY',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "paymentDelayDays" INTEGER,
ADD COLUMN     "taxRate" DECIMAL(5,2);
