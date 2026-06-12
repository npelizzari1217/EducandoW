-- Migration: 20260612180000_ingresante_cycle_required
-- Makes cycle_id NOT NULL on ingresantes.
--
-- PREREQUISITE: Run cleanup-ingresantes-sin-ciclo.ts first to eliminate rows
-- with cycle_id IS NULL. This migration will fail if any such row exists.
--
-- Also drops the FK constraint (ON DELETE SET NULL is invalid for NOT NULL)
-- and recreates it with ON DELETE RESTRICT.
--
-- Rollback:
--   ALTER TABLE "ingresantes" DROP CONSTRAINT "ingresantes_cycle_id_fkey";
--   ALTER TABLE "ingresantes" ALTER COLUMN "cycle_id" DROP NOT NULL;
--   ALTER TABLE "ingresantes" ADD CONSTRAINT "ingresantes_cycle_id_fkey"
--     FOREIGN KEY ("cycle_id") REFERENCES "academic_cycles"("uuid")
--     ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop existing FK (ON DELETE SET NULL — incompatible with NOT NULL)
ALTER TABLE "ingresantes" DROP CONSTRAINT "ingresantes_cycle_id_fkey";

-- Set NOT NULL
ALTER TABLE "ingresantes" ALTER COLUMN "cycle_id" SET NOT NULL;

-- Recreate FK with ON DELETE RESTRICT
ALTER TABLE "ingresantes" ADD CONSTRAINT "ingresantes_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "academic_cycles"("uuid")
  ON DELETE RESTRICT ON UPDATE CASCADE;
