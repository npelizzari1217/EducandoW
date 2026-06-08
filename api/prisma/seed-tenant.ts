/**
 * Seed tenant database: attendance statuses + grade scales.
 * Run from api/ directory.
 *
 * Usage: DATABASE_URL=postgresql://... npx ts-node prisma/seed-tenant.ts
 */
import { PrismaClient } from '@prisma/tenant-client';
import { seedAttendanceStatuses, seedGradeScales, seedGradingPeriods, seedSystemAttendanceTypes } from './seed';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  await seedAttendanceStatuses(prisma);
  await seedSystemAttendanceTypes(prisma); // seeds P, SAB, DOM, X for all pedagogical levels
  await seedGradeScales(prisma);
  await seedGradingPeriods(prisma);

  await prisma.$disconnect();
  console.log('✅ Tenant seed complete');
}

main().catch((e) => {
  console.error('❌ Tenant seed failed:', e);
  process.exit(1);
});
