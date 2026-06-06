-- CreateTable: student_observations
-- Stores pedagogical and psychopedagogical observations written by staff about students.
-- PSYCHOPEDAGOGICAL type is only visible to DIRECTOR+ roles (rank >= 50).

CREATE TABLE IF NOT EXISTS "student_observations" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_observations_student_id_idx" ON "student_observations"("student_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_observations_author_id_idx" ON "student_observations"("author_id");

-- AddForeignKey (idempotent guard via DO block)
DO $$ BEGIN
    ALTER TABLE "student_observations"
        ADD CONSTRAINT "student_observations_student_id_fkey"
        FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
