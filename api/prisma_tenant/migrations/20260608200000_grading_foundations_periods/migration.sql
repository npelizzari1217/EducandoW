-- Migration: grading_foundations_periods
-- Purpose: Create the 3-level grading period structure (template → items → dates).
-- Strategy: pure CREATE TABLE — no ALTER or TRUNCATE of existing tables.

-- 1. Plantillas de período reutilizables por nivel/modalidad
CREATE TABLE "grading_period_templates" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"       TEXT        NOT NULL,
  "level"      INTEGER     NOT NULL,
  "modality"   INTEGER     NOT NULL DEFAULT 0,
  "active"     BOOLEAN     NOT NULL DEFAULT true,
  "deletedAt"  TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "grading_period_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grading_period_templates_level_modality_name_key"
  ON "grading_period_templates"("level", "modality", "name");

CREATE INDEX "grading_period_templates_level_idx"
  ON "grading_period_templates"("level");

-- 2. Ítems de cada plantilla (definen qué períodos existen y su orden)
CREATE TABLE "grading_period_template_items" (
  "id"          TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "template_id" TEXT    NOT NULL,
  "name"        TEXT    NOT NULL,
  "sortOrder"   INTEGER NOT NULL,

  CONSTRAINT "grading_period_template_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grading_period_template_items_template_id_sortOrder_key"
  ON "grading_period_template_items"("template_id", "sortOrder");

CREATE UNIQUE INDEX "grading_period_template_items_template_id_name_key"
  ON "grading_period_template_items"("template_id", "name");

CREATE INDEX "grading_period_template_items_template_id_idx"
  ON "grading_period_template_items"("template_id");

ALTER TABLE "grading_period_template_items"
  ADD CONSTRAINT "grading_period_template_items_template_id_fkey"
  FOREIGN KEY ("template_id")
  REFERENCES "grading_period_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Fechas materializadas por ciclo lectivo (AcademicCycle.uuid)
CREATE TABLE "grading_period_dates" (
  "id"                TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "template_item_id"  TEXT        NOT NULL,
  "cycle_id"          TEXT        NOT NULL,
  "start_date"        TIMESTAMP(3) NOT NULL,
  "end_date"          TIMESTAMP(3) NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "grading_period_dates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grading_period_dates_template_item_id_cycle_id_key"
  ON "grading_period_dates"("template_item_id", "cycle_id");

CREATE INDEX "grading_period_dates_cycle_id_idx"
  ON "grading_period_dates"("cycle_id");

ALTER TABLE "grading_period_dates"
  ADD CONSTRAINT "grading_period_dates_template_item_id_fkey"
  FOREIGN KEY ("template_item_id")
  REFERENCES "grading_period_template_items"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grading_period_dates"
  ADD CONSTRAINT "grading_period_dates_cycle_id_fkey"
  FOREIGN KEY ("cycle_id")
  REFERENCES "academic_cycles"("uuid")
  ON DELETE CASCADE ON UPDATE CASCADE;
