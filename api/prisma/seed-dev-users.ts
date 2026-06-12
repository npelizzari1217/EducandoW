/**
 * seed-dev-users.ts
 *
 * Crea (o actualiza) usuarios demo por cada rol canónico en la institución
 * demo local. Idempotente: usa upsert por email.
 *
 * Uso:
 *   ENCRYPTION_KEY=... DATABASE_URL=... MASTER_DATABASE_URL=... \
 *     npx ts-node prisma/seed-dev-users.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const DEMO_INSTITUTION_ID = 'ccaeff56-c45b-413c-b0e0-395361c0fe9f';
const PASSWORD = 'Demo1234!';
const BCRYPT_ROUNDS = 12;

/**
 * Nivel Primario (base encoding, igual que gonzalez@demo.edu.ar).
 * El tenant demo tiene course_cycles con level=20 (composite Primario/COMUN),
 * que se mapea a level=2, modality=0 en user_levels (base encoding).
 */
const DEMO_LEVEL = { level: 2, modality: 0 };

const demoUsers = [
  { email: 'director@demo.edu.ar',   name: 'Director Demo',   roleId: 'r-director',   withLevel: true  },
  { email: 'secretario@demo.edu.ar', name: 'Secretario Demo', roleId: 'r-secretario', withLevel: true  },
  { email: 'preceptor@demo.edu.ar',  name: 'Preceptor Demo',  roleId: 'r-preceptor',  withLevel: false },
  { email: 'tutor@demo.edu.ar',      name: 'Tutor Demo',      roleId: 'r-tutor',      withLevel: false },
  { email: 'student@demo.edu.ar',    name: 'Alumno Demo',     roleId: 'r-student',    withLevel: false },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  for (const u of demoUsers) {
    // 1. Upsert user
    const existing = await prisma.user.findUnique({ where: { email: u.email } });

    let userId: string;

    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: { passwordHash, name: u.name, institutionId: DEMO_INSTITUTION_ID },
      });
      userId = existing.id;
      console.log(`⚠️  Updated existing user: ${u.email}`);
    } else {
      userId = randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          email: u.email,
          passwordHash,
          name: u.name,
          institutionId: DEMO_INSTITUTION_ID,
        },
      });
      console.log(`✅ Created user: ${u.email}`);
    }

    // 2. Upsert user_role
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: u.roleId } },
      create: { userId, roleId: u.roleId },
      update: {},
    });
    console.log(`   Rol asignado: ${u.roleId}`);

    // 3. Upsert user_level para roles administrativos con scope de datos
    if (u.withLevel) {
      await prisma.userLevel.upsert({
        where: {
          userId_level_modality: {
            userId,
            level: DEMO_LEVEL.level,
            modality: DEMO_LEVEL.modality,
          },
        },
        create: {
          id: randomUUID(),
          userId,
          level: DEMO_LEVEL.level,
          modality: DEMO_LEVEL.modality,
        },
        update: {},
      });
      console.log(`   Nivel asignado: level=${DEMO_LEVEL.level}, modality=${DEMO_LEVEL.modality} (Primario/Común)`);
    }
  }

  console.log('\n✅ Demo users ready:');
  console.log('   director@demo.edu.ar   / Demo1234! / DIRECTOR   / Primario Común');
  console.log('   secretario@demo.edu.ar / Demo1234! / SECRETARIO / Primario Común');
  console.log('   preceptor@demo.edu.ar  / Demo1234! / PRECEPTOR  / (sin nivel)');
  console.log('   tutor@demo.edu.ar      / Demo1234! / TUTOR      / (sin nivel)');
  console.log('   student@demo.edu.ar    / Demo1234! / STUDENT    / (sin nivel)');
}

main()
  .catch((e) => {
    console.error('❌ seed-dev-users failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
