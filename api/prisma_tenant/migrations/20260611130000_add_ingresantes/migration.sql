-- Migration: 20260611130000_add_ingresantes
-- Creates the ingresantes table — waiting list of prospective students.
-- No link to the Student entity; a rejected ingresante may re-apply,
-- so dni is NOT unique (only indexed).
-- Rollback:
--   ALTER TABLE "ingresantes" DROP CONSTRAINT "ingresantes_cycle_id_fkey";
--   DROP INDEX "ingresantes_dni_idx";
--   DROP INDEX "ingresantes_status_idx";
--   DROP INDEX "ingresantes_cycle_id_idx";
--   DROP TABLE "ingresantes";

-- CreateTable
CREATE TABLE "ingresantes" (
  "id"         TEXT        NOT NULL,
  "first_name" TEXT        NOT NULL,
  "last_name"  TEXT        NOT NULL,
  "dni"        TEXT        NOT NULL,
  "email"      TEXT,
  "birth_date" TIMESTAMP(3),
  "address"    TEXT,
  "phone"      TEXT,
  "cycle_id"   TEXT,
  "level"      INTEGER     NOT NULL,
  "modality"   INTEGER     NOT NULL DEFAULT 0,
  "status"     TEXT        NOT NULL DEFAULT 'INSCRIPTO',
  "active"     BOOLEAN     NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ingresantes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ingresantes" ADD CONSTRAINT "ingresantes_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "academic_cycles"("uuid")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ingresantes_dni_idx"      ON "ingresantes"("dni");
CREATE INDEX "ingresantes_status_idx"   ON "ingresantes"("status");
CREATE INDEX "ingresantes_cycle_id_idx" ON "ingresantes"("cycle_id");
