-- Migration: grading_primario_add_subject_grading_period_and_period_grade
-- PR1: Snapshot table + period grade table (with pa/ppi/pp flags inline per AD-3)
-- courseCycleId references CourseCycle.uuid (NOT id) — verified grounding fact.

-- CreateTable: subject_grading_periods
CREATE TABLE "subject_grading_periods" (
    "id"             TEXT    NOT NULL,
    "course_cycle_id" TEXT   NOT NULL,
    "subject_id"     TEXT    NOT NULL,
    "period_ordinal" INTEGER NOT NULL,
    "period_name"    TEXT    NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_grading_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subject_period_grades
CREATE TABLE "subject_period_grades" (
    "id"                   TEXT    NOT NULL,
    "student_id"           TEXT    NOT NULL,
    "course_cycle_id"      TEXT    NOT NULL,
    "subject_id"           TEXT    NOT NULL,
    "period_ordinal"       INTEGER NOT NULL,
    "grade_scale_value_id" TEXT,
    "grade_code"           TEXT,
    "internal_status"      "GradeInternalStatus",
    "pa"                   BOOLEAN NOT NULL DEFAULT false,
    "ppi"                  BOOLEAN NOT NULL DEFAULT false,
    "pp"                   BOOLEAN NOT NULL DEFAULT false,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_period_grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: subject_grading_periods unique constraint
CREATE UNIQUE INDEX "subject_grading_periods_course_cycle_id_subject_id_period_ordinal_key"
    ON "subject_grading_periods"("course_cycle_id", "subject_id", "period_ordinal");

-- CreateIndex: subject_grading_periods lookup index
CREATE INDEX "subject_grading_periods_course_cycle_id_subject_id_idx"
    ON "subject_grading_periods"("course_cycle_id", "subject_id");

-- CreateIndex: subject_period_grades unique constraint
CREATE UNIQUE INDEX "subject_period_grades_student_id_course_cycle_id_subject_id_period_ordinal_key"
    ON "subject_period_grades"("student_id", "course_cycle_id", "subject_id", "period_ordinal");

-- CreateIndex: subject_period_grades course+subject lookup
CREATE INDEX "subject_period_grades_course_cycle_id_subject_id_idx"
    ON "subject_period_grades"("course_cycle_id", "subject_id");

-- CreateIndex: subject_period_grades student lookup
CREATE INDEX "subject_period_grades_student_id_idx"
    ON "subject_period_grades"("student_id");

-- AddForeignKey: subject_grading_periods.course_cycle_id → course_cycles.uuid
ALTER TABLE "subject_grading_periods"
    ADD CONSTRAINT "subject_grading_periods_course_cycle_id_fkey"
    FOREIGN KEY ("course_cycle_id")
    REFERENCES "course_cycles"("uuid")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: subject_grading_periods.subject_id → subjects.id
ALTER TABLE "subject_grading_periods"
    ADD CONSTRAINT "subject_grading_periods_subject_id_fkey"
    FOREIGN KEY ("subject_id")
    REFERENCES "subjects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: subject_period_grades.student_id → students.id
ALTER TABLE "subject_period_grades"
    ADD CONSTRAINT "subject_period_grades_student_id_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: subject_period_grades.course_cycle_id → course_cycles.uuid
ALTER TABLE "subject_period_grades"
    ADD CONSTRAINT "subject_period_grades_course_cycle_id_fkey"
    FOREIGN KEY ("course_cycle_id")
    REFERENCES "course_cycles"("uuid")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: subject_period_grades.subject_id → subjects.id
ALTER TABLE "subject_period_grades"
    ADD CONSTRAINT "subject_period_grades_subject_id_fkey"
    FOREIGN KEY ("subject_id")
    REFERENCES "subjects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: subject_period_grades.grade_scale_value_id → grade_scale_values.id
ALTER TABLE "subject_period_grades"
    ADD CONSTRAINT "subject_period_grades_grade_scale_value_id_fkey"
    FOREIGN KEY ("grade_scale_value_id")
    REFERENCES "grade_scale_values"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
