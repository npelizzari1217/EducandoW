// =============================================================================
// EducandoW — List Users Script (psql-free)
// Corre directo con Node.js, usa el cliente pg nativo.
//
// Uso:
//   node scripts/list-users.js
//   node scripts/list-users.js --all       (incluye inactivos y borrados)
//   node scripts/list-users.js --hash      (muestra hash de password)
// =============================================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
  console.error('Asegurate de que exista con MASTER_DATABASE_URL configurado.');
  process.exit(1);
}

// ── Config ─────────────────────────────────────────────────
const DATABASE_URL = process.env.MASTER_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: MASTER_DATABASE_URL no esta definido en .env');
  process.exit(1);
}

const showAll = process.argv.includes('--all');
const showHash = process.argv.includes('--hash');

// ── Connect & Query ─────────────────────────────────────────
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  console.log('');
  console.log('==============================================================');
  console.log('  EducandoW — Lista de Usuarios');
  console.log('==============================================================');
  console.log('');

  try {
    await pool.query('SELECT 1');
    console.log('[OK] Conectado a PostgreSQL');
  } catch (err) {
    console.error(`[FAIL] No se pudo conectar: ${err.message}`);
    await pool.end();
    process.exit(1);
  }

  // Build query
  let whereClause = 'WHERE 1=1';
  if (!showAll) {
    whereClause = 'WHERE u."deletedAt" IS NULL AND u.active = true';
  }

  const query = `
    SELECT
      u.email,
      u.name,
      u.active,
      ${showHash ? 'u.password AS hash,' : ''}
      CASE WHEN u."lockedUntil" IS NOT NULL THEN 'BLOQUEADO' ELSE 'OK' END AS estado,
      u."failedAttempts" AS intentos_fallidos,
      COALESCE(p.name, 'SIN PERFIL') AS perfil,
      COALESCE(i.name, 'ROOT') AS institucion,
      TO_CHAR(u.created_at, 'YYYY-MM-DD HH24:MI') AS creado
    FROM users u
    LEFT JOIN profiles p ON u."profileId" = p.id
    LEFT JOIN institutions i ON u."institutionId" = i.id
    ${whereClause}
    ORDER BY u.created_at DESC
  `;

  const { rows } = await pool.query(query);

  if (rows.length === 0) {
    console.log('');
    console.log('  NO HAY USUARIOS en la base de datos.');
    console.log('  Ejecuta el seed: cd api && pnpm prisma:seed');
    console.log('');
  } else {
    console.log(`  Total: ${rows.length} usuarios`);
    console.log('');
    console.log('─'.repeat(showHash ? 120 : 100));

    for (const row of rows) {
      if (showHash) {
        console.log(`  ${row.email}`);
        console.log(`    Nombre:    ${row.name}`);
        console.log(`    Hash:      ${row.hash}`);
        console.log(`    Activo:    ${row.active}`);
        console.log(`    Estado:    ${row.estado}  |  Intentos: ${row.intentos_fallidos}`);
        console.log(`    Perfil:    ${row.perfil}`);
        console.log(`    Instit:    ${row.institucion}`);
        console.log(`    Creado:    ${row.creado}`);
      } else {
        console.log(
          `  ${row.email.padEnd(35)} | ${row.name.padEnd(25)} | ${row.estado.padEnd(10)} | ${row.intentos_fallidos.toString().padStart(2)} | ${row.perfil.padEnd(18)} | ${row.institucion}`
        );
      }
      console.log('');
    }
  }

  console.log('');
  console.log('Para resetear una contrasena:');
  console.log('  cd api');
  console.log("  node -e \"const bc=require('bcrypt'); bc.hash('NUEVA_CLAVE',12).then(h=>console.log(h))\"");
  console.log('  Luego actualiza la DB con ese hash.');
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  pool.end().then(() => process.exit(1));
});
