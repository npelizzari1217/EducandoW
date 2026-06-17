-- Migration: drop_homeroom_teacher_id
-- S3b-0 (retiro de Teacher): CourseCycle.homeroomTeacherId quedó sin lectores
-- funcionales tras S3a (nav homeroom migrada a AsignacionCursoXCiclo rol=TITULAR, Fase 4).
-- Drop del FK → teachers.id (SetNull), su índice, y la columna.
-- PRECONDICIÓN: backfill Fase 4 TITULAR completo en todos los tenants (data ya en
--   AsignacionCursoXCiclo). CCs skippeados pierden la data de esta columna de forma permanente.
-- Reversibilidad: re-crear vía ALTER TABLE ADD COLUMN + ADD CONSTRAINT + CREATE INDEX
--   (ver 20260609140000_grading_primario_add_teacher_user_and_homeroom). La DATA no es
--   recuperable desde aquí — vive en AsignacionCursoXCiclo(TITULAR).

-- DropForeignKey
ALTER TABLE "course_cycles" DROP CONSTRAINT IF EXISTS "course_cycles_homeroom_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "course_cycles_homeroom_teacher_id_idx";

-- DropColumn
ALTER TABLE "course_cycles" DROP COLUMN IF EXISTS "homeroom_teacher_id";
