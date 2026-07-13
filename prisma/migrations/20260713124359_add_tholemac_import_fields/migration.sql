-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "legalForm" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "CompanyContact" ADD COLUMN     "color" TEXT,
ADD COLUMN     "jobTitle" TEXT;
