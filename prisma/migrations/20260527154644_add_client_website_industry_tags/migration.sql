-- CreateEnum
CREATE TYPE "ClientIndustry" AS ENUM ('HEALTHCARE', 'EDUCATION', 'LEGAL', 'FINANCE', 'TECHNOLOGY', 'VIDEO_GAMES', 'MARKETING', 'MEDIA_ENTERTAINMENT', 'E_COMMERCE', 'MANUFACTURING', 'AUTOMOTIVE', 'GOVERNMENT', 'NGO', 'REAL_ESTATE', 'OTHER');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "industry" "ClientIndustry",
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "ClientTag" (
    "clientId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,

    CONSTRAINT "ClientTag_pkey" PRIMARY KEY ("clientId","tagId")
);

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
