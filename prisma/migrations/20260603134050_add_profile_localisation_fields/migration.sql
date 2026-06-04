-- AlterTable
ALTER TABLE "TranslationRate" RENAME CONSTRAINT "Rate_pkey" TO "TranslationRate_pkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateFormat" TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "hourFormat" TEXT DEFAULT '24h',
ADD COLUMN     "interfaceLanguage" TEXT DEFAULT 'en',
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mobilePhone" TEXT,
ADD COLUMN     "numberFormat" TEXT DEFAULT '1,234.56';

-- RenameForeignKey
ALTER TABLE "TranslationRate" RENAME CONSTRAINT "Rate_clientId_fkey" TO "TranslationRate_clientId_fkey";

-- RenameForeignKey
ALTER TABLE "TranslationRate" RENAME CONSTRAINT "Rate_userId_fkey" TO "TranslationRate_userId_fkey";
