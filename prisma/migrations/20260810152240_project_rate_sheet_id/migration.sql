-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "rateSheetId" INTEGER;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_rateSheetId_fkey" FOREIGN KEY ("rateSheetId") REFERENCES "RateSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
