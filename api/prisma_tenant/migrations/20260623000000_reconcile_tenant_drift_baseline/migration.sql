-- DropIndex: stranded broken 2-col unique (left behind by 20260608201000;
-- 20260608210000 tried DROP CONSTRAINT IF EXISTS which silently no-oped on an index).
-- The superseding 3-col unique (competency_valuations_studentId_competencyId_course_cycle_i_key)
-- is already correctly enforced. Dropping this is a correctness fix (CV-R9 / ADR-3).
DROP INDEX "competency_valuations_studentId_competencyId_key";

-- updated_at DROP DEFAULT (8): @updatedAt sets it client-side on every write;
-- the DB-level DEFAULT NOW() is unreachable (MI-11 / ADR-2).
ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "planificaciones_curso" ALTER COLUMN "updated_at" DROP DEFAULT;

-- asistencia id DROP DEFAULT (2): schema uses @default(uuid()) (client-side);
-- DB carries (gen_random_uuid())::text. Prisma always passes id in INSERT (MI-11 / ADR-2).
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;
