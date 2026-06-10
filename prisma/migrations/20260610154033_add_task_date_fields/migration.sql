-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "recurring" TEXT,
ADD COLUMN     "reminderOffset" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);
