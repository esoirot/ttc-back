-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hubspotAccessToken" TEXT,
ADD COLUMN     "hubspotPortalId" TEXT,
ADD COLUMN     "hubspotRefreshToken" TEXT,
ADD COLUMN     "hubspotTokenExpiresAt" TIMESTAMP(3);
