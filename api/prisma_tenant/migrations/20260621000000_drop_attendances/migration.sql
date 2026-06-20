-- Migration: drop_attendances (SDD-5 PR-2, T-13)
-- Drops the legacy attendances table now that the boletín has been repointed
-- to asistenciaXAlumnoXCursoXCiclo (SDD-5 PR-1) and all code references removed.
-- Safe to re-run: IF EXISTS guard against double-application.

DROP TABLE IF EXISTS "attendances";
