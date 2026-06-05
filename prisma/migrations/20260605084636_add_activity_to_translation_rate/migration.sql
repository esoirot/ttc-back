/*
  Warnings:

  - Added the required column `activityId` to the `TranslationRate` table without a default value. This is not possible if the table is not empty.

*/
-- Clear orphaned rates that have no activity (dev data cleanup)
DELETE FROM "TranslationRate";

-- AlterTable
ALTER TABLE "TranslationRate" ADD COLUMN     "activityId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "TranslationRate" ADD CONSTRAINT "TranslationRate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
