-- Rename the business "Activity" domain to "Occupation".
-- Renames in place (no drop/create) so every row and FK link is preserved.
-- TaskActivity (task history log) is a separate concept and is left untouched.

-- Enum
ALTER TYPE "ActivityType" RENAME TO "OccupationType";

-- Occupation (formerly Activity)
ALTER TABLE "Activity" RENAME TO "Occupation";
ALTER TABLE "Occupation" RENAME COLUMN "activityType" TO "occupationType";
ALTER SEQUENCE "Activity_id_seq" RENAME TO "Occupation_id_seq";
ALTER TABLE "Occupation" RENAME CONSTRAINT "Activity_pkey" TO "Occupation_pkey";
ALTER TABLE "Occupation" RENAME CONSTRAINT "Activity_userId_fkey" TO "Occupation_userId_fkey";

-- ClientOccupation (formerly ClientActivity)
ALTER TABLE "ClientActivity" RENAME TO "ClientOccupation";
ALTER TABLE "ClientOccupation" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "ClientOccupation" RENAME CONSTRAINT "ClientActivity_pkey" TO "ClientOccupation_pkey";
ALTER TABLE "ClientOccupation" RENAME CONSTRAINT "ClientActivity_clientId_fkey" TO "ClientOccupation_clientId_fkey";
ALTER TABLE "ClientOccupation" RENAME CONSTRAINT "ClientActivity_activityId_fkey" TO "ClientOccupation_occupationId_fkey";

-- ProjectOccupation (formerly ProjectActivity)
ALTER TABLE "ProjectActivity" RENAME TO "ProjectOccupation";
ALTER TABLE "ProjectOccupation" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "ProjectOccupation" RENAME CONSTRAINT "ProjectActivity_pkey" TO "ProjectOccupation_pkey";
ALTER TABLE "ProjectOccupation" RENAME CONSTRAINT "ProjectActivity_projectId_fkey" TO "ProjectOccupation_projectId_fkey";
ALTER TABLE "ProjectOccupation" RENAME CONSTRAINT "ProjectActivity_activityId_fkey" TO "ProjectOccupation_occupationId_fkey";

-- occupationId foreign keys on dependent tables
ALTER TABLE "Charge" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "Charge" RENAME CONSTRAINT "Charge_activityId_fkey" TO "Charge_occupationId_fkey";

ALTER TABLE "LanguagePair" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "LanguagePair" RENAME CONSTRAINT "LanguagePair_activityId_fkey" TO "LanguagePair_occupationId_fkey";

ALTER TABLE "CustomField" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "CustomField" RENAME CONSTRAINT "CustomField_activityId_fkey" TO "CustomField_occupationId_fkey";

ALTER TABLE "RateSheet" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "RateSheet" RENAME CONSTRAINT "RateSheet_activityId_fkey" TO "RateSheet_occupationId_fkey";

ALTER TABLE "TranslationRate" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "TranslationRate" RENAME CONSTRAINT "TranslationRate_activityId_fkey" TO "TranslationRate_occupationId_fkey";

ALTER TABLE "TimeEntry" RENAME COLUMN "activityId" TO "occupationId";
ALTER TABLE "TimeEntry" RENAME CONSTRAINT "TimeEntry_activityId_fkey" TO "TimeEntry_occupationId_fkey";

-- Data: carry the rename into user-facing occupation names
UPDATE "Occupation"
SET "name" = replace(replace(replace(replace(replace(replace("name",
  'ACTIVITIES', 'OCCUPATIONS'), 'Activities', 'Occupations'), 'activities', 'occupations'),
  'ACTIVITY', 'OCCUPATION'), 'Activity', 'Occupation'), 'activity', 'occupation')
WHERE "name" ILIKE '%activit%';
