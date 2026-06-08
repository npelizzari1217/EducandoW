-- DESTRUCTIVE RESET: competency_valuations + subject_competencies cleared
-- Safe only because tables are near-empty (Fase 2 pre-production). No down-migration.
-- Note: tables did not previously exist in DB (no prior migration was applied); creating fresh
-- with correct studyPlanSubjectId FK instead of old subjectId.

-- AlterTable
ALTER TABLE "course_cycles" ADD COLUMN     "active_grading_period" INTEGER;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "printable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "promoted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "grading_period_dates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "grading_period_template_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "grading_period_templates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "subject_competencies" (
    "id" TEXT NOT NULL,
    "studyPlanSubjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_valuations" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "valuation1" TEXT,
    "valuation2" TEXT,
    "valuation3" TEXT,
    "valuation4" TEXT,
    "modificable1" BOOLEAN NOT NULL DEFAULT true,
    "modificable2" BOOLEAN NOT NULL DEFAULT true,
    "modificable3" BOOLEAN NOT NULL DEFAULT true,
    "modificable4" BOOLEAN NOT NULL DEFAULT true,
    "imprimible1" BOOLEAN NOT NULL DEFAULT false,
    "imprimible2" BOOLEAN NOT NULL DEFAULT false,
    "imprimible3" BOOLEAN NOT NULL DEFAULT false,
    "imprimible4" BOOLEAN NOT NULL DEFAULT false,
    "periodActive" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_competencies_studyPlanSubjectId_idx" ON "subject_competencies"("studyPlanSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_competencies_studyPlanSubjectId_name_key" ON "subject_competencies"("studyPlanSubjectId", "name");

-- CreateIndex
CREATE INDEX "competency_valuations_competencyId_idx" ON "competency_valuations"("competencyId");

-- CreateIndex
CREATE INDEX "competency_valuations_studentId_idx" ON "competency_valuations"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_valuations_studentId_competencyId_key" ON "competency_valuations"("studentId", "competencyId");

-- AddForeignKey
ALTER TABLE "subject_competencies" ADD CONSTRAINT "subject_competencies_studyPlanSubjectId_fkey" FOREIGN KEY ("studyPlanSubjectId") REFERENCES "study_plan_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_valuations" ADD CONSTRAINT "competency_valuations_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "subject_competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_valuations" ADD CONSTRAINT "competency_valuations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
