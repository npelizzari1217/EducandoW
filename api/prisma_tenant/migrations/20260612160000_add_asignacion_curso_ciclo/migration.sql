-- Migration: add_asignacion_curso_ciclo
-- Fase 4 — AsignacionCursoXCiclo: DocenteXCiclo assignment at the CursoXCiclo level.
-- Enums: RolCurso (PRECEPTOR, TITULAR), TurnoCurso (MANANA, TARDE, VESPERTINO, NOCHE).
-- D2: turno is optional and informational — no uniqueness constraint on it alone.
-- Reversible: DROP TABLE asignaciones_curso_x_ciclo; DROP TYPE "RolCurso"; DROP TYPE "TurnoCurso";

-- ── 1. Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "RolCurso" AS ENUM ('PRECEPTOR', 'TITULAR');
CREATE TYPE "TurnoCurso" AS ENUM ('MANANA', 'TARDE', 'VESPERTINO', 'NOCHE');

-- ── 2. AsignacionCursoXCiclo ───────────────────────────────────────────────────
-- One assignment per (courseCycle, docenteXCiclo, rol, turno) tuple.
-- turno nullable: TITULAR assignments carry NULL; multiple PRECEPTORs per turno allowed (D2).
-- FK to course_cycles ON DELETE CASCADE: removing a CC removes all its assignments.
-- FK to docentes_x_ciclo ON DELETE CASCADE: removing a DocenteXCiclo removes assignments.

CREATE TABLE "asignaciones_curso_x_ciclo" (
    "id"                 TEXT        NOT NULL,
    "course_cycle_id"    TEXT        NOT NULL,
    "docente_x_ciclo_id" TEXT        NOT NULL,
    "rol"                "RolCurso"  NOT NULL,
    "turno"              "TurnoCurso",
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "asignaciones_curso_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asignaciones_curso_x_ciclo_course_cycle_fkey"
        FOREIGN KEY ("course_cycle_id")
        REFERENCES "course_cycles"("uuid") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "asignaciones_curso_x_ciclo_docente_x_ciclo_fkey"
        FOREIGN KEY ("docente_x_ciclo_id")
        REFERENCES "docentes_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique per (courseCycle, docenteXCiclo, rol, turno).
-- NULLS NOT DISTINCT (Postgres 15+): two rows with turno=NULL and same other fields ARE
-- considered duplicates. This prevents a docente from being TITULAR+null twice in the same CC.
-- Application layer additionally enforces at-most-one TITULAR per CC (ACC-S5 replace semantics).
CREATE UNIQUE INDEX "asignaciones_curso_x_ciclo_cc_dxc_rol_turno_key"
    ON "asignaciones_curso_x_ciclo"("course_cycle_id", "docente_x_ciclo_id", "rol", "turno")
    NULLS NOT DISTINCT;

CREATE INDEX "asignaciones_curso_x_ciclo_course_cycle_id_idx"
    ON "asignaciones_curso_x_ciclo"("course_cycle_id");

CREATE INDEX "asignaciones_curso_x_ciclo_docente_x_ciclo_id_idx"
    ON "asignaciones_curso_x_ciclo"("docente_x_ciclo_id");
