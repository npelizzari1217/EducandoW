// =============================================================================
// EducandoW — Reset Password Script
// Genera bcrypt hash y actualiza la DB en un solo paso.
//
// Uso:
//   node scripts/reset-password.js npelizzari@gmail.com
//   node scripts/reset-password.js npelizzari@gmail.com MiClave123
//
// Si no se especifica clave, usa "Admin123!" por defecto.
// =============================================================================

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// ── Args ───────────────────────────────────────────────────
const email = process.argv[2];
if (!email) {
  console.error('USO: node scripts/reset-password.js <EMAIL> [NUEVA_CLAVE]');
  console.error('  Si no se especifica clave, usa "Admin123!"');
  process.exit(1);
}
const newPassword = process.argv[3] || 'Admin123!';

// ── Load .env ──────────────────────────────────────────────
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
} else {
  console.error('ERROR: No se encontro el archivo .env en api/');
  process.exit(1);
}

const DATABASE_URL = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: MASTER_DATABASE_URL no esta definido en .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  console.log('');
  console.log('==============================================================');
  console.log('  EducandoW — Reset de Contraseña');
  console.log('==============================================================');
  console.log('');

  // 1. Check connection
  try {
    await pool.query('SELECT 1');
    console.log('[OK] Conectado a PostgreSQL');
  } catch (err) {
    console.error(`[FAIL] No se pudo conectar: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  // 2. Find user
  const { rows: users } = await pool.query(
    'SELECT id, email, name, active FROM users WHERE email = $1 AND "deletedAt" IS NULL',
    [email]
  );

  if (users.length === 0) {
    console.error(`[FAIL] Usuario "${email}" NO ENCONTRADO.`);
    await pool.end();
    process.exit(1);
  }

  const user = users[0];
  console.log(`  Usuario:  ${user.email}`);
  console.log(`  Nombre:   ${user.name}`);
  console.log(`  Activo:   ${user.active}`);

  if (!user.active) {
    console.log('');
    console.log('  [WARN] El usuario esta INACTIVO. Se activara junto con el reset.');
  }

  // 3. Generate hash
  console.log('');
  console.log(`[2/3] Generando hash bcrypt para "${newPassword}"...`);
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const hash = await bcrypt.hash(newPassword, rounds);
  console.log(`  Hash: ${hash.substring(0, 15)}...`);

  // 4. Update DB
  console.log('');
  console.log('[3/3] Actualizando base de datos...');
  try {
    const result = await pool.query(
      `UPDATE users
       SET password = $1,
           active = true,
           "failedAttempts" = 0,
           "lockedUntil" = NULL
       WHERE email = $2
       RETURNING id`,
      [hash, email]
    );

    if (result.rowCount > 0) {
      console.log('');
      console.log('  ==========================================');
      console.log('  CONTRASEÑA RESETEADA EXITOSAMENTE');
      console.log('  ==========================================');
      console.log('');
      console.log(`  Email:    ${email}`);
      console.log(`  Clave:    ${newPassword}`);
      console.log('');
      console.log('  Ya podés loguearte con esta contraseña.');
      console.log('');
    } else {
      console.error('[FAIL] No se pudo actualizar la contraseña.');
    }
  } catch (err) {
    console.error(`[FAIL] Error al actualizar: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  pool.end().then(() => process.exit(1));
});
