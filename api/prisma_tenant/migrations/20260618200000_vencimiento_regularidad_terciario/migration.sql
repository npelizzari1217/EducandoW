-- Migration: vencimiento-regularidad-terciario
-- Non-breaking: both columns have defaults / are nullable.
-- Existing rows get: fechaRegularidad = NULL, llamadosVencimiento = 5.

-- InscripcionMateria: add optional fechaRegularidad (nullable — FR-1.2, NFR-6)
ALTER TABLE "inscripciones_materia" ADD COLUMN "fecha_regularidad" TIMESTAMP(3);

-- Carrera: add llamadosVencimiento with default 5 (FR-3.2, NFR-6)
ALTER TABLE "carreras" ADD COLUMN "llamados_vencimiento" INTEGER NOT NULL DEFAULT 5;
