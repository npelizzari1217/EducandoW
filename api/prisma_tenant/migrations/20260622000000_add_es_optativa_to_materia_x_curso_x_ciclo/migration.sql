-- Migration: add esOptativa flag to materias_x_curso_x_ciclo
-- MGC-R7 (optativas-inscripcion). No backfill — existing rows default to false (obligatoria).
ALTER TABLE "materias_x_curso_x_ciclo" ADD COLUMN "es_optativa" BOOLEAN NOT NULL DEFAULT false;
