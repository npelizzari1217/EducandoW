-- Migration: boletin_printable_migration
-- SDD-2 — PR-6: Final Enrollment removal
-- Consolidates two schema deltas that have no prior migration file:
--   (a) StudentObservation: drop enrollment_id FK, add academic_cycle_id FK → academic_cycles
--   (b) Drop the enrollments table entirely
-- DB is dropped & re-created per project convention — no data backfill needed.
-- Reversible notes in rollback comments below.

-- ── (a) StudentObservation: swap enrollment FK for AcademicCycle FK ──────────
-- The enrollment_id column was added by 20260611120000_add_enrollment_id_to_student_observations.
-- ADR-3 replaces it with academic_cycle_id (AcademicCycle-wide scope, simpler no-join filter).

-- Drop the enrollment FK and its index first (required before dropping the enrollments table)
DROP INDEX IF EXISTS "student_observations_enrollment_id_idx";
ALTER TABLE "student_observations"
    DROP CONSTRAINT IF EXISTS "student_observations_enrollment_id_fkey";
ALTER TABLE "student_observations"
    DROP COLUMN IF EXISTS "enrollment_id";

-- Add academic_cycle_id column
ALTER TABLE "student_observations"
    ADD COLUMN "academic_cycle_id" TEXT;

-- AddForeignKey: student_observations → academic_cycles
ALTER TABLE "student_observations"
    ADD CONSTRAINT "student_observations_academic_cycle_id_fkey"
    FOREIGN KEY ("academic_cycle_id")
    REFERENCES "academic_cycles"("uuid")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "student_observations_academic_cycle_id_idx"
    ON "student_observations"("academic_cycle_id");

-- Rollback for (a):
--   DROP INDEX "student_observations_academic_cycle_id_idx";
--   ALTER TABLE "student_observations" DROP CONSTRAINT "student_observations_academic_cycle_id_fkey";
--   ALTER TABLE "student_observations" DROP COLUMN "academic_cycle_id";
--   ALTER TABLE "student_observations" ADD COLUMN "enrollment_id" TEXT;
--   ALTER TABLE "student_observations" ADD CONSTRAINT "student_observations_enrollment_id_fkey"
--       FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "student_observations_enrollment_id_idx" ON "student_observations"("enrollment_id");

-- ── (b) Drop the enrollments table ───────────────────────────────────────────
-- All FKs pointing INTO enrollments are now gone (enrollment_id_fkey dropped above).
-- Dropping the table cascades all FK constraints FROM enrollments (studentId_fkey, cycleId_fkey).

DROP TABLE IF EXISTS "enrollments";

-- Rollback for (b): recreate enrollments from 20240101000000_init_tenant +
--   20260606000000_add_enrollment_grading_period. Not needed — DB is regenerated.
