-- Rename PasswordResetToken.token -> tokenHash: the column now stores a sha256
-- hash of the reset token, not the raw value (mirrors RefreshToken.tokenHash).
ALTER TABLE "PasswordResetToken" RENAME COLUMN "token" TO "tokenHash";
