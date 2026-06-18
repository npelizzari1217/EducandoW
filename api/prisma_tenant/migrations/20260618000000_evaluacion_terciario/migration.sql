-- Migration: evaluacion-terciario
-- Change: Add nota_cursada_terciario table, add intento to acta_examen_notas

-- 1. CREATE TABLE nota_cursada_terciario
CREATE TABLE "nota_cursada_terciario" (
    "id" TEXT NOT NULL,
    "inscripcion_materia_id" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "nota" DOUBLE PRECISION,
    "condicion" TEXT NOT NULL,
    "fecha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nota_cursada_terciario_pkey" PRIMARY KEY ("id")
);

-- 2. Add intento column to acta_examen_notas with DEFAULT 1 (backfills existing rows atomically)
ALTER TABLE "acta_examen_notas" ADD COLUMN "intento" INTEGER NOT NULL DEFAULT 1;

-- 3. Safety net idempotent backfill (no-op if already migrated — NOT NULL constraint means WHERE IS NULL matches 0 rows)
UPDATE "acta_examen_notas" SET "intento" = 1 WHERE "intento" IS NULL;

-- 4. Unique constraint and index on nota_cursada_terciario
CREATE UNIQUE INDEX "nota_cursada_terciario_inscripcion_materia_id_slot_key"
    ON "nota_cursada_terciario"("inscripcion_materia_id", "slot");

CREATE INDEX "nota_cursada_terciario_inscripcion_materia_id_idx"
    ON "nota_cursada_terciario"("inscripcion_materia_id");

-- 5. Foreign key from nota_cursada_terciario to inscripciones_materia
ALTER TABLE "nota_cursada_terciario"
    ADD CONSTRAINT "nota_cursada_terciario_inscripcion_materia_id_fkey"
    FOREIGN KEY ("inscripcion_materia_id")
    REFERENCES "inscripciones_materia"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
