-- Migration: add_alumnos_x_curso_x_ciclo
-- SDD-1 — New bridge entity: AlumnosXCursoXCiclo
-- Authoritative universe of students enrolled in a CourseCycle, one row per (courseCycle, student).
-- `printable`: gate for boletín generation (SDD-2). DORMANT in SDD-1: always false on insert.
-- Both FKs use ON DELETE RESTRICT (owner ADR #1243):
--   - Deleting a CourseCycle with enrolled students MUST fail → desinscribir first.
--   - Deleting a Student with active enrollments MUST fail → remove from cycle first.
-- Reversible: DROP TABLE "alumnos_x_curso_x_ciclo";

CREATE TABLE "alumnos_x_curso_x_ciclo" (
    "id"              TEXT        NOT NULL,
    "course_cycle_id" TEXT        NOT NULL,
    "student_id"      TEXT        NOT NULL,
    "printable"       BOOLEAN     NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "alumnos_x_curso_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alumnos_x_curso_x_ciclo_course_cycle_id_fkey"
        FOREIGN KEY ("course_cycle_id")
        REFERENCES "course_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "alumnos_x_curso_x_ciclo_student_id_fkey"
        FOREIGN KEY ("student_id")
        REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- One enrollment per (courseCycle, student) — unique constraint matches @@unique in schema
CREATE UNIQUE INDEX "alumnos_x_curso_x_ciclo_curso_student_key"
    ON "alumnos_x_curso_x_ciclo"("course_cycle_id", "student_id");

CREATE INDEX "alumnos_x_curso_x_ciclo_course_cycle_id_idx"
    ON "alumnos_x_curso_x_ciclo"("course_cycle_id");
