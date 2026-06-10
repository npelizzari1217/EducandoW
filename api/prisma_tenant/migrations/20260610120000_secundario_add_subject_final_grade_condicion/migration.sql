-- Migration: 20260610120000_secundario_add_subject_final_grade_condicion
-- Adds the SubjectFinalGradeCondicion enum and a nullable condicion column
-- to the subject_final_grades table.
--
-- Safe / backward-compatible:
--   - Column is nullable → existing Primario rows get NULL naturally (COND-R4, COND-S8).
--   - No backfill, no DEFAULT required.
--   - Rollback: DROP COLUMN "condicion"; DROP TYPE "SubjectFinalGradeCondicion";
--
-- Part of grading-secundario (Fase 4, Etapa 2) — D5, COND-R1.

CREATE TYPE "SubjectFinalGradeCondicion" AS ENUM ('REGULAR', 'PREVIA', 'LIBRE');

ALTER TABLE "subject_final_grades" ADD COLUMN "condicion" "SubjectFinalGradeCondicion";
