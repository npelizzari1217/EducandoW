-- Migration: add esOptativa flag to study_plan_subjects (optativa-plan-level).
-- Plan-level optativa designation; flows into MateriaXCursoXCiclo at materialization.
-- No backfill — existing rows default to false (obligatoria).
ALTER TABLE "study_plan_subjects" ADD COLUMN "es_optativa" BOOLEAN NOT NULL DEFAULT false;
