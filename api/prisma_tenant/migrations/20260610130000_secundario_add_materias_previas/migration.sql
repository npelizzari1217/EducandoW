-- Migration: 20260610130000_secundario_add_materias_previas
-- Change:   grading-secundario (Fase 4, Etapa 2) — D2, D5
-- Creates the materias_previas table + MateriaPreviaStatus enum.
-- Independent migration (separate from PR1 / 20260610120000) for isolated rollback.
-- Rollback: DROP TABLE "materias_previas"; DROP TYPE "MateriaPreviaStatus";

-- MateriaPreviaStatus enum: resolution state for a materia previa record.
CREATE TYPE "MateriaPreviaStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'LIBRE');

-- materias_previas table: one row per (student, subject, origin academic year).
-- Tenant-scoped via student_id → students (tenant DB is dedicated to one institution).
-- condicion uses the existing SubjectFinalGradeCondicion enum (PREVIA | LIBRE only in practice;
-- domain layer enforces REGULAR is never stored here — see D2).
CREATE TABLE "materias_previas" (
    "id"                      TEXT        NOT NULL,
    "student_id"              TEXT        NOT NULL,
    "subject_id"              TEXT        NOT NULL,
    "origin_academic_year"    TEXT        NOT NULL,
    "origin_course_cycle_id"  TEXT,
    "condicion"               "SubjectFinalGradeCondicion" NOT NULL,
    "status"                  "MateriaPreviaStatus"        NOT NULL DEFAULT 'PENDIENTE',
    "resolved_grade_code"     TEXT,
    "resolved_at"             TIMESTAMP(3),
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materias_previas_pkey" PRIMARY KEY ("id")
);

-- Unique key: one debt record per (student, subject, academic year)
CREATE UNIQUE INDEX "materias_previas_student_id_subject_id_origin_academic_year_key"
    ON "materias_previas"("student_id", "subject_id", "origin_academic_year");

-- Indexes for the repository query patterns (D2)
CREATE INDEX "materias_previas_student_id_idx"
    ON "materias_previas"("student_id");

CREATE INDEX "materias_previas_student_id_origin_academic_year_idx"
    ON "materias_previas"("student_id", "origin_academic_year");

-- Foreign keys
ALTER TABLE "materias_previas"
    ADD CONSTRAINT "materias_previas_student_id_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "materias_previas"
    ADD CONSTRAINT "materias_previas_subject_id_fkey"
    FOREIGN KEY ("subject_id")
    REFERENCES "subjects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- originCourseCycleId → course_cycles.uuid (optional, SetNull on CC delete)
ALTER TABLE "materias_previas"
    ADD CONSTRAINT "materias_previas_origin_course_cycle_id_fkey"
    FOREIGN KEY ("origin_course_cycle_id")
    REFERENCES "course_cycles"("uuid")
    ON DELETE SET NULL ON UPDATE CASCADE;
