/**
 * bootstrap.ts
 *
 * One-command idempotent setup of the master database.
 *
 * Steps:
 *   1. Validate MASTER_DATABASE_URL and ENCRYPTION_KEY env vars
 *   2. Extract DB name and build maintenance connection URL
 *   3. CREATE DATABASE IF NOT EXISTS (idempotent)
 *   4. Run prisma generate (master schema)
 *   5. Run prisma migrate deploy (master schema)
 *   6. Run prisma seed (RBAC + ROOT user)
 *   7. Apply sync-system.sql (system data)
 *   8. Create Test institution + tenant DB (idempotent)
 *
 * Usage:
 *   pnpm bootstrap            (from api/)
 *   npx ts-node scripts/bootstrap.ts
 */

import { execSync } from 'child_process';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ── Minimal .env loader (no dotenv dependency) ─────────
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already defined (env vars take precedence over .env)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// ══════════════════════════════════════════════════════════
//  Pure Functions (exported for testing)
// ══════════════════════════════════════════════════════════

/**
 * Extracts the database name from the last path segment of a PostgreSQL URL.
 *
 * @example
 *   extractDatabaseName('postgresql://user:pass@host:5432/educandow_master')
 *   // => 'educandow_master'
 */
export function extractDatabaseName(url: string): string {
  // Use the URL constructor to reliably parse the connection string
  // PostgreSQL URLs have the format: postgresql://user:pass@host:port/dbname
  // Replace 'postgresql://' with 'http://' for URL parsing compatibility
  const parsed = new URL(url.replace(/^postgresql:\/\//, 'http://'));
  const dbName = parsed.pathname.replace(/^\//, '');

  if (!dbName || dbName === '') {
    throw new Error(
      `Cannot extract database name from MASTER_DATABASE_URL. Expected format: postgresql://user:pass@host:port/dbname`,
    );
  }
  return dbName;
}

/**
 * Builds a maintenance connection URL by replacing the database name with 'postgres'.
 *
 * @example
 *   buildMaintenanceUrl('postgresql://user:pass@host:5432/educandow_master')
 *   // => 'postgresql://user:pass@host:5432/postgres'
 */
export function buildMaintenanceUrl(url: string): string {
  // Use the URL constructor to reliably parse the connection string
  const parsed = new URL(url.replace(/^postgresql:\/\//, 'http://'));
  parsed.pathname = '/postgres';
  // Convert back from http:// to postgresql://
  return parsed.toString().replace(/^http:\/\//, 'postgresql://');
}

/**
 * Validates the required environment variables.
 *
 * - MASTER_DATABASE_URL must be present
 * - ENCRYPTION_KEY must be exactly 32 bytes
 * - Warns (but does not exit) if NODE_ENV is not 'development'
 *
 * Exits with code 1 on validation failure.
 */
export function validateEnv(): void {
  let hasError = false;

  // ── MASTER_DATABASE_URL ────────────────────────────
  if (!process.env.MASTER_DATABASE_URL) {
    console.error('❌ MASTER_DATABASE_URL is not set.');
    console.error('   Set it in your .env file or environment.');
    hasError = true;
  }

  // ── ENCRYPTION_KEY ─────────────────────────────────
  const key = process.env.ENCRYPTION_KEY;
  if (!key || Buffer.byteLength(key, 'utf8') !== 32) {
    const currentLen = key ? Buffer.byteLength(key, 'utf8') : 0;
    console.error(
      `❌ ENCRYPTION_KEY must be exactly 32 bytes (current: ${currentLen} bytes).`,
    );
    console.error('   Generate with: openssl rand -hex 32');
    hasError = true;
  }

  if (hasError) {
    process.exit(1);
  }

  // ── NODE_ENV warning ───────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    console.warn(
      `⚠️  NODE_ENV is "${process.env.NODE_ENV}". Bootstrap should normally run in development.`,
    );
    console.warn('   Proceeding anyway...');
  }
}

/**
 * Reads a SQL file from disk and executes its contents via a pg.Pool.
 * The pool is NOT closed by this function — the caller manages lifecycle.
 */
export async function applySyncSql(pool: Pool, sqlPath: string): Promise<void> {
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sqlContent);
}

// ══════════════════════════════════════════════════════════
//  Main Bootstrap Flow
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('🚀 Bootstrap — Master Database Setup\n');

  // ── Step 1: Validate environment ─────────────────────
  console.log('⏳ Validating environment variables...');
  validateEnv();
  console.log('✅ Environment variables validated.\n');

  const masterUrl = process.env.MASTER_DATABASE_URL!;

  // ── Step 2: Extract DB name & connect ────────────────
  let targetDbName: string;
  try {
    targetDbName = extractDatabaseName(masterUrl);
  } catch (err) {
    console.error('❌', (err as Error).message);
    process.exit(1);
  }

  console.log(`🎯 Target database: ${targetDbName}`);
  const maintenanceUrl = buildMaintenanceUrl(masterUrl);

  // ── Step 3: Create database (idempotent) ─────────────
  console.log('⏳ Creating database...');
  const adminPool = new Pool({ connectionString: maintenanceUrl });

  try {
    await adminPool.query(`CREATE DATABASE "${targetDbName}"`);
    console.log('✅ Database created.\n');
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === '42P04') {
      console.log('⏩ Database already exists, skipping.\n');
    } else {
      console.error('❌ Failed to create database:', pgErr.message ?? err);
      await adminPool.end();
      process.exit(1);
    }
  } finally {
    await adminPool.end();
  }

  // ── Step 4: Prisma generate ──────────────────────────
  console.log('⏳ Generating Prisma client...');
  try {
    execSync('npx prisma generate --schema=prisma_master/schema.prisma', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log('✅ Prisma client generated.\n');
  } catch (err) {
    console.error('❌ Prisma generate failed:', (err as Error).message);
    process.exit(1);
  }

  // ── Step 5: Prisma migrate deploy ────────────────────
  console.log('⏳ Running Prisma migrations...');
  try {
    execSync('npx prisma migrate deploy --schema=prisma_master/schema.prisma', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log('✅ Migrations applied.\n');
  } catch (err) {
    console.error('❌ Prisma migrate deploy failed:', (err as Error).message);
    process.exit(1);
  }

  // ── Step 6: Seed database ────────────────────────────
  console.log('⏳ Seeding database...');
  try {
    execSync('npx ts-node prisma/seed.ts', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
    });
    console.log('✅ Database seeded.\n');
  } catch (err) {
    console.error('❌ Seed failed:', (err as Error).message);
    process.exit(1);
  }

  // ── Step 7: Apply sync-system.sql ─────────────────────
  console.log('⏳ Synchronizing system data...');
  const masterPool = new Pool({ connectionString: masterUrl });
  try {
    const syncSqlPath = path.resolve(
      __dirname,
      '..',
      '..',
      'scripts',
      'sync-system.sql',
    );
    await applySyncSql(masterPool, syncSqlPath);
    console.log('✅ System data synchronized.\n');
  } catch (err) {
    console.error('❌ Failed to apply sync-system.sql:', (err as Error).message);
    process.exit(1);
  } finally {
    await masterPool.end();
  }

  // ── Step 8: Create Test institution ───────────────────
  console.log('⏳ Creating Test institution...');

  const TEST_INSTITUTION_UUID = '00000000-0000-0000-0000-000000000001';
  const TEST_INSTITUTION_DB_NAME = 'educandow_test';
  const TEST_INSTITUTION_NAME = 'Test';

  const instPool = new Pool({ connectionString: masterUrl });
  try {
    const result = await instPool.query(
      `INSERT INTO institutions (id, name, db_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (db_name) DO NOTHING`,
      [TEST_INSTITUTION_UUID, TEST_INSTITUTION_NAME, TEST_INSTITUTION_DB_NAME],
    );

    if (result.rowCount === 1) {
      console.log('✅ Test institution record created.');
    } else {
      console.log('⏩ Test institution record already exists, skipping.');
    }
  } catch (err) {
    console.error(
      '❌ Failed to insert Test institution:',
      (err as Error).message,
    );
    await instPool.end();
    process.exit(1);
  } finally {
    await instPool.end();
  }

  // ── Create tenant database ────────────────────────────
  const maintPool = new Pool({ connectionString: maintenanceUrl });
  try {
    await maintPool.query(`CREATE DATABASE "${TEST_INSTITUTION_DB_NAME}"`);
    console.log(`✅ Tenant database '${TEST_INSTITUTION_DB_NAME}' created.`);
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === '42P04') {
      console.log(
        `⏩ Tenant database '${TEST_INSTITUTION_DB_NAME}' already exists, skipping.`,
      );
    } else {
      console.error(
        '❌ Failed to create tenant database:',
        pgErr.message ?? err,
      );
      await maintPool.end();
      process.exit(1);
    }
  } finally {
    await maintPool.end();
  }

  // ── Run tenant migrations ─────────────────────────────
  console.log('⏳ Running tenant migrations...');
  try {
    const tenantDbUrl = masterUrl.replace(
      /\/[^/]+$/,
      `/${TEST_INSTITUTION_DB_NAME}`,
    );
    execSync('npx prisma migrate deploy --schema=prisma_tenant/schema.prisma', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: tenantDbUrl },
    });
    console.log(
      `✅ Tenant migrations applied for '${TEST_INSTITUTION_DB_NAME}'.\n`,
    );
  } catch (err) {
    console.error(
      '❌ Tenant migrations failed:',
      (err as Error).message,
    );
    process.exit(1);
  }

  // ── Done ─────────────────────────────────────────────
  console.log('🎉 Bootstrap complete! Master database is ready.');
  console.log('──────────────────────────────────────────────────');
  console.log('  ROOT Credentials:');
  console.log(`    Email:    ${process.env.ROOT_EMAIL ?? '(definido en ROOT_EMAIL de tu .env)'}`);
  // La contraseña nunca se imprime en texto plano
  console.log('    Password: (la definida en ROOT_PASSWORD en tu .env)');
  console.log('    Role:     ROOT');
  console.log('');
  console.log('  Development URL:');
  console.log('    http://localhost:5173');
  console.log('──────────────────────────────────────────────────');
}

// Only run main() when executed directly (not imported)
if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Unexpected error:', e);
    process.exit(1);
  });
}
