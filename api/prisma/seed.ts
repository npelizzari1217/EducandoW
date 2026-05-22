import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'npelizzari@gmail.com';
  const password = '***REMOVED***';
  const role = 'ROOT';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('⚠️  ROOT user already exists. Updating password...');
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashed, role, name: 'ROOT' },
    });
  } else {
    console.log('🔐 Creating ROOT user...');
    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: 'ROOT',
        role,
      },
    });
  }

  console.log('✅ ROOT user ready: npelizzari@gmail.com');
  console.log('   Role: ROOT — acceso total al sistema');
  console.log('   Solo ROOT puede crear/eliminar instituciones');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
