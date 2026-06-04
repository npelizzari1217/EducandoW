# Design: Bootstrap Script

This document outlines the technical design for the `bootstrap-script` change, which automates the setup of the master database.

## 1. Core Logic & Script Flow (`api/scripts/bootstrap.ts`)

The script will be a standalone TypeScript file executed with `ts-node`. It will perform a sequence of steps, each with clear console output. The script will exit immediately with a non-zero status code if any step fails.

### Step 1: Environment Validation
- The script will first load environment variables from `.env` using `dotenv`.
- It will validate the presence of `MASTER_DATABASE_URL` and `ENCRYPTION_KEY`.
- It will enforce that `ENCRYPTION_KEY` is exactly 32 bytes long.
- A warning will be displayed if `NODE_ENV` is not `development`, but execution will continue.
- **Implementation**: Simple `if` checks on `process.env` variables.

### Step 2: Database Connection & Creation
- The target database name will be parsed from the `MASTER_DATABASE_URL` connection string.
- A maintenance connection URL will be created by replacing the target database name with `postgres`.
- **Technology**: The `pg` package (a project dependency) will be used to create a `Pool`. This reuses the same pattern established in `PostgresAdminService`.
- **Idempotency**: The `CREATE DATABASE` command will be executed within a `try/catch` block. The specific error code for "database already exists" (`42P04`) will be caught and treated as a success, logging a "Skipping" message. All other errors will cause the script to fail.

### Step 3: Shelling Out for Prisma Commands
- For Prisma operations and seeding, the script will use Node.js's built-in `child_process.execSync`. This is chosen for its simplicity and synchronous nature, which fits the script's step-by-step flow.
- The standard output (`stdio`) will be piped to the current process's console so the user can see the output from the underlying commands.
- The commands to be executed in order are:
    1.  `npx prisma generate --schema=prisma_master/schema.prisma`
    2.  `npx prisma migrate deploy --schema=prisma_master/schema.prisma`
    3.  `npx ts-node prisma/seed.ts`
- **Error Handling**: `execSync` throws an error if the command returns a non-zero exit code. This will be caught, logged, and will cause the script to exit.

### Step 4: Console Output
- Each major step will be clearly announced to the console.
- A consistent format with emojis will be used to indicate the status of each step:
    - `⏳ [Step Name]...` (starting)
    - `✅ [Step Name] completed.` (success)
    - `❌ [Step Name] failed.` (failure)
    - `⏩ [Step Name] already exists, skipping.` (idempotent skip)
- This makes the script's progress easy to follow and simplifies debugging.

## 2. Configuration Changes

### `api/package.json`
- A new script will be added to the `scripts` section:
  ```json
  "bootstrap": "ts-node scripts/bootstrap.ts"
  ```
- This allows developers to run the script via `pnpm bootstrap` (or `npm run bootstrap`).

### `api/.env.example`
- Two new variables will be added to provide a template for developers:
  ```dotenv
  # Master Database Connection String (for bootstrap and migrations)
  MASTER_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/educandow_master?schema=public"

  # 32-byte key for encrypting sensitive data at rest (e.g., credentials)
  # Generate with: openssl rand -hex 32
  ENCRYPTION_KEY=
  ```
- Explanatory comments will be included to guide the user on how to generate the values.

## 3. File Structure

- The new script will be located at `api/scripts/bootstrap.ts`.
- No other files will be created.

This design directly implements all requirements from the proposal and spec, reusing existing project patterns (`pg`, `ts-node`) for consistency and simplicity.
