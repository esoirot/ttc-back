-- Invoice numbers are sequential per user (INV-<year>-<n>), so they only
-- need to be unique per user. Existing rows are globally unique already.
DROP INDEX "Invoice_number_key";
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");
