-- Migration: attendance_type_behavior
-- Strategy: staged migration (ADR-02, Riesgo A) — create enum type, add nullable
-- column, backfill every existing row, then enforce NOT NULL. Additive only:
-- `assignable` is NOT dropped (it becomes a derived value at the application
-- layer — ADR-03 — but the column stays for a safe, single-step rollback).
--
-- Rollback (manual, NOT executed by this migration):
--   ALTER TABLE "attendance_types" DROP COLUMN "behavior";
--   DROP TYPE "AttendanceBehavior";
--   (assignable column and all rows are untouched by the rollback)

-- Step 1: create the native enum type (ADR-01)
CREATE TYPE "AttendanceBehavior" AS ENUM (
  'AUSENTE_INJUSTIFICADO',
  'AUSENTE_JUSTIFICADO',
  'NO_ELEGIBLE',
  'NO_COMPUTA',
  'TARDE_INJUSTIFICADA',
  'TARDE_JUSTIFICADA',
  'DIA_NO_HABIL'
);

-- Step 2: add the column, nullable for the backfill step
ALTER TABLE "attendance_types" ADD COLUMN "behavior" "AttendanceBehavior";

-- Step 3: backfill system types by fixed code map (REQ-P1-3, REQ-P1-4)
UPDATE "attendance_types"
   SET "behavior" = 'NO_COMPUTA'
 WHERE "isSystem" = true AND "code" = 'P';

UPDATE "attendance_types"
   SET "behavior" = 'NO_ELEGIBLE'
 WHERE "isSystem" = true AND "code" IN ('SAB', 'DOM', 'X');

-- Step 4: backfill custom (non-system) types heuristically from
-- (assignable, absenceValue) — Riesgo A, no automated test covers real prod
-- data shape. Tardes (behavior 5/6) are not derivable from this heuristic;
-- admins must manually reclassify those rows after the migration.
UPDATE "attendance_types"
   SET "behavior" = 'NO_ELEGIBLE'
 WHERE "behavior" IS NULL AND "assignable" = false;

UPDATE "attendance_types"
   SET "behavior" = 'NO_COMPUTA'
 WHERE "behavior" IS NULL AND "assignable" = true AND "absenceValue" = 0;

UPDATE "attendance_types"
   SET "behavior" = 'AUSENTE_JUSTIFICADO'
 WHERE "behavior" IS NULL AND "assignable" = true AND "absenceValue" > 0 AND "absenceValue" < 1;

UPDATE "attendance_types"
   SET "behavior" = 'AUSENTE_INJUSTIFICADO'
 WHERE "behavior" IS NULL AND "assignable" = true AND "absenceValue" >= 1;

-- Fallback safety net: any row that somehow still has no behavior after the
-- rules above gets the most conservative classification (design §Riesgo A).
UPDATE "attendance_types"
   SET "behavior" = 'NO_COMPUTA'
 WHERE "behavior" IS NULL;

-- Step 5: enforce NOT NULL now that every row has a value (AC-P1-10)
ALTER TABLE "attendance_types" ALTER COLUMN "behavior" SET NOT NULL;
