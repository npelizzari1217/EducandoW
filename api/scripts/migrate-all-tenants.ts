/**
 * migrate-all-tenants.ts
 *
 * Runs `prisma migrate deploy` for every active institution's tenant database.
 * Reads db_name from the master DB and applies pending tenant migrations.
 *
 * Usage:
 *   npx ts-node scripts/migrate-all-tenants.ts
 *   pnpm ts-node scripts/migrate-all-tenants.ts
 */

import { execSync } from 'child_process';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// ── Minimal .env loader ─────────────────────────────────
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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const MASTER_URL = process.env.MASTER_DATABASE_URL;
if (!MASTER_URL) {
  console.error('❌ MASTER_DATABASE_URL is not set.');
  process.exit(1);
}

const SCHEMA_PATH = path.resolve(__dirname, '..', 'prisma_tenant', 'schema.prisma');
const CWD = path.resolve(__dirname, '..');

async function main() {
  console.log('🔄 Tenant Migration — All Active Institutions\n');

  const pool = new Pool({ connectionString: MASTER_URL });

  const { rows } = await pool.query<{ db_name: string }>(
    `SELECT db_name FROM institutions WHERE active = true AND deleted_at IS NULL`,
  );
  await pool.end();

  if (rows.length === 0) {
    console.log('⏩ No active institutions found. Nothing to migrate.\n');
    return;
  }

  console.log(`📋 Found ${rows.length} institution(s):\n`);

  let totalFailed = 0;
  for (const row of rows) {
    const dbName = row.db_name;
    const tenantUrl = MASTER_URL!.replace(/\/[^/]+$/, `/${dbName}`);

    console.log(`  ⏳ ${dbName} ...`);
    try {
      execSync(`npx prisma migrate deploy --schema="${SCHEMA_PATH}"`, {
        stdio: 'inherit',
        cwd: CWD,
        env: { ...process.env, DATABASE_URL: tenantUrl },
      });
      console.log(`  ✅ ${dbName} — migrations applied.\n`);
    } catch (err) {
      totalFailed++;
      console.error(`  ❌ ${dbName} — migration failed:`, (err as Error).message, '\n');
    }
  }

  if (totalFailed > 0) {
    console.error(`⚠️  ${totalFailed} tenant(s) failed migration.`);
    process.exit(1);
  }

  console.log('✅ All tenant migrations complete.\n');
}

main().catch((e) => {
  console.error('❌ Unexpected error:', e);
  process.exit(1);
});
