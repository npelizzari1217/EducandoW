-- Migration: add_person_fields_to_user
-- Fase 1 — Persona en User (master)
-- UP-R1: adds firstName, lastName, dni, title, phone to the users table
-- NULLs are distinct in Postgres for the unique index, so ROOT/no-DNI users coexist safely.

-- AlterTable: add persona columns (all nullable to avoid breaking existing rows)
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;
ALTER TABLE "users" ADD COLUMN "dni" TEXT;
ALTER TABLE "users" ADD COLUMN "title" TEXT;
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- CreateIndex: DNI unique per institution (NULLs are distinct — standard Postgres behavior)
-- Multiple rows with (institutionId=NULL, dni=NULL) or (institutionId=X, dni=NULL) are all valid.
CREATE UNIQUE INDEX "users_institutionId_dni_key" ON "users"("institutionId", "dni");
