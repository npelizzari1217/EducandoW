-- Migration: attendance_types
-- Strategy: Clean replacement (ADR-01)
-- No data to preserve: attendance_statuses is seed-only data, attendances table is EMPTY.

-- Step 1: Drop the old FK from attendances → attendance_statuses
ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_statusId_fkey";

-- Step 2: Drop the old catalog table
DROP TABLE IF EXISTS "attendance_statuses";

-- Step 3: Create the new catalog table
CREATE TABLE "attendance_types" (
  "id"           TEXT NOT NULL,
  "level"        INTEGER NOT NULL,
  "code"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "absenceValue" DECIMAL(4,2) NOT NULL DEFAULT 0,
  "isPresent"    BOOLEAN NOT NULL DEFAULT true,
  "assignable"   BOOLEAN NOT NULL DEFAULT true,
  "isSystem"     BOOLEAN NOT NULL DEFAULT false,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "attendance_types_pkey" PRIMARY KEY ("id")
);

-- Step 4: Unique index on (level, code)
CREATE UNIQUE INDEX "attendance_types_level_code_key" ON "attendance_types"("level", "code");

-- Step 5: Index on level for filtering
CREATE INDEX "attendance_types_level_idx" ON "attendance_types"("level");

-- Step 6: Re-create the FK from attendances.statusId → attendance_types.id
-- Safe: attendances table is EMPTY, no integrity risk.
ALTER TABLE "attendances"
  ADD CONSTRAINT "attendances_statusId_fkey"
  FOREIGN KEY ("statusId") REFERENCES "attendance_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
