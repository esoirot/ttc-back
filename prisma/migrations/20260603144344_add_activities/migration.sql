-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "legalForm" TEXT,
    "professionalEmail" TEXT,
    "professionalPhone" TEXT,
    "website" TEXT,
    "timezone" TEXT,
    "objectiveQ1" INTEGER,
    "objectiveQ2" INTEGER,
    "objectiveQ3" INTEGER,
    "objectiveQ4" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" SERIAL NOT NULL,
    "activityId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "ChargeType" NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
