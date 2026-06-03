-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "GuardianRelationship" AS ENUM ('mother', 'father', 'legal_guardian', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "students" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "motherName" TEXT,
    "fatherDni" TEXT,
    "motherDni" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "userId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "student_guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "is_financial_responsible" BOOLEAN NOT NULL DEFAULT false,
    "is_authorized_to_pick_up" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "teachers" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "academic_cycles" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "first_bim_start" TIMESTAMP(3),
    "first_bim_end" TIMESTAMP(3),
    "second_bim_start" TIMESTAMP(3),
    "second_bim_end" TIMESTAMP(3),
    "third_bim_start" TIMESTAMP(3),
    "third_bim_end" TIMESTAMP(3),
    "fourth_bim_start" TIMESTAMP(3),
    "fourth_bim_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "course_cycles" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passingGrade" DOUBLE PRECISION NOT NULL,
    "promotionText" TEXT,
    "first_bim_start" TIMESTAMP(3),
    "first_bim_end" TIMESTAMP(3),
    "second_bim_start" TIMESTAMP(3),
    "second_bim_end" TIMESTAMP(3),
    "third_bim_start" TIMESTAMP(3),
    "third_bim_end" TIMESTAMP(3),
    "fourth_bim_start" TIMESTAMP(3),
    "fourth_bim_end" TIMESTAMP(3),
    "last_modified_at" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "course_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cycleId" TEXT,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "academicYear" TEXT NOT NULL,
    "grade" TEXT,
    "division" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "course_sections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "division" TEXT,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "academicYear" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "subject_assignments" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "courseSectionId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "grade_scales" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "isConceptual" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "grade_scale_values" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "isApproved" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_scale_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "evaluaciones" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notas" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "qualitativeValue" TEXT,
    "comments" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gradeScaleValueId" TEXT,
    "gradeCode" TEXT,
    "gradeLabel" TEXT,
    "isApproved" BOOLEAN,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "periodos_evaluacion" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periodos_evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notas_trimestrales" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "finalGrade" DOUBLE PRECISION NOT NULL,
    "attendancePct" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notas_trimestrales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendance_statuses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "absenceValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "attendances" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseSectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "cycleId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "statusId" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "statusCode" TEXT,
    "statusDescription" TEXT,
    "absenceValue" DOUBLE PRECISION,
    "isPresent" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "study_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,
    "academicYear" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "study_plan_courses" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "courseSectionId" TEXT NOT NULL,

    CONSTRAINT "study_plan_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "study_plan_subjects" (
    "id" TEXT NOT NULL,
    "studyPlanCourseId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "hoursPerWeek" INTEGER,

    CONSTRAINT "study_plan_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "salas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age_group" INTEGER NOT NULL,
    "turno" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "teacher_id" TEXT,
    "academic_year" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sala_enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sala_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "informes_evolutivos" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observaciones_generales" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "informes_evolutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "areas_desarrollo" (
    "id" TEXT NOT NULL,
    "informe_id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "observacion" TEXT NOT NULL,
    "valoracion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_desarrollo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "planificaciones" (
    "id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "academic_year" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "secuencias_didacticas" (
    "id" TEXT NOT NULL,
    "planificacion_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "actividades" TEXT[],
    "recursos" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "secuencias_didacticas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "grados" (
    "id" TEXT NOT NULL,
    "course_section_id" TEXT,
    "grade" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "teacher_id" TEXT,
    "academic_year" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "calificaciones_primario" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "grado_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "trimestre" TEXT NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "concepto" TEXT NOT NULL,
    "aprobado" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calificaciones_primario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cursos" (
    "id" TEXT NOT NULL,
    "course_section_id" TEXT,
    "year" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "orientacion" TEXT,
    "academic_year" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "teacher_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "calificaciones_secundario" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "trimestre" TEXT NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "condicion" TEXT NOT NULL,
    "nota_diciembre" DOUBLE PRECISION,
    "nota_febrero" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calificaciones_secundario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mesas_examen" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "turno" TEXT NOT NULL,
    "presidente_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesas_examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "mesa_examen_inscripciones" (
    "id" TEXT NOT NULL,
    "mesa_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "nota_final" DOUBLE PRECISION,
    "condicion_final" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mesa_examen_inscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "regimen_academico" (
    "id" TEXT NOT NULL,
    "curso_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "promocion_directa" BOOLEAN NOT NULL,
    "requiere_examen_final" BOOLEAN NOT NULL,
    "nota_minima_aprobacion" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regimen_academico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "carreras" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "duracion" INTEGER NOT NULL,
    "resolucion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carreras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "materias_carrera" (
    "id" TEXT NOT NULL,
    "carrera_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "cuatrimestre" TEXT NOT NULL,
    "horas_catedra" INTEGER NOT NULL,
    "regimen" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materias_carrera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "correlatividades" (
    "id" TEXT NOT NULL,
    "materia_id" TEXT NOT NULL,
    "correlativa_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correlatividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "inscripciones_materia" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "materia_carrera_id" TEXT NOT NULL,
    "cuatrimestre" TEXT NOT NULL,
    "anio_academico" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "nota_cursada" DOUBLE PRECISION,
    "nota_final" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscripciones_materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "actas_examen" (
    "id" TEXT NOT NULL,
    "materia_carrera_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "presidente_id" TEXT NOT NULL,
    "vocales" TEXT[],
    "libro" TEXT,
    "folio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actas_examen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "acta_examen_notas" (
    "id" TEXT NOT NULL,
    "acta_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "nota" DOUBLE PRECISION NOT NULL,
    "condicion" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "acta_examen_notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "titulos" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "carrera_id" TEXT NOT NULL,
    "fecha_egreso" TIMESTAMP(3),
    "fecha_emision" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "nro_registro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "titulos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "students_dni_key" ON "students"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_lastName_idx" ON "students"("lastName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "students_dni_idx" ON "students"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_guardians_studentId_idx" ON "student_guardians"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_guardians_userId_idx" ON "student_guardians"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "student_guardians_studentId_userId_key" ON "student_guardians"("studentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "teachers_dni_key" ON "teachers"("dni");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teachers_lastName_idx" ON "teachers"("lastName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "teachers_dni_idx" ON "teachers"("dni");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "academic_cycles_uuid_key" ON "academic_cycles"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "academic_cycles_code_key" ON "academic_cycles"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "academic_cycles_level_idx" ON "academic_cycles"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "academic_cycles_active_idx" ON "academic_cycles"("active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_cycles_uuid_key" ON "course_cycles"("uuid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_cycles_cycleId_idx" ON "course_cycles"("cycleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_cycles_studyPlanId_idx" ON "course_cycles"("studyPlanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_cycles_level_idx" ON "course_cycles"("level");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_cycles_courseId_cycleId_key" ON "course_cycles"("courseId", "cycleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "enrollments_cycleId_idx" ON "enrollments"("cycleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subjects_level_idx" ON "subjects"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_sections_level_idx" ON "course_sections"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "course_sections_academicYear_idx" ON "course_sections"("academicYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subject_assignments_subjectId_idx" ON "subject_assignments"("subjectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subject_assignments_teacherId_idx" ON "subject_assignments"("teacherId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subject_assignments_courseSectionId_idx" ON "subject_assignments"("courseSectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grade_scales_level_idx" ON "grade_scales"("level");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "grade_scales_level_modality_name_key" ON "grade_scales"("level", "modality", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grade_scale_values_scaleId_idx" ON "grade_scale_values"("scaleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "grade_scale_values_scaleId_code_key" ON "grade_scale_values"("scaleId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evaluaciones_assignmentId_idx" ON "evaluaciones"("assignmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "evaluaciones_evaluationDate_idx" ON "evaluaciones"("evaluationDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_studentId_idx" ON "notas"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_evaluationId_idx" ON "notas"("evaluationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_registeredAt_idx" ON "notas"("registeredAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notas_evaluationId_studentId_key" ON "notas"("evaluationId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "periodos_evaluacion_academicYear_idx" ON "periodos_evaluacion"("academicYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_trimestrales_studentId_idx" ON "notas_trimestrales"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notas_trimestrales_periodId_idx" ON "notas_trimestrales"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notas_trimestrales_studentId_assignmentId_periodId_key" ON "notas_trimestrales"("studentId", "assignmentId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_statuses_code_key" ON "attendance_statuses"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_studentId_idx" ON "attendances"("studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_courseSectionId_idx" ON "attendances"("courseSectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_date_idx" ON "attendances"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attendances_cycleId_idx" ON "attendances"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attendances_studentId_courseSectionId_subjectId_date_key" ON "attendances"("studentId", "courseSectionId", "subjectId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "study_plans_level_idx" ON "study_plans"("level");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "study_plans_academicYear_idx" ON "study_plans"("academicYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "study_plan_courses_studyPlanId_idx" ON "study_plan_courses"("studyPlanId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "study_plan_courses_studyPlanId_courseSectionId_key" ON "study_plan_courses"("studyPlanId", "courseSectionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "study_plan_subjects_studyPlanCourseId_idx" ON "study_plan_subjects"("studyPlanCourseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "study_plan_subjects_studyPlanCourseId_subjectId_key" ON "study_plan_subjects"("studyPlanCourseId", "subjectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salas_academic_year_idx" ON "salas"("academic_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salas_age_group_idx" ON "salas"("age_group");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "salas_teacher_id_idx" ON "salas"("teacher_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sala_enrollments_student_id_idx" ON "sala_enrollments"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sala_enrollments_sala_id_idx" ON "sala_enrollments"("sala_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sala_enrollments_student_id_sala_id_academic_year_key" ON "sala_enrollments"("student_id", "sala_id", "academic_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "informes_evolutivos_student_id_idx" ON "informes_evolutivos"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "informes_evolutivos_sala_id_idx" ON "informes_evolutivos"("sala_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "informes_evolutivos_periodo_idx" ON "informes_evolutivos"("periodo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "areas_desarrollo_informe_id_idx" ON "areas_desarrollo"("informe_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "planificaciones_sala_id_idx" ON "planificaciones"("sala_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "planificaciones_academic_year_idx" ON "planificaciones"("academic_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "secuencias_didacticas_planificacion_id_idx" ON "secuencias_didacticas"("planificacion_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grados_academic_year_idx" ON "grados"("academic_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grados_teacher_id_idx" ON "grados"("teacher_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grados_course_section_id_idx" ON "grados"("course_section_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_primario_student_id_idx" ON "calificaciones_primario"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_primario_grado_id_idx" ON "calificaciones_primario"("grado_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_primario_subject_id_idx" ON "calificaciones_primario"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "calificaciones_primario_student_id_grado_id_subject_id_trim_key" ON "calificaciones_primario"("student_id", "grado_id", "subject_id", "trimestre");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cursos_academic_year_idx" ON "cursos"("academic_year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "cursos_course_section_id_idx" ON "cursos"("course_section_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_secundario_student_id_idx" ON "calificaciones_secundario"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_secundario_curso_id_idx" ON "calificaciones_secundario"("curso_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "calificaciones_secundario_subject_id_idx" ON "calificaciones_secundario"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "calificaciones_secundario_student_id_curso_id_subject_id_tr_key" ON "calificaciones_secundario"("student_id", "curso_id", "subject_id", "trimestre");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mesas_examen_subject_id_idx" ON "mesas_examen"("subject_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mesas_examen_fecha_idx" ON "mesas_examen"("fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mesas_examen_presidente_id_idx" ON "mesas_examen"("presidente_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mesa_examen_inscripciones_mesa_id_idx" ON "mesa_examen_inscripciones"("mesa_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "mesa_examen_inscripciones_student_id_idx" ON "mesa_examen_inscripciones"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "mesa_examen_inscripciones_mesa_id_student_id_key" ON "mesa_examen_inscripciones"("mesa_id", "student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "regimen_academico_curso_id_idx" ON "regimen_academico"("curso_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "regimen_academico_curso_id_subject_id_key" ON "regimen_academico"("curso_id", "subject_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "carreras_name_idx" ON "carreras"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "materias_carrera_carrera_id_idx" ON "materias_carrera"("carrera_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "materias_carrera_subject_id_idx" ON "materias_carrera"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "materias_carrera_carrera_id_subject_id_anio_cuatrimestre_key" ON "materias_carrera"("carrera_id", "subject_id", "anio", "cuatrimestre");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "correlatividades_materia_id_idx" ON "correlatividades"("materia_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "correlatividades_materia_id_correlativa_id_key" ON "correlatividades"("materia_id", "correlativa_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inscripciones_materia_student_id_idx" ON "inscripciones_materia"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inscripciones_materia_materia_carrera_id_idx" ON "inscripciones_materia"("materia_carrera_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inscripciones_materia_student_id_materia_carrera_id_cuatrim_key" ON "inscripciones_materia"("student_id", "materia_carrera_id", "cuatrimestre", "anio_academico");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "actas_examen_materia_carrera_id_idx" ON "actas_examen"("materia_carrera_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "actas_examen_fecha_idx" ON "actas_examen"("fecha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "actas_examen_presidente_id_idx" ON "actas_examen"("presidente_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "acta_examen_notas_acta_id_idx" ON "acta_examen_notas"("acta_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "acta_examen_notas_student_id_idx" ON "acta_examen_notas"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "acta_examen_notas_acta_id_student_id_key" ON "acta_examen_notas"("acta_id", "student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "titulos_student_id_idx" ON "titulos"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "titulos_carrera_id_idx" ON "titulos"("carrera_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "titulos_student_id_carrera_id_key" ON "titulos"("student_id", "carrera_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "study_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "course_cycles" ADD CONSTRAINT "course_cycles_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "academic_cycles"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "academic_cycles"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "subject_assignments" ADD CONSTRAINT "subject_assignments_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "grade_scale_values" ADD CONSTRAINT "grade_scale_values_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "grade_scales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "evaluaciones" ADD CONSTRAINT "evaluaciones_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "subject_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_gradeScaleValueId_fkey" FOREIGN KEY ("gradeScaleValueId") REFERENCES "grade_scale_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas" ADD CONSTRAINT "notas_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas_trimestrales" ADD CONSTRAINT "notas_trimestrales_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas_trimestrales" ADD CONSTRAINT "notas_trimestrales_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "subject_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "notas_trimestrales" ADD CONSTRAINT "notas_trimestrales_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periodos_evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attendances" ADD CONSTRAINT "attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attendances" ADD CONSTRAINT "attendances_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attendances" ADD CONSTRAINT "attendances_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attendances" ADD CONSTRAINT "attendances_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "academic_cycles"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attendances" ADD CONSTRAINT "attendances_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "attendance_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "study_plan_courses" ADD CONSTRAINT "study_plan_courses_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "study_plan_courses" ADD CONSTRAINT "study_plan_courses_courseSectionId_fkey" FOREIGN KEY ("courseSectionId") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "study_plan_subjects" ADD CONSTRAINT "study_plan_subjects_studyPlanCourseId_fkey" FOREIGN KEY ("studyPlanCourseId") REFERENCES "study_plan_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "study_plan_subjects" ADD CONSTRAINT "study_plan_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "salas" ADD CONSTRAINT "salas_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sala_enrollments" ADD CONSTRAINT "sala_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "sala_enrollments" ADD CONSTRAINT "sala_enrollments_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "informes_evolutivos" ADD CONSTRAINT "informes_evolutivos_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "informes_evolutivos" ADD CONSTRAINT "informes_evolutivos_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "areas_desarrollo" ADD CONSTRAINT "areas_desarrollo_informe_id_fkey" FOREIGN KEY ("informe_id") REFERENCES "informes_evolutivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "planificaciones" ADD CONSTRAINT "planificaciones_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "secuencias_didacticas" ADD CONSTRAINT "secuencias_didacticas_planificacion_id_fkey" FOREIGN KEY ("planificacion_id") REFERENCES "planificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "grados" ADD CONSTRAINT "grados_course_section_id_fkey" FOREIGN KEY ("course_section_id") REFERENCES "course_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "grados" ADD CONSTRAINT "grados_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_primario" ADD CONSTRAINT "calificaciones_primario_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_primario" ADD CONSTRAINT "calificaciones_primario_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_primario" ADD CONSTRAINT "calificaciones_primario_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "cursos" ADD CONSTRAINT "cursos_course_section_id_fkey" FOREIGN KEY ("course_section_id") REFERENCES "course_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "cursos" ADD CONSTRAINT "cursos_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_secundario" ADD CONSTRAINT "calificaciones_secundario_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_secundario" ADD CONSTRAINT "calificaciones_secundario_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "calificaciones_secundario" ADD CONSTRAINT "calificaciones_secundario_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "mesas_examen" ADD CONSTRAINT "mesas_examen_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "mesas_examen" ADD CONSTRAINT "mesas_examen_presidente_id_fkey" FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "mesa_examen_inscripciones" ADD CONSTRAINT "mesa_examen_inscripciones_mesa_id_fkey" FOREIGN KEY ("mesa_id") REFERENCES "mesas_examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "mesa_examen_inscripciones" ADD CONSTRAINT "mesa_examen_inscripciones_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "regimen_academico" ADD CONSTRAINT "regimen_academico_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "regimen_academico" ADD CONSTRAINT "regimen_academico_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "materias_carrera" ADD CONSTRAINT "materias_carrera_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "carreras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "materias_carrera" ADD CONSTRAINT "materias_carrera_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "correlatividades" ADD CONSTRAINT "correlatividades_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias_carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "correlatividades" ADD CONSTRAINT "correlatividades_correlativa_id_fkey" FOREIGN KEY ("correlativa_id") REFERENCES "materias_carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "inscripciones_materia" ADD CONSTRAINT "inscripciones_materia_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "inscripciones_materia" ADD CONSTRAINT "inscripciones_materia_materia_carrera_id_fkey" FOREIGN KEY ("materia_carrera_id") REFERENCES "materias_carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "actas_examen" ADD CONSTRAINT "actas_examen_materia_carrera_id_fkey" FOREIGN KEY ("materia_carrera_id") REFERENCES "materias_carrera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "actas_examen" ADD CONSTRAINT "actas_examen_presidente_id_fkey" FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "acta_examen_notas" ADD CONSTRAINT "acta_examen_notas_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas_examen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "acta_examen_notas" ADD CONSTRAINT "acta_examen_notas_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "titulos" ADD CONSTRAINT "titulos_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "titulos" ADD CONSTRAINT "titulos_carrera_id_fkey" FOREIGN KEY ("carrera_id") REFERENCES "carreras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


