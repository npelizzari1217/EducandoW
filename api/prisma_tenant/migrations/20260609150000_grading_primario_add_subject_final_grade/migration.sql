-- Migration: grading_primario_add_subject_final_grade
-- PR2: SubjectFinalGrade + SubjectFinalGradeType enum (AD-2)
-- Depends on: 20260609130000 (subject_period_grades + subject_grading_periods exist)
-- All back-relations on existing models are Prisma-only (no schema change needed).

-- CreateEnum
CREATE TYPE "SubjectFinalGradeType" AS ENUM ('FINAL', 'DICIEMBRE', 'MARZO', 'DEFINITIVA');

-- CreateTable
CREATE TABLE "subject_final_grades" (
    "id"                    TEXT NOT NULL,
    "student_id"            TEXT NOT NULL,
    "course_cycle_id"       TEXT NOT NULL,
    "subject_id"            TEXT NOT NULL,
    "type"                  "SubjectFinalGradeType" NOT NULL,
    "grade_scale_value_id"  TEXT,
    "grade_code"            TEXT,
    "internal_status"       "GradeInternalStatus",
    "passed"                BOOLEAN,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_final_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_final_grades_student_id_course_cycle_id_subject_id_type_key"
    ON "subject_final_grades"("student_id", "course_cycle_id", "subject_id", "type");

-- CreateIndex
CREATE INDEX "subject_final_grades_course_cycle_id_subject_id_idx"
    ON "subject_final_grades"("course_cycle_id", "subject_id");

-- CreateIndex
CREATE INDEX "subject_final_grades_student_id_idx"
    ON "subject_final_grades"("student_id");

-- AddForeignKey: student_id → students.id
ALTER TABLE "subject_final_grades"
    ADD CONSTRAINT "subject_final_grades_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: course_cycle_id → course_cycles.uuid
ALTER TABLE "subject_final_grades"
    ADD CONSTRAINT "subject_final_grades_course_cycle_id_fkey"
    FOREIGN KEY ("course_cycle_id") REFERENCES "course_cycles"("uuid")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: subject_id → subjects.id
ALTER TABLE "subject_final_grades"
    ADD CONSTRAINT "subject_final_grades_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: grade_scale_value_id → grade_scale_values.id
ALTER TABLE "subject_final_grades"
    ADD CONSTRAINT "subject_final_grades_grade_scale_value_id_fkey"
    FOREIGN KEY ("grade_scale_value_id") REFERENCES "grade_scale_values"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
