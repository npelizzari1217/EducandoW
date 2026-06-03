-- CreateTable: institution_levels
CREATE TABLE IF NOT EXISTS "institution_levels" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "modality" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable: roles
CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_roles
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: modules
CREATE TABLE IF NOT EXISTS "modules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: module_actions
CREATE TABLE IF NOT EXISTS "module_actions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_modules
CREATE TABLE IF NOT EXISTS "role_modules" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "actions" TEXT[],

    CONSTRAINT "role_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_modules
CREATE TABLE IF NOT EXISTS "user_modules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "actions" TEXT[],

    CONSTRAINT "user_modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: institution_levels
CREATE UNIQUE INDEX IF NOT EXISTS "institution_levels_institutionId_level_modality_key" ON "institution_levels"("institutionId", "level", "modality");

-- CreateIndex: roles
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

-- CreateIndex: user_roles
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex: modules
CREATE UNIQUE INDEX IF NOT EXISTS "modules_code_key" ON "modules"("code");

-- CreateIndex: module_actions
CREATE UNIQUE INDEX IF NOT EXISTS "module_actions_code_key" ON "module_actions"("code");

-- CreateIndex: role_modules
CREATE UNIQUE INDEX IF NOT EXISTS "role_modules_roleId_moduleId_key" ON "role_modules"("roleId", "moduleId");

-- CreateIndex: user_modules
CREATE UNIQUE INDEX IF NOT EXISTS "user_modules_userId_moduleId_key" ON "user_modules"("userId", "moduleId");

-- AddForeignKey: institution_levels → institutions
DO $$ BEGIN
  ALTER TABLE "institution_levels" ADD CONSTRAINT "institution_levels_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: user_roles → users
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: user_roles → roles
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: role_modules → roles
DO $$ BEGIN
  ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: role_modules → modules
DO $$ BEGIN
  ALTER TABLE "role_modules" ADD CONSTRAINT "role_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: user_modules → users
DO $$ BEGIN
  ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: user_modules → modules
DO $$ BEGIN
  ALTER TABLE "user_modules" ADD CONSTRAINT "user_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
