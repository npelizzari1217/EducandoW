-- Migration: 20260611120000_add_enrollment_id_to_student_observations
-- Change:   observations-cycle-scoping — link PEDAGOGICAL observations to an Enrollment
-- Adds nullable enrollment_id FK on student_observations so PEDAGOGICAL observations
-- are scoped to an academic cycle via the enrollment. PSYCHOPEDAGOGICAL (EOE) rows
-- leave this column NULL (cross-cycle, student-lifecycle visibility).
-- Data: no backfill needed — existing rows are dev/trivial.
-- Rollback:
--   DROP INDEX "student_observations_enrollment_id_idx";
--   ALTER TABLE "student_observations" DROP CONSTRAINT "student_observations_enrollment_id_fkey";
--   ALTER TABLE "student_observations" DROP COLUMN "enrollment_id";

-- AlterTable
ALTER TABLE "student_observations" ADD COLUMN "enrollment_id" TEXT;

-- AddForeignKey
ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "student_observations_enrollment_id_idx" ON "student_observations"("enrollment_id");
