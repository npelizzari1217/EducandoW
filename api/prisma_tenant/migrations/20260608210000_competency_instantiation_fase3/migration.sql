-- competency-instantiation Fase 3 — destructive migration
-- Tables are empty (user-confirmed). No backfill required.
-- Spec: migration-integrity/spec.md MI-1..MI-10

-- ── Step 1: Drop flat period columns from competency_valuations ──────────────
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "valuation1";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "valuation2";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "valuation3";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "valuation4";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "modificable1";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "modificable2";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "modificable3";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "modificable4";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "imprimible1";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "imprimible2";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "imprimible3";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "imprimible4";
ALTER TABLE "competency_valuations" DROP COLUMN IF EXISTS "periodActive";

-- ── Step 2: Add courseCycleId (NOT NULL) ─────────────────────────────────────
-- Note: Adding NOT NULL requires table to be empty. Confirmed empty.
ALTER TABLE "competency_valuations" ADD COLUMN "course_cycle_id" TEXT NOT NULL;

-- ── Step 3: Drop old UNIQUE(studentId, competencyId) ─────────────────────────
ALTER TABLE "competency_valuations" DROP CONSTRAINT IF EXISTS "competency_valuations_studentId_competencyId_key";

-- ── Step 4: Add new UNIQUE(studentId, competencyId, courseCycleId) + index ───
ALTER TABLE "competency_valuations" ADD CONSTRAINT "competency_valuations_studentId_competencyId_course_cycle_id_key"
  UNIQUE ("studentId", "competencyId", "course_cycle_id");

CREATE INDEX IF NOT EXISTS "competency_valuations_course_cycle_id_idx" ON "competency_valuations"("course_cycle_id");

-- ── Step 5: Add FK to CourseCycle.uuid (Restrict) ────────────────────────────
ALTER TABLE "competency_valuations" ADD CONSTRAINT "competency_valuations_course_cycle_id_fkey"
  FOREIGN KEY ("course_cycle_id") REFERENCES "course_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Step 6: Create competency_period_valuations ───────────────────────────────
CREATE TABLE "competency_period_valuations" (
    "id"                 TEXT NOT NULL,
    "valuation_id"       TEXT NOT NULL,
    "period_item_id"     TEXT NOT NULL,
    "grade_scale_value_id" TEXT,
    "grade_code"         TEXT,
    "internal_status"    "GradeInternalStatus",
    "modificable"        BOOLEAN NOT NULL DEFAULT true,
    "imprimible"         BOOLEAN NOT NULL DEFAULT false,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_period_valuations_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "competency_period_valuations_valuation_id_idx" ON "competency_period_valuations"("valuation_id");
CREATE INDEX "competency_period_valuations_period_item_id_idx" ON "competency_period_valuations"("period_item_id");
CREATE UNIQUE INDEX "competency_period_valuations_valuation_id_period_item_id_key"
  ON "competency_period_valuations"("valuation_id", "period_item_id");

-- FKs with the approved on-delete matrix
ALTER TABLE "competency_period_valuations" ADD CONSTRAINT "competency_period_valuations_valuation_id_fkey"
  FOREIGN KEY ("valuation_id") REFERENCES "competency_valuations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_period_valuations" ADD CONSTRAINT "competency_period_valuations_period_item_id_fkey"
  FOREIGN KEY ("period_item_id") REFERENCES "grading_period_template_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competency_period_valuations" ADD CONSTRAINT "competency_period_valuations_grade_scale_value_id_fkey"
  FOREIGN KEY ("grade_scale_value_id") REFERENCES "grade_scale_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
