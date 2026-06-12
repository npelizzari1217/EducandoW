-- Migration: add_materia_grupo_ciclo
-- Fase 3a — 4 new entities: MateriaXCursoXCiclo, AlumnosXMateriaXCursoXCiclo,
--           GrupoXCursoXMateriaXCiclo, AlumnosXGrupoXCursoXMateriaXCiclo
-- Reversible: DROP TABLE alumnos_x_grupo_x_curso_x_materia_x_ciclo,
--                        grupos_x_curso_x_materia_x_ciclo,
--                        alumnos_x_materia_x_curso_x_ciclo,
--                        materias_x_curso_x_ciclo;

-- ── 1. MateriaXCursoXCiclo ─────────────────────────────────────────────────
-- One row per (CourseCycle, Subject). Created when a user "Genera" a CourseCycle.
-- studyPlanSubjectId: soft provenance link to the StudyPlanSubject (no FK constraint).

CREATE TABLE "materias_x_curso_x_ciclo" (
    "id"                    TEXT        NOT NULL,
    "course_cycle_id"       TEXT        NOT NULL,
    "subject_id"            TEXT        NOT NULL,
    "study_plan_subject_id" TEXT,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "materias_x_curso_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "materias_x_curso_x_ciclo_course_cycle_id_fkey"
        FOREIGN KEY ("course_cycle_id")
        REFERENCES "course_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "materias_x_curso_x_ciclo_subject_id_fkey"
        FOREIGN KEY ("subject_id")
        REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- One materia per (course_cycle, subject) — idempotent via skipDuplicates on upsert
CREATE UNIQUE INDEX "materias_x_curso_x_ciclo_course_cycle_id_subject_id_key"
    ON "materias_x_curso_x_ciclo"("course_cycle_id", "subject_id");

CREATE INDEX "materias_x_curso_x_ciclo_course_cycle_id_idx"
    ON "materias_x_curso_x_ciclo"("course_cycle_id");

-- ── 2. AlumnosXMateriaXCursoXCiclo ────────────────────────────────────────
-- Authoritative universe of students enrolled in a subject for a given CourseCycle.
-- Students are added one by one (MGC-R2); bulk endpoint is out of scope.
-- FK to materias_x_curso_x_ciclo (CASCADE): removing the materia removes all its students.

CREATE TABLE "alumnos_x_materia_x_curso_x_ciclo" (
    "id"                          TEXT        NOT NULL,
    "materia_x_curso_x_ciclo_id"  TEXT        NOT NULL,
    "student_id"                  TEXT        NOT NULL,
    "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "alumnos_x_materia_x_curso_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alumnos_x_materia_x_curso_x_ciclo_materia_fkey"
        FOREIGN KEY ("materia_x_curso_x_ciclo_id")
        REFERENCES "materias_x_curso_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alumnos_x_materia_x_curso_x_ciclo_student_id_fkey"
        FOREIGN KEY ("student_id")
        REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One enrollment per (student, materia) — unique constraint matches @@unique in schema
CREATE UNIQUE INDEX "alumnos_x_materia_x_curso_x_ciclo_materia_student_key"
    ON "alumnos_x_materia_x_curso_x_ciclo"("materia_x_curso_x_ciclo_id", "student_id");

CREATE INDEX "alumnos_x_materia_x_curso_x_ciclo_materia_idx"
    ON "alumnos_x_materia_x_curso_x_ciclo"("materia_x_curso_x_ciclo_id");

-- ── 3. GrupoXCursoXMateriaXCiclo ──────────────────────────────────────────
-- One group per (MateriaXCursoXCiclo, DocenteXCiclo).
-- Normal subject: 1 group = all students.
-- Split subject (materia partida): N groups, each with a different DocenteXCiclo.
-- FK to docentes_x_ciclo (RESTRICT): cannot delete a DocenteXCiclo that owns groups.

CREATE TABLE "grupos_x_curso_x_materia_x_ciclo" (
    "id"                          TEXT        NOT NULL,
    "materia_x_curso_x_ciclo_id"  TEXT        NOT NULL,
    "docente_x_ciclo_id"          TEXT        NOT NULL,
    "name"                        TEXT,
    "created_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "grupos_x_curso_x_materia_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "grupos_x_curso_x_materia_x_ciclo_materia_fkey"
        FOREIGN KEY ("materia_x_curso_x_ciclo_id")
        REFERENCES "materias_x_curso_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grupos_x_curso_x_materia_x_ciclo_docente_x_ciclo_id_fkey"
        FOREIGN KEY ("docente_x_ciclo_id")
        REFERENCES "docentes_x_ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- One group per (materia, docente) — unique constraint matches @@unique in schema
CREATE UNIQUE INDEX "grupos_x_curso_x_materia_x_ciclo_materia_docente_key"
    ON "grupos_x_curso_x_materia_x_ciclo"("materia_x_curso_x_ciclo_id", "docente_x_ciclo_id");

CREATE INDEX "grupos_x_curso_x_materia_x_ciclo_materia_idx"
    ON "grupos_x_curso_x_materia_x_ciclo"("materia_x_curso_x_ciclo_id");

CREATE INDEX "grupos_x_curso_x_materia_x_ciclo_docente_x_ciclo_id_idx"
    ON "grupos_x_curso_x_materia_x_ciclo"("docente_x_ciclo_id");

-- ── 4. AlumnosXGrupoXCursoXMateriaXCiclo ──────────────────────────────────
-- Maps a student (via their AlumnosXMateriaXCursoXCiclo membership) into a group.
-- FK to alumnos_x_materia_x_curso_x_ciclo (not directly to students) enforces
-- grupo ⊆ materia ⊆ curso at the DB level (MGC-R4).
-- Overlap is allowed: same alumnoMateria row can appear in multiple groups (co-docencia).

CREATE TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" (
    "id"                               TEXT        NOT NULL,
    "grupo_id"                         TEXT        NOT NULL,
    "alumnos_x_materia_x_curso_x_ciclo_id" TEXT    NOT NULL,
    "created_at"                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "alumnos_x_grupo_x_curso_x_materia_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alumnos_x_grupo_x_curso_x_materia_x_ciclo_grupo_id_fkey"
        FOREIGN KEY ("grupo_id")
        REFERENCES "grupos_x_curso_x_materia_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "axgxcxmxc_alumno_materia_fkey"
        FOREIGN KEY ("alumnos_x_materia_x_curso_x_ciclo_id")
        REFERENCES "alumnos_x_materia_x_curso_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- One membership per (grupo, alumnoMateria) — unique constraint matches @@unique in schema
CREATE UNIQUE INDEX "alumnos_x_grupo_x_materia_x_ciclo_grupo_alumno_key"
    ON "alumnos_x_grupo_x_curso_x_materia_x_ciclo"("grupo_id", "alumnos_x_materia_x_curso_x_ciclo_id");

CREATE INDEX "alumnos_x_grupo_x_curso_x_materia_x_ciclo_grupo_id_idx"
    ON "alumnos_x_grupo_x_curso_x_materia_x_ciclo"("grupo_id");

CREATE INDEX "axgxcxmxc_alumno_materia_idx"
    ON "alumnos_x_grupo_x_curso_x_materia_x_ciclo"("alumnos_x_materia_x_curso_x_ciclo_id");
