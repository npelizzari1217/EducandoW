CREATE TABLE "docentes_x_materia_carrera" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "materia_carrera_id" TEXT NOT NULL,
  "anio_academico" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "docentes_x_materia_carrera_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dxmc_user_materia_anio_key"
  ON "docentes_x_materia_carrera"("user_id","materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_materia_anio_idx"
  ON "docentes_x_materia_carrera"("materia_carrera_id","anio_academico");
CREATE INDEX "dxmc_user_idx"
  ON "docentes_x_materia_carrera"("user_id");
ALTER TABLE "docentes_x_materia_carrera"
  ADD CONSTRAINT "dxmc_materia_carrera_fkey"
  FOREIGN KEY ("materia_carrera_id") REFERENCES "materias_carrera"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
