/**
 * One-time migration: creates StudentGuardian records from legacy
 * guardianName/guardianPhone in Student records.
 *
 * IDEMPOTENT: running it twice produces the same result.
 * Fields guardianName/guardianPhone are NOT dropped — preserved for rollback.
 *
 * Usage: ts-node prisma/migrate-guardians.ts
 */
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PrismaClient as MasterPrismaClient } from '@prisma/client';

async function main() {
  const master = new MasterPrismaClient();
  const tenant = new TenantPrismaClient();

  try {
    // 1. Find all students that have a guardianPhone or guardianName
    const studentsWithGuardian = await tenant.student.findMany({
      where: { guardianName: { not: null } },
      select: { id: true, guardianName: true, guardianPhone: true },
    });

    console.log(`Found ${studentsWithGuardian.length} students with guardianName`);

    let created = 0;
    let skipped = 0;

    for (const student of studentsWithGuardian) {
      if (!student.guardianName) continue;

      // 2. Try to find a matching User in master DB by name
      const user = await master.user.findFirst({
        where: { name: { contains: student.guardianName, mode: 'insensitive' } },
        select: { id: true },
      });

      if (!user) {
        console.warn(
          `⚠️  No user match for student ${student.id} (` +
            `guardianName: "${student.guardianName}", phone: "${student.guardianPhone}"` +
            `). Preserving legacy fields.`,
        );
        skipped++;
        continue;
      }

      // 3. Check if StudentGuardian already exists (idempotency)
      const existing = await tenant.studentGuardian.findFirst({
        where: { studentId: student.id, userId: user.id },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // 4. Create StudentGuardian
      await tenant.studentGuardian.create({
        data: {
          studentId: student.id,
          userId: user.id,
          relationship: 'other',
        },
      });

      created++;
    }

    console.log(`\n✅ Migration complete:`);
    console.log(`   Created: ${created} StudentGuardian records`);
    console.log(`   Skipped: ${skipped} (already exists or no match)`);
    console.log(`   guardianName/guardianPhone preserved for rollback`);
  } finally {
    await master.$disconnect();
    await tenant.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
