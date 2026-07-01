-- Migration: 20260701130000_add_attendance_month_status
-- Adds the AttendanceMonthState enum and the attendance_month_status table
-- (Capacidad B — cierre mensual de asistencia).
--
-- Safe / backward-compatible:
--   - No existing table/column is modified. New table only.
--   - Absence of a row for a (course_cycle_id, year, month) means OPEN by
--     convention (no cutover, no backfill needed — design §B1).
--   - onDelete Restrict on course_cycle_id: a CourseCycle with attendance
--     month statuses cannot be hard-deleted (mirrors asistencia_x_alumno_x_curso_x_ciclo).
--   - Rollback: DROP TABLE "attendance_month_status"; DROP TYPE "AttendanceMonthState";
--
-- ORTOGONAL a GradingPhase (Capacidad A, migración 20260701120000) — tabla
-- completamente separada, sin FK ni lectura cruzada.
--
-- Part of fase-bimestre-cierre-asistencia (PR-3b).

CREATE TYPE "AttendanceMonthState" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "attendance_month_status" (
    "id" TEXT NOT NULL,
    "course_cycle_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "AttendanceMonthState" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_month_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_month_status_cc_year_month_key" ON "attendance_month_status"("course_cycle_id", "year", "month");

CREATE INDEX "attendance_month_status_course_cycle_id_year_month_idx" ON "attendance_month_status"("course_cycle_id", "year", "month");

ALTER TABLE "attendance_month_status" ADD CONSTRAINT "attendance_month_status_course_cycle_id_fkey" FOREIGN KEY ("course_cycle_id") REFERENCES "course_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
