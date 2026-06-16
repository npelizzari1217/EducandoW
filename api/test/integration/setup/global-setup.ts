/**
 * Vitest globalSetup for integration tests.
 *
 * Runs ONCE before any integration test file:
 *   1. (Re)creates the three dedicated test databases on the project's Postgres.
 *   2. Applies committed migrations to each via `prisma migrate deploy`
 *      (master schema → master DB, tenant schema → each tenant DB).
 *
 * Requires the docker-compose Postgres to be up (`docker compose up -d`).
 * DDL (CREATE/DROP DATABASE) uses the `pg` driver directly — it cannot run
 * inside a transaction, so we avoid Prisma's query layer for this step.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import {
  ADMIN_URL,
  MASTER_DB,
  TENANT_I1_DB,
  TENANT_I2_DB,
  MASTER_URL,
  TENANT_I1_URL,
  TENANT_I2_URL,
} from './test-db';

const API_ROOT = path.resolve(__dirname, '../../..');

async function recreateDatabases(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    for (const db of [MASTER_DB, TENANT_I1_DB, TENANT_I2_DB]) {
      // WITH (FORCE) terminates any lingering connections (Postgres 13+).
      await admin.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${db}"`);
    }
  } finally {
    await admin.end();
  }
}

function migrate(schema: string, urlEnv: Record<string, string>): void {
  execSync(`pnpm exec prisma migrate deploy --schema=${schema}`, {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...urlEnv },
  });
}

export default async function setup(): Promise<void> {
  await recreateDatabases();

  migrate('prisma_master/schema.prisma', { MASTER_DATABASE_URL: MASTER_URL });
  migrate('prisma_tenant/schema.prisma', { DATABASE_URL: TENANT_I1_URL });
  migrate('prisma_tenant/schema.prisma', { DATABASE_URL: TENANT_I2_URL });
}
