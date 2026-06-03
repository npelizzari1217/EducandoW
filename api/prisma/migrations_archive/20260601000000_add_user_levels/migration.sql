-- CreateTable
CREATE TABLE "user_levels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_levels_userId_level_modality_key" ON "user_levels"("userId", "level", "modality");

-- AddForeignKey
ALTER TABLE "user_levels" ADD CONSTRAINT "user_levels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: copy existing level into user_levels
-- Note: users never had a modality column; default to 0
INSERT INTO "user_levels" ("id", "userId", "level", "modality")
SELECT gen_random_uuid(), "id", "level"::INTEGER, 0
FROM "users"
WHERE "level" IS NOT NULL;
