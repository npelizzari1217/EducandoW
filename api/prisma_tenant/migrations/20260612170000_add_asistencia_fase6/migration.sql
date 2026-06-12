-- Migration: Fase 6 — Asistencia (ausencias por materia + asistencia diaria)
-- F6-S2: AusenciaXGrupo
-- F6-S3: AsistenciaDiaria

-- ── AusenciaXGrupo (subject-level absence per group) ─────────────────────────
CREATE TABLE "ausencias_x_grupo" (
    "id"             TEXT    NOT NULL,
    "grupo_id"       TEXT    NOT NULL,
    "student_id"     TEXT    NOT NULL,
    "date"           DATE    NOT NULL,
    "observaciones"  TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ausencias_x_grupo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ausencias_x_grupo_grupo_id_student_id_date_key"
    ON "ausencias_x_grupo"("grupo_id", "student_id", "date");

CREATE INDEX "ausencias_x_grupo_grupo_id_date_idx"
    ON "ausencias_x_grupo"("grupo_id", "date");

CREATE INDEX "ausencias_x_grupo_student_id_idx"
    ON "ausencias_x_grupo"("student_id");

ALTER TABLE "ausencias_x_grupo"
    ADD CONSTRAINT "ausencias_x_grupo_grupo_id_fkey"
    FOREIGN KEY ("grupo_id") REFERENCES "grupos_x_curso_x_materia_x_ciclo"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ausencias_x_grupo"
    ADD CONSTRAINT "ausencias_x_grupo_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AsistenciaDiaria (daily attendance per CourseCycle) ──────────────────────
CREATE TABLE "asistencia_diaria" (
    "id"              TEXT    NOT NULL,
    "course_cycle_id" TEXT    NOT NULL,
    "student_id"      TEXT    NOT NULL,
    "date"            DATE    NOT NULL,
    "status_code"     TEXT    NOT NULL,
    "observaciones"   TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistencia_diaria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asistencia_diaria_course_cycle_id_student_id_date_key"
    ON "asistencia_diaria"("course_cycle_id", "student_id", "date");

CREATE INDEX "asistencia_diaria_course_cycle_id_date_idx"
    ON "asistencia_diaria"("course_cycle_id", "date");

CREATE INDEX "asistencia_diaria_student_id_idx"
    ON "asistencia_diaria"("student_id");

ALTER TABLE "asistencia_diaria"
    ADD CONSTRAINT "asistencia_diaria_course_cycle_id_fkey"
    FOREIGN KEY ("course_cycle_id") REFERENCES "course_cycles"("uuid")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asistencia_diaria"
    ADD CONSTRAINT "asistencia_diaria_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
