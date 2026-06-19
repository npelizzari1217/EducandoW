-- Idempotent: only runs if UPDATE is not already in the array.
UPDATE "role_modules"
SET "actions" = ARRAY['CREATE','READ','UPDATE']
WHERE "id" = 'rm-r-teach-m-grades'
  AND NOT ('UPDATE' = ANY("actions"));
