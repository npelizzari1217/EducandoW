-- TOCTOU duplicate guard for study-tutor (userId IS NULL) rows.
-- Prisma cannot express partial unique indexes in schema.prisma — written as raw SQL.
--
-- Intent: enforce uniqueness on (studentId, fullName) ONLY for active study-tutor rows
-- (userId IS NULL AND active = true), preventing race-condition double-inserts that
-- bypass the application-layer findStudyTutor check.
--
-- Reflected in schema.prisma as a comment on the StudentGuardian model:
-- // @@unique([studentId, fullName]) -- partial; expressed in migration SQL only
CREATE UNIQUE INDEX "student_guardians_studentId_fullName_active_partial"
  ON "student_guardians"("studentId", "fullName")
  WHERE "userId" IS NULL AND "active" = true;
