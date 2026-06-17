-- Migration: 20260617140000_migrate_presidente_id_to_user
-- Description: Migrate MesaExamen/ActaExamen.presidenteId from Teacher.id to User.id (AD-6, no FK).
-- Closes: R-GAP from S3b-2. presidenteId becomes a cross-DB UUID reference (no FK, pattern AD-6).
-- Deploy: per-tenant via migrate-tenants.
--
-- PRE-DEPLOY (run per tenant, informational — does NOT block deploy under Option B):
--   SELECT COUNT(*) FROM mesas_examen me JOIN teachers t ON me.presidente_id = t.id WHERE t.user_id IS NULL;
--   SELECT COUNT(*) FROM actas_examen ae JOIN teachers t ON ae.presidente_id = t.id WHERE t.user_id IS NULL;
-- Rows with count > 0 will retain Teacher.id as dangling UUID (accepted, no UX impact).

-- STEP 1: Backfill mesas_examen — replace Teacher.id with Teacher.userId where available.
UPDATE mesas_examen SET presidente_id = t.user_id
  FROM teachers t
  WHERE mesas_examen.presidente_id = t.id AND t.user_id IS NOT NULL;

-- STEP 2: Backfill actas_examen — same logic.
UPDATE actas_examen SET presidente_id = t.user_id
  FROM teachers t
  WHERE actas_examen.presidente_id = t.id AND t.user_id IS NOT NULL;

-- STEP 3: Drop FK constraint on mesas_examen (IF EXISTS — safe for schema-drift tenants).
ALTER TABLE "mesas_examen" DROP CONSTRAINT IF EXISTS "mesas_examen_presidente_id_fkey";

-- STEP 4: Drop FK constraint on actas_examen (IF EXISTS).
ALTER TABLE "actas_examen" DROP CONSTRAINT IF EXISTS "actas_examen_presidente_id_fkey";

-- Indexes mesas_examen_presidente_id_idx and actas_examen_presidente_id_idx are RETAINED.

-- ROLLBACK DDL (structure only — data reversal out of scope):
-- ALTER TABLE "mesas_examen"
--   ADD CONSTRAINT "mesas_examen_presidente_id_fkey"
--   FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id")
--   ON DELETE RESTRICT ON UPDATE CASCADE;
-- ALTER TABLE "actas_examen"
--   ADD CONSTRAINT "actas_examen_presidente_id_fkey"
--   FOREIGN KEY ("presidente_id") REFERENCES "teachers"("id")
--   ON DELETE RESTRICT ON UPDATE CASCADE;
