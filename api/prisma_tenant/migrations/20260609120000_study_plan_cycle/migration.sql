-- StudyPlan: drop academicYear, add cycle_id FK to academic_cycles

ALTER TABLE "study_plans" DROP COLUMN IF EXISTS "academicYear";

ALTER TABLE "study_plans" ADD COLUMN "cycle_id" TEXT;

CREATE INDEX "study_plans_cycle_id_idx" ON "study_plans"("cycle_id");

ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "academic_cycles"("uuid")
  ON DELETE SET NULL ON UPDATE CASCADE;
