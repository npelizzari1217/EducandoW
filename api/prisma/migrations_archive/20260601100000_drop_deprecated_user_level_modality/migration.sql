-- Drop deprecated scalar level/modality columns from users table
-- Data already migrated to user_levels table by previous migration
ALTER TABLE "users" DROP COLUMN IF EXISTS "level";
ALTER TABLE "users" DROP COLUMN IF EXISTS "modality";
