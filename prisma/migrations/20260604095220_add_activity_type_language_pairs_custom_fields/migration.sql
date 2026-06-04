-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('TRANSLATOR', 'CORRECTOR', 'CUSTOM');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "activityType" "ActivityType" NOT NULL DEFAULT 'CUSTOM';

-- CreateTable
CREATE TABLE "LanguagePair" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "fromLanguage" TEXT NOT NULL,
    "toLanguage" TEXT NOT NULL,

    CONSTRAINT "LanguagePair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CustomField_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LanguagePair" ADD CONSTRAINT "LanguagePair_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
