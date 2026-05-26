-- AlterTable: Add new optional columns to students
ALTER TABLE "students" ADD COLUMN "address" TEXT;
ALTER TABLE "students" ADD COLUMN "phone" TEXT;
ALTER TABLE "students" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "students" ADD COLUMN "userId" TEXT;

-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('mother', 'father', 'legal_guardian', 'other');

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_studentId_userId_key" ON "student_guardians"("studentId", "userId");

-- CreateIndex
CREATE INDEX "student_guardians_studentId_idx" ON "student_guardians"("studentId");

-- CreateIndex
CREATE INDEX "student_guardians_userId_idx" ON "student_guardians"("userId");

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
