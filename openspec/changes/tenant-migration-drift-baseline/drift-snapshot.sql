-- DropIndex
DROP INDEX "competency_valuations_studentId_competencyId_key";

-- AlterTable
ALTER TABLE "alumnos_x_curso_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "asignaciones_curso_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "asistencia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "docentes_x_ciclo" ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "materias_x_curso_x_ciclo" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "planificaciones_curso" ALTER COLUMN "deleted_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- RenameForeignKey
ALTER TABLE "alumnos_x_grupo_x_curso_x_materia_x_ciclo" RENAME CONSTRAINT "axgxcxmxc_alumno_materia_fkey" TO "alumnos_x_grupo_x_curso_x_materia_x_ciclo_alumnos_x_materi_fkey";

-- RenameForeignKey
ALTER TABLE "alumnos_x_materia_x_curso_x_ciclo" RENAME CONSTRAINT "alumnos_x_materia_x_curso_x_ciclo_materia_fkey" TO "alumnos_x_materia_x_curso_x_ciclo_materia_x_curso_x_ciclo__fkey";

-- RenameForeignKey
ALTER TABLE "asignaciones_curso_x_ciclo" RENAME CONSTRAINT "asignaciones_curso_x_ciclo_course_cycle_fkey" TO "asignaciones_curso_x_ciclo_course_cycle_id_fkey";

-- RenameForeignKey
ALTER TABLE "asignaciones_curso_x_ciclo" RENAME CONSTRAINT "asignaciones_curso_x_ciclo_docente_x_ciclo_fkey" TO "asignaciones_curso_x_ciclo_docente_x_ciclo_id_fkey";

-- RenameForeignKey
ALTER TABLE "asistencia_x_materia_x_alumno_x_curso_x_ciclo" RENAME CONSTRAINT "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_fkey" TO "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_x_cu_fkey";

-- RenameForeignKey
ALTER TABLE "docentes_x_materia_carrera" RENAME CONSTRAINT "dxmc_materia_carrera_fkey" TO "docentes_x_materia_carrera_materia_carrera_id_fkey";

-- RenameForeignKey
ALTER TABLE "grupos_x_curso_x_materia_x_ciclo" RENAME CONSTRAINT "grupos_x_curso_x_materia_x_ciclo_materia_fkey" TO "grupos_x_curso_x_materia_x_ciclo_materia_x_curso_x_ciclo_i_fkey";

-- RenameIndex
ALTER INDEX "axgxcxmxc_alumno_materia_idx" RENAME TO "alumnos_x_grupo_x_curso_x_materia_x_ciclo_alumnos_x_materia_idx";

-- RenameIndex
ALTER INDEX "alumnos_x_materia_x_curso_x_ciclo_materia_idx" RENAME TO "alumnos_x_materia_x_curso_x_ciclo_materia_x_curso_x_ciclo_i_idx";

-- RenameIndex
ALTER INDEX "asignaciones_curso_x_ciclo_cc_dxc_rol_turno_key" RENAME TO "asignaciones_curso_x_ciclo_course_cycle_id_docente_x_ciclo__key";

-- RenameIndex
ALTER INDEX "asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_month_" RENAME TO "asistencia_x_alumno_x_curso_x_ciclo_course_cycle_id_year_mo_idx";

-- RenameIndex
ALTER INDEX "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_year_mont" RENAME TO "asistencia_x_materia_x_alumno_x_curso_x_ciclo_materia_x_cur_idx";

-- RenameIndex
ALTER INDEX "competency_valuations_studentId_competencyId_course_cycle_id_ke" RENAME TO "competency_valuations_studentId_competencyId_course_cycle_i_key";

-- RenameIndex
ALTER INDEX "dxmc_materia_anio_idx" RENAME TO "docentes_x_materia_carrera_materia_carrera_id_anio_academic_idx";

-- RenameIndex
ALTER INDEX "dxmc_user_idx" RENAME TO "docentes_x_materia_carrera_user_id_idx";

-- RenameIndex
ALTER INDEX "dxmc_user_materia_anio_key" RENAME TO "docentes_x_materia_carrera_user_id_materia_carrera_id_anio__key";

-- RenameIndex
ALTER INDEX "grupos_x_curso_x_materia_x_ciclo_materia_idx" RENAME TO "grupos_x_curso_x_materia_x_ciclo_materia_x_curso_x_ciclo_id_idx";

-- RenameIndex
ALTER INDEX "subject_final_grades_student_id_course_cycle_id_subject_id_type" RENAME TO "subject_final_grades_student_id_course_cycle_id_subject_id__key";

-- RenameIndex
ALTER INDEX "subject_grading_periods_course_cycle_id_subject_id_period_ordin" RENAME TO "subject_grading_periods_course_cycle_id_subject_id_period_o_key";

-- RenameIndex
ALTER INDEX "subject_period_grades_student_id_course_cycle_id_subject_id_per" RENAME TO "subject_period_grades_student_id_course_cycle_id_subject_id_key";

