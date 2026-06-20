-- Migration: drop_legacy_daily_attendance (SDD-4 PR-3, T-30)
-- Drops the legacy daily attendance tables (asistencia_diaria, ausencias_x_grupo)
-- that were replaced by the monthly register in PR-1.
-- Applied atomically with deleting their TS consumers and Prisma models (T-30).
-- Safe to re-run: IF EXISTS guards against double-application.

DROP TABLE IF EXISTS "asistencia_diaria";
DROP TABLE IF EXISTS "ausencias_x_grupo";
