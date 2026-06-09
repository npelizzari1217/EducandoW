-- Migration: grading_primario_add_teacher_user_and_homeroom
-- PR3: Teacher.userId (nullable string, no FK — same convention as Student.userId, AD-6)
--      CourseCycle.homeroomTeacherId (nullable FK → teachers.id, onDelete SetNull, AD-6)
-- All columns nullable — no backfill required; existing rows remain valid.

-- AlterTable: add user_id to teachers
ALTER TABLE "teachers"
    ADD COLUMN "user_id" TEXT;

-- CreateIndex: teachers.user_id
CREATE INDEX "teachers_user_id_idx" ON "teachers"("user_id");

-- AlterTable: add homeroom_teacher_id to course_cycles
ALTER TABLE "course_cycles"
    ADD COLUMN "homeroom_teacher_id" TEXT;

-- AddForeignKey: course_cycles.homeroom_teacher_id → teachers.id
ALTER TABLE "course_cycles"
    ADD CONSTRAINT "course_cycles_homeroom_teacher_id_fkey"
    FOREIGN KEY ("homeroom_teacher_id") REFERENCES "teachers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: course_cycles.homeroom_teacher_id
CREATE INDEX "course_cycles_homeroom_teacher_id_idx" ON "course_cycles"("homeroom_teacher_id");
