-- AlterTable: Add activeGradingPeriod to enrollments
-- This column denormalizes the parent CourseCycle's active grading period
-- at the student level. Nullable because it is not always set.

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "active_grading_period" INTEGER;
