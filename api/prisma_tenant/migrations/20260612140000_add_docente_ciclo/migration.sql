-- Migration: add_docente_ciclo
-- Fase 2 — DocenteXCiclo (docentes_x_ciclo)
-- Reversible: DROP TABLE docentes_x_ciclo;

CREATE TABLE "docentes_x_ciclo" (
    "id"         TEXT        NOT NULL,
    "user_id"    TEXT        NOT NULL,
    "cycle_id"   TEXT        NOT NULL,
    "active"     BOOLEAN     NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "docentes_x_ciclo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "docentes_x_ciclo_cycle_id_fkey"
        FOREIGN KEY ("cycle_id") REFERENCES "academic_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Unique constraint: one DocenteXCiclo per (user, cycle)
CREATE UNIQUE INDEX "docentes_x_ciclo_user_id_cycle_id_key"
    ON "docentes_x_ciclo"("user_id", "cycle_id");

-- Supporting indices
CREATE INDEX "docentes_x_ciclo_cycle_id_idx" ON "docentes_x_ciclo"("cycle_id");
CREATE INDEX "docentes_x_ciclo_user_id_idx"  ON "docentes_x_ciclo"("user_id");
