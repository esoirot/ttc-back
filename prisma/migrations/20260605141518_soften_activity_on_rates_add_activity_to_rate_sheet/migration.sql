-- DropForeignKey
ALTER TABLE "TranslationRate" DROP CONSTRAINT "TranslationRate_activityId_fkey";

-- AlterTable
ALTER TABLE "RateSheet" ADD COLUMN     "activityId" INTEGER;

-- AlterTable
ALTER TABLE "TranslationRate" ALTER COLUMN "activityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TranslationRate" ADD CONSTRAINT "TranslationRate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateSheet" ADD CONSTRAINT "RateSheet_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
