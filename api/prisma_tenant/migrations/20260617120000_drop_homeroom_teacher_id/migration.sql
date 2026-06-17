-- Migration: drop_homeroom_teacher_id
-- S3b-0 (retiro de Teacher): CourseCycle.homeroomTeacherId quedó sin lectores
-- funcionales tras S3a (nav homeroom migrada a AsignacionCursoXCiclo rol=TITULAR, Fase 4).
-- Drop del FK → teachers.id (SetNull), su índice, y la columna.
-- PRECONDICIÓN: backfill Fase 4 TITULAR completo en todos los tenants (data ya en
--   AsignacionCursoXCiclo). CCs skippeados pierden la data de esta columna de forma permanente.
-- Reversibilidad (DDL autocontenido — la estructura, NO la data; la data vive en
--   AsignacionCursoXCiclo(TITULAR)):
--   ALTER TABLE "course_cycles" ADD COLUMN "homeroom_teacher_id" TEXT;
--   ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_homeroom_teacher_id_fkey"
--     FOREIGN KEY ("homeroom_teacher_id") REFERENCES "teachers"("id")
--     ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "course_cycles_homeroom_teacher_id_idx" ON "course_cycles"("homeroom_teacher_id");

-- DropForeignKey
ALTER TABLE "course_cycles" DROP CONSTRAINT IF EXISTS "course_cycles_homeroom_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "course_cycles_homeroom_teacher_id_idx";

-- DropColumn
ALTER TABLE "course_cycles" DROP COLUMN IF EXISTS "homeroom_teacher_id";
