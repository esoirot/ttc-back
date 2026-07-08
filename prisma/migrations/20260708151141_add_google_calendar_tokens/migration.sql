-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleCalendarAccessToken" TEXT,
ADD COLUMN     "googleCalendarEmail" TEXT,
ADD COLUMN     "googleCalendarRefreshToken" TEXT,
ADD COLUMN     "googleCalendarTokenExpiresAt" TIMESTAMP(3);

-- RenameIndex
ALTER INDEX "PasswordResetToken_token_key" RENAME TO "PasswordResetToken_tokenHash_key";
