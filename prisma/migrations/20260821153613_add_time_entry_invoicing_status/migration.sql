-- CreateEnum
CREATE TYPE "InvoicingStatus" AS ENUM ('NO', 'INVOICED');

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "invoicingStatus" "InvoicingStatus" NOT NULL DEFAULT 'NO';
