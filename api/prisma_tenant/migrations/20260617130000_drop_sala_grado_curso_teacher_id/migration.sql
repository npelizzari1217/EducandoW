-- Migration: drop_sala_grado_curso_teacher_id
-- S3b-1 (retiro de Teacher): Sala/Grado/Curso.teacher_id eran vínculos legacy primitivos
-- (UUID crudo, sin lookup de nombre, sin consumidores aguas abajo tras S2). Curso.teacher_id
-- es columna FANTASMA (ningún código la lee/escribe). No mapean al modelo de ciclos
-- (AsignacionCursoXCiclo es cycle-scoped; Sala/Grado son year-scoped) → drop sin migración de datos.
-- FK ya era SetNull → cero riesgo de integridad. La tabla "teachers" PERMANECE.
-- PÉRDIDA DE DATOS ACEPTADA (R1): teacher_id no-null en salas/grados se pierde de forma permanente.
-- Reversibilidad (DDL autocontenido — la estructura, NO la data):
--   ALTER TABLE "salas"  ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "salas"  ADD CONSTRAINT "salas_teacher_id_fkey"  FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "salas_teacher_id_idx"  ON "salas"("teacher_id");
--   ALTER TABLE "grados" ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "grados" ADD CONSTRAINT "grados_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "grados_teacher_id_idx" ON "grados"("teacher_id");
--   ALTER TABLE "cursos" ADD COLUMN "teacher_id" TEXT;
--   ALTER TABLE "cursos" ADD CONSTRAINT "cursos_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
--   (NOTA: cursos NO tenía índice en teacher_id — no recrear.)

-- DropForeignKey
ALTER TABLE "salas"  DROP CONSTRAINT IF EXISTS "salas_teacher_id_fkey";
ALTER TABLE "grados" DROP CONSTRAINT IF EXISTS "grados_teacher_id_fkey";
ALTER TABLE "cursos" DROP CONSTRAINT IF EXISTS "cursos_teacher_id_fkey";

-- DropIndex (cursos NO tiene índice en teacher_id)
DROP INDEX IF EXISTS "salas_teacher_id_idx";
DROP INDEX IF EXISTS "grados_teacher_id_idx";

-- DropColumn
ALTER TABLE "salas"  DROP COLUMN IF EXISTS "teacher_id";
ALTER TABLE "grados" DROP COLUMN IF EXISTS "teacher_id";
ALTER TABLE "cursos" DROP COLUMN IF EXISTS "teacher_id";
