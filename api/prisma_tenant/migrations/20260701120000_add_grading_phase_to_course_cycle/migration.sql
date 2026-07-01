-- Migration: 20260701120000_add_grading_phase_to_course_cycle
-- Adds the GradingPhase enum and a nullable grading_phase column to
-- course_cycles.
--
-- Safe / backward-compatible:
--   - Column is nullable → existing rows (and Inicial/Terciario CCs, which
--     never use this field) get NULL naturally (no active phase / cutover).
--   - No backfill, no DEFAULT required.
--   - Legacy `active_grading_period` column is left untouched — no reader
--     of the new path consumes it.
--   - Rollback: DROP COLUMN "grading_phase"; DROP TYPE "GradingPhase";
--
-- Part of fase-bimestre-cierre-asistencia (PR-1).

CREATE TYPE "GradingPhase" AS ENUM ('BIM_1', 'BIM_2', 'BIM_3', 'BIM_4', 'CIERRE');

ALTER TABLE "course_cycles" ADD COLUMN "grading_phase" "GradingPhase";
