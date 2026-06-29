-- PR2a: StudentGuardian schema extension
-- CRITICAL ordering: ALTER COLUMN relationship TYPE varchar(15) BEFORE DROP TYPE "GuardianRelationship"
-- Postgres refuses to drop a type still referenced by a column.

-- Step 1: Retype relationship column from enum to varchar(15) FIRST
ALTER TABLE "student_guardians" ALTER COLUMN "relationship" TYPE VARCHAR(15);

-- Step 2: Make userId nullable
ALTER TABLE "student_guardians" ALTER COLUMN "userId" DROP NOT NULL;

-- Step 3: Drop the GuardianRelationship enum (now safe — no column references it)
DROP TYPE "GuardianRelationship";

-- Step 4: Add new columns
ALTER TABLE "student_guardians" ADD COLUMN "fullName" TEXT;
ALTER TABLE "student_guardians" ADD COLUMN "mobile" TEXT;
ALTER TABLE "student_guardians" ADD COLUMN "email" TEXT;
ALTER TABLE "student_guardians" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "student_guardians" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
