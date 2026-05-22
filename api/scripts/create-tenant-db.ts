/**
 * create-tenant-db.ts
 *
 * Creates a new tenant PostgreSQL database and runs Prisma migrations.
 *
 * Usage:
 *   npx ts-node scripts/create-tenant-db.ts <dbName>
 *
 * Example:
 *   npx ts-node scripts/create-tenant-db.ts educandow_abc123
 *
 * Requires:
 *   - MASTER_DATABASE_URL or DATABASE_URL env var (used as template for connection params)
 *   - Tenant schema migrations exist at prisma/migrations_tenant/
 *
 * How it works:
 *   1. Reads MASTER_DATABASE_URL and replaces the database name with <dbName>
 *   2. Creates the database via raw SQL (CREATE DATABASE)
 *   3. Runs prisma migrate deploy for the tenant schema
 */

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const dbName = process.argv[2];

if (!dbName) {
  console.error('ERROR: Missing dbName argument.');
  console.error('Usage: npx ts-node scripts/create-tenant-db.ts <dbName>');
  process.exit(1);
}

// Validate dbName: only alphanumeric and underscores
if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
  console.error(`ERROR: Invalid dbName "${dbName}". Only alphanumeric characters and underscores allowed.`);
  process.exit(1);
}

const masterUrl = process.env.MASTER_DATABASE_URL ?? process.env.DATABASE_URL;

if (!masterUrl) {
  console.error('ERROR: Neither MASTER_DATABASE_URL nor DATABASE_URL is set.');
  process.exit(1);
}

// Build tenant URL by replacing the database name
const tenantUrl = masterUrl.replace(/\/[^/]+$/, `/${dbName}`);

// Parse URL to get connection params for CREATE DATABASE
const urlObj = new URL(masterUrl);
const dbToCreate = dbName;

// Build admin URL (connect to default 'postgres' DB to run CREATE DATABASE)
const adminUrl = `${urlObj.protocol}//${urlObj.username}:${urlObj.password}@${urlObj.hostname}:${urlObj.port}/postgres`;

console.log(`🔧 Creating tenant database: ${dbToCreate}`);
console.log(`   Admin URL: ${adminUrl.replace(/:([^@]+)@/, ':****@')}`);

try {
  // ── Step 1: Create database ────────────────────────────
  console.log('📦 Creating database...');

  // Use psql if available, otherwise use prisma's directUrl approach
  execSync(
    `psql "${adminUrl}" -c "CREATE DATABASE \\"${dbToCreate}\\"" 2>&1`,
    { stdio: 'pipe' },
  );
  console.log('   ✅ Database created.');

  // ── Step 2: Run Prisma migrations ──────────────────────
  console.log('🏗️  Running tenant migrations...');

  const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema_tenant.prisma');
  execSync(
    `DATABASE_URL="${tenantUrl}" npx prisma migrate deploy --schema="${schemaPath}"`,
    {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: tenantUrl },
    },
  );
  console.log('   ✅ Migrations applied.');

  console.log(`\n✅ Tenant database "${dbToCreate}" created successfully.`);
  console.log(`   Connection URL: ${tenantUrl.replace(/:([^@]+)@/, ':****@')}`);
} catch (error: any) {
  // Check if database already exists
  const stderr = error.stderr?.toString() ?? error.message ?? '';
  if (stderr.includes('already exists')) {
    console.log('   ⚠️  Database already exists, skipping creation.');
    // Still try to run migrations
    console.log('🏗️  Running tenant migrations...');
    const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema_tenant.prisma');
    execSync(
      `DATABASE_URL="${tenantUrl}" npx prisma migrate deploy --schema="${schemaPath}"`,
      {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: tenantUrl },
      },
    );
    console.log('   ✅ Migrations applied.');
    console.log(`\n✅ Tenant database "${dbToCreate}" is ready.`);
  } else {
    console.error(`\n❌ Failed to create tenant database: ${stderr}`);
    process.exit(1);
  }
}
