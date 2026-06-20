-- Migration: asistencia_mensual_replace_diaria (SDD-4 PR-1)
-- Adds two monthly attendance tables and drops the legacy daily-grain tables.
-- DB regeneration context — no data migration required (owner confirmed).
-- Applied in PR-2 (T-22) when Docker+Postgres :5433 is available.

-- ── New: general monthly attendance (course-cycle grain) ─────────────────────
CREATE TABLE "asistencia_x_alumno_x_curso_x_ciclo" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "course_cycle_id" TEXT NOT NULL,
  "student_id"      TEXT NOT NULL,
  "year"            INTEGER NOT NULL,
  "month"           INTEGER NOT NULL,
  "days"            JSONB NOT NULL DEFAULT '{}',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asistencia_x_alumno_x_curso_x_ciclo_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per (course_cycle, student, year, month)
CREATE UNIQUE INDEX "asistencia_alumno_cc_year_month_key"
  ON "asistencia_x_alumno_x_curso_x_ciclo"("course_cycle_id", "student_id", "year", "month");

-- Query index: list all students for a given CC+month
CREATE INDEX "asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_month_idx"
  ON "asistencia_x_alumno_x_curso_x_ciclo"("course_cycle_id", "year", "month");

-- FK → CourseCycle (Restrict: can't delete a CC with a materialized register)
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo"
  ADD CONSTRAINT "asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_fkey"
  FOREIGN KEY ("course_cycle_id") REFERENCES "course_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK → Student (Cascade: deleted student's attendance is meaningless)
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo"
  ADD CONSTRAINT "asistencia_x_alumno_x_curso_x_ciclo_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── New: subject monthly attendance (materia grain) ───────────────────────────
CREATE TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" (
  "id"                       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "materia_x_curso_x_ciclo_id" TEXT NOT NULL,
  "student_id"               TEXT NOT NULL,
  "year"                     INTEGER NOT NULL,
  "month"                    INTEGER NOT NULL,
  "days"                     JSONB NOT NULL DEFAULT '{}',
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asistencia_x_materia_x_alumno_x_curso_x_ciclo_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one row per (materia, student, year, month)
CREATE UNIQUE INDEX "asistencia_materia_alumno_year_month_key"
  ON "asistencia_x_materia_x_alumno_x_curso_x_ciclo"("materia_x_curso_x_ciclo_id", "student_id", "year", "month");

-- Query index: list all students for a given materia+month
CREATE INDEX "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_year_month_idx"
  ON "asistencia_x_materia_x_alumno_x_curso_x_ciclo"("materia_x_curso_x_ciclo_id", "year", "month");

-- FK → MateriaXCursoXCiclo (Cascade: deleting a materia removes its attendance)
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo"
  ADD CONSTRAINT "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_fkey"
  FOREIGN KEY ("materia_x_curso_x_ciclo_id") REFERENCES "materias_x_curso_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK → Student (Cascade)
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo"
  ADD CONSTRAINT "asistencia_x_materia_x_alumno_x_curso_x_ciclo_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NOTE: the legacy daily tables (asistencia_diaria, ausencias_x_grupo) are dropped
-- in a SEPARATE migration in PR-3, atomically with removing their Prisma models and
-- TS consumers — keeping schema/DB/code in sync at every slice.
