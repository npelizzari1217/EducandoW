-- AlterTable
ALTER TABLE "student_guardians" ADD COLUMN "is_financial_responsible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "is_authorized_to_pick_up" BOOLEAN NOT NULL DEFAULT false;
