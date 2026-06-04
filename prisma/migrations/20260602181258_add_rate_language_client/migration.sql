-- AlterTable
ALTER TABLE "Rate" ADD COLUMN     "clientId" INTEGER,
ADD COLUMN     "sourceLanguage" VARCHAR(2),
ADD COLUMN     "targetLanguage" VARCHAR(2);

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
