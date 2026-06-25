-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('TO_CONTACT', 'CONTACTED', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3', 'TALKING', 'CLIENT');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'CLIENT';
