-- Migration: add_planificacion_curso

CREATE TABLE "planificaciones_curso" (
    "id"                  TEXT        NOT NULL,
    "asignacion_curso_id" TEXT        NOT NULL,
    "nombre"              TEXT        NOT NULL,
    "period_ordinal"      INTEGER,
    "descripcion"         TEXT,
    "active"              BOOLEAN     NOT NULL DEFAULT true,
    "deleted_at"          TIMESTAMPTZ,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "planificaciones_curso_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "planificaciones_curso_asignacion_curso_id_fkey"
        FOREIGN KEY ("asignacion_curso_id")
        REFERENCES "asignaciones_curso_x_ciclo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "planificaciones_curso_asignacion_curso_id_idx"
    ON "planificaciones_curso"("asignacion_curso_id");
