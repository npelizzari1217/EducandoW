-- CreateTable
CREATE TABLE "llamados_examen" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "anio_academico" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llamados_examen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llamados_examen_anio_academico_idx" ON "llamados_examen"("anio_academico");

-- CreateIndex
CREATE INDEX "llamados_examen_fecha_inicio_idx" ON "llamados_examen"("fecha_inicio");
