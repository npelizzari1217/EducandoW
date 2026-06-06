// =============================================================================
// EducandoW — Auth Diagnostic Script
// Corre con el mismo ts-node que el seed, sin dependencias extra.
//
// Uso en el VPS:
//   cd C:\EducandoW\api
//   npx ts-node scripts\diagnose-auth.ts
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

// ── Minimal .env loader (no dotenv dependency) ──────────────
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// Import Prisma and bcrypt AFTER env is loaded
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Las credenciales de prueba se leen del entorno para no dejar secretos hardcodeados.
const TEST_EMAIL = process.env.ROOT_EMAIL ?? '';
// La contraseña ROOT se incluye desde la env var; los demás son candidatos genéricos.
const ROOT_PASSWORD_ENV = process.env.ROOT_PASSWORD;
const PASSWORDS_TO_TEST: string[] = [
  ...(ROOT_PASSWORD_ENV ? [ROOT_PASSWORD_ENV] : []),
  'Admin123!',
  'admin123',
  'password',
];

async function main() {
  console.log('');
  console.log('==============================================================');
  console.log('  EducandoW - Diagnostico de Autenticacion');
  console.log('==============================================================');
  console.log('');

  // ── 1. Environment ──────────────────────────────────────────
  console.log('[1/6] Variables de entorno...');
  const masterUrl = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL || '';
  console.log(`  MASTER_DATABASE_URL: ${maskUrl(masterUrl)}`);
  console.log(`  NODE_ENV:            ${process.env.NODE_ENV || '(not set)'}`);
  console.log(`  JWT_SECRET:          ${process.env.JWT_SECRET ? 'configured' : 'NOT SET'}`);
  console.log(`  BCRYPT_ROUNDS:       ${process.env.BCRYPT_ROUNDS || '12 (default)'}`);
  console.log('');

  // ── 2. DB Connectivity ─────────────────────────────────────
  console.log('[2/6] Conectando a la base de datos...');
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    console.log('  [OK] Conexion exitosa a PostgreSQL');
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.log(`  [FAIL] No se pudo conectar: ${error.message}`);
    console.log('');
    console.log('  Verifica que:');
    console.log('    - PostgreSQL este corriendo');
    console.log('    - DATABASE_URL en .env sea correcto');
    console.log('    - La DB exista y sea accesible');
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── 3. Check if user exists ─────────────────────────────────
  console.log(`[3/6] Buscando usuario ${TEST_EMAIL}...`);
  
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      passwordHash: true,
      institutionId: true,
      failedAttempts: true,
      lockedUntil: true,
      createdAt: true,
      userRoles: { select: { roleId: true } },
    },
  });

  if (!user) {
    console.log('  [FAIL] USUARIO NO ENCONTRADO');
    console.log('');
    console.log('  La base de datos NO fue seedeada (o se borro el usuario).');

    // Check if seed ran at all
    console.log('');
    console.log('[4/6] Se ejecuto el seed? Verificando tablas de sistema...');
    const roleCount = await prisma.role.count();
    const moduleCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>('SELECT COUNT(*)::int FROM modules');
    console.log(`  Roles:   ${roleCount} (deberian ser 9)`);
    console.log(`  Modulos: ${moduleCount[0]?.count || 0}`);
    console.log(`  Usuarios totales: ${await prisma.user.count()}`);

    if (roleCount === 0) {
      console.log('');
      console.log('  ===================================================');
      console.log('  ACCION REQUERIDA: Ejecutar el seed');
      console.log('  ===================================================');
      console.log('');
      console.log('  cd C:\\EducandoW\\api');
      console.log('  pnpm prisma:seed');
      console.log('');
    } else if (roleCount > 0 && (await prisma.user.count()) === 0) {
      console.log('');
      console.log('  Roles existen pero NO hay usuarios. Re-ejecuta el seed:');
      console.log('  cd C:\\EducandoW\\api');
      console.log('  pnpm prisma:seed');
    }
    console.log('');
    console.log('  Despues de seedear, la contrasena sera la definida en ROOT_PASSWORD de tu .env');

    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('  [OK] Usuario encontrado:');
  console.log(`     ID:            ${user.id}`);
  console.log(`     Email:         ${user.email}`);
  console.log(`     Nombre:        ${user.name}`);
  console.log(`     Activo:        ${user.active}`);
  console.log(`     Institucion:   ${user.institutionId || '(ROOT - sin institucion)'}`);
  console.log(`     Creado:        ${user.createdAt.toISOString()}`);
  console.log(`     Roles:         ${user.userRoles.map(r => r.roleId).join(', ') || 'NINGUNO'}`);

  if (!user.active) {
    console.log('');
    console.log('  [WARN] El usuario esta INACTIVO (active=false)');
    console.log('  Para activarlo manualmente en la DB:');
    console.log(`    UPDATE users SET active = true WHERE email = '${TEST_EMAIL}';`);
  }

  if (user.userRoles.length === 0) {
    console.log('');
    console.log('  [WARN] El usuario NO tiene roles asignados');
  }

  if (user.failedAttempts > 0) {
    console.log(`  Failed attempts:  ${user.failedAttempts}`);
  }
  if (user.lockedUntil) {
    console.log(`  [FAIL] CUENTA BLOQUEADA hasta ${user.lockedUntil.toISOString()}`);
    console.log('  Para desbloquear:');
    console.log(`    UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = '${TEST_EMAIL}';`);
  }

  // ── 5. Test bcrypt ─────────────────────────────────────────
  console.log('');
  console.log('[5/6] Testeando bcrypt.compare con el hash almacenado...');

  const hash = user.passwordHash;
  if (!hash) {
    console.log('  [FAIL] El usuario NO tiene password hash almacenado!');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Show hash prefix for debugging (bcrypt hashes start with $2a$ or $2b$)
  console.log(`  Hash prefix: ${hash.substring(0, 7)}...`);

  let anyMatch = false;
  for (const pw of PASSWORDS_TO_TEST) {
    try {
      const matches = bcrypt.compareSync(pw, hash);
      const status = matches ? '[MATCH]' : '[NO MATCH]';
      console.log(`  ${status}   "${pw}"`);
      if (matches) anyMatch = true;
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.log(`  [ERROR] "${pw}" - bcrypt.compare fallo: ${error.message}`);
    }
  }

  if (anyMatch) {
    console.log('');
    console.log('  >>> Usa la contrasena marcada con [MATCH] para loguearte. <<<');
  } else {
    console.log('');
    console.log('  [WARN] NINGUNA de las contrasenas probadas matchea.');
    console.log('');
    console.log('  Opcion rapida: regenera el hash con Admin123! en Node.js:');
    console.log('    cd C:\\EducandoW\\api');
    console.log(`    node -e "const bc=require('bcrypt'); bc.hash('Admin123!',12).then(h=>console.log(h))"`);
    console.log('');
    console.log('  Luego actualiza la DB con ese hash (usa psql o DBeaver):');
    console.log(`    UPDATE users SET password = '<nuevo_hash>' WHERE email = '${TEST_EMAIL}';`);
  }

  // ── 6. API health check ────────────────────────────────────
  console.log('');
  console.log('[6/6] Chequeando API (http://localhost:3001/v1/health)...');
  try {
    const res = await fetch('http://localhost:3001/v1/health');
    if (res.ok) {
      console.log(`  [OK] API responde (HTTP ${res.status})`);
    } else {
      console.log(`  [WARN] API responde pero con error (HTTP ${res.status})`);
    }
  } catch {
    console.log('  [INFO] API no responde en puerto 3001.');
    console.log('         Esto es normal si no esta corriendo.');
    console.log('         Para iniciarla: pm2 start C:\\EducandoW\\api\\dist\\main.js --name educandow-api');
  }

  console.log('');
  console.log('==============================================================');
  console.log('  Diagnostico completo');
  console.log('==============================================================');

  await prisma.$disconnect();
}

// ── Helpers ──────────────────────────────────────────────────
function maskUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

// ── Run ──────────────────────────────────────────────────────
main().catch((err) => {
  console.error('');
  console.error('ERROR FATAL:', err.message);
  prisma.$disconnect().then(() => process.exit(1));
});
