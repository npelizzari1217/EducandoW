# =============================================================================
# EducandoW — NUKE RESET: borra TODO y reinstala desde cero
# WARNING: DESTRUCTIVO — pierde todos los datos de la base de datos
# =============================================================================
param(
    [switch]$Force
)

if (-not $Force) {
    Write-Host "!!! ESTE SCRIPT BORRA TODA LA BASE DE DATOS Y REINSTALA DESDE CERO" -ForegroundColor Red
    Write-Host "    Esto incluye: master DB, todas las tenant DB, node_modules, builds" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Escribi 'BORRAR TODO' para confirmar"
    if ($confirm -ne "BORRAR TODO") {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

$ErrorActionPreference = "Stop"
$PROJECT_DIR = "C:\EducandoW"

Write-Host ""
Write-Host "=== NUKE RESET - EducandoW ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Detener pm2 ───────────────────────────────────────────────────────
Write-Host "[1/8] Stopping pm2..." -ForegroundColor Yellow
pm2 delete all -s 2>$null
pm2 kill -s 2>$null
Write-Host "  Stopped." -ForegroundColor Green

# ── 2. Cargar .env para obtener credenciales de DB ────────────────────────
Write-Host "[2/8] Loading database credentials..." -ForegroundColor Yellow
$apiDir = Join-Path $PROJECT_DIR "api"
$envFile = Join-Path $apiDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "  WARNING: .env not found, skipping DB drop." -ForegroundColor Yellow
} else {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $kv = $line.Split("=", 2)
            $key = $kv[0].Trim()
            $value = $kv[1].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }

    if ($env:MASTER_DATABASE_URL) {
        # Extraer componentes de la URL: postgresql://user:pass@host:port/dbname
        $dbUrl = $env:MASTER_DATABASE_URL
        # Remover protocolo
        $noProto = $dbUrl -replace '^postgresql://', ''
        # Separar user:pass del resto
        $atIdx = $noProto.IndexOf('@')
        $userPass = $noProto.Substring(0, $atIdx)
        $hostDb = $noProto.Substring($atIdx + 1)
        # user:pass
        $colonIdx = $userPass.IndexOf(':')
        $user = $userPass.Substring(0, $colonIdx)
        $pass = $userPass.Substring($colonIdx + 1)
        # host:port/dbname
        $slashIdx = $hostDb.IndexOf('/')
        $hostPort = $hostDb.Substring(0, $slashIdx)
        $dbName = $hostDb.Substring($slashIdx + 1)
        # host:port -> host y port
        $hpColon = $hostPort.IndexOf(':')
        if ($hpColon -ge 0) {
            $dbHost = $hostPort.Substring(0, $hpColon)
            $port = $hostPort.Substring($hpColon + 1)
        } else {
            $dbHost = $hostPort
            $port = "5432"
        }

        Write-Host "  DB Host: $dbHost`:$port" -ForegroundColor Gray
        Write-Host "  DB User: $user" -ForegroundColor Gray
        Write-Host "  DB Name: $dbName" -ForegroundColor Gray

        # ── 3. Dropear base maestra y tenants via Node.js ──────────────────
        Write-Host "[3/8] Dropping ALL databases via Node.js..." -ForegroundColor Yellow
        
        $dropScript = Join-Path $apiDir "drop-all-temp.js"
        @'
const { Pool } = require('pg');
const masterUrl = process.env.MASTER_DATABASE_URL;

if (!masterUrl) { console.error('MASTER_DATABASE_URL not set'); process.exit(1); }

// Parse URL to get maintenance connection (connect to 'postgres' DB)
const noProto = masterUrl.replace(/^postgresql:\/\//, '');
const atIdx = noProto.indexOf('@');
const userPass = noProto.substring(0, atIdx);
const hostDb  = noProto.substring(atIdx + 1);
const colonIdx = userPass.indexOf(':');
// URL-decode: la password puede venir percent-encoded (ej %24 = $) en la URL.
const user = decodeURIComponent(userPass.substring(0, colonIdx));
const pass = decodeURIComponent(userPass.substring(colonIdx + 1));
const slashIdx = hostDb.indexOf('/');
const hostPort = hostDb.substring(0, slashIdx);
const dbName = hostDb.substring(slashIdx + 1);
const hpColon = hostPort.indexOf(':');
const host = hpColon >= 0 ? hostPort.substring(0, hpColon) : hostPort;
const port = hpColon >= 0 ? parseInt(hostPort.substring(hpColon + 1)) : 5432;

async function main() {
  // Connect to 'postgres' maintenance database
  const pool = new Pool({
    host, port, user, password: pass, database: 'postgres'
  });

  try {
    // Drop master database
    try {
      await pool.query('DROP DATABASE IF EXISTS "' + dbName + '" WITH (FORCE)');
      console.log('  Master database "' + dbName + '" dropped.');
    } catch (e) {
      console.log('  Master database drop skipped: ' + e.message);
    }

    // Find and drop all tenant databases
    const res = await pool.query(
      "SELECT datname FROM pg_database WHERE datname LIKE 'educandow_%' OR datname = 'educandow_test'"
    );
    for (const row of res.rows) {
      try {
        await pool.query('DROP DATABASE IF EXISTS "' + row.datname + '" WITH (FORCE)');
        console.log('  Tenant "' + row.datname + '" dropped.');
      } catch (e) {
        console.log('  Tenant "' + row.datname + '" drop skipped: ' + e.message);
      }
    }
    if (res.rows.length === 0) {
      console.log('  No tenant databases found.');
    }
  } finally {
    await pool.end();
  }
  console.log('  All databases processed.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
'@ | Out-File -FilePath $dropScript -Encoding UTF8

        Set-Location $apiDir
        node $dropScript
        $dropOk = ($LASTEXITCODE -eq 0)
        Remove-Item $dropScript -Force -ErrorAction SilentlyContinue
        
        if (-not $dropOk) {
            Write-Host "  WARNING: DB drop via Node.js failed, continuing anyway..." -ForegroundColor Yellow
        }
    }
}

# ── 4. Limpiar proyecto ──────────────────────────────────────────────────
Write-Host "[4/8] Cleaning project directory..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR

# Stop any node processes on port 3001
$proc = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($proc) {
    Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
}

# Delete build artifacts
Remove-Item -Recurse -Force api\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force api\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force web\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force web\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force packages\domain\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force packages\domain\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force api\uploads -ErrorAction SilentlyContinue

Write-Host "  Project cleaned." -ForegroundColor Green

# ── 5. Git pull (asegurar ultima version) ─────────────────────────────────
Write-Host "[5/8] Pulling latest code..." -ForegroundColor Yellow
git fetch origin
git reset --hard origin/main
Write-Host "  Code up to date." -ForegroundColor Green

# ── 6. Instalar dependencias ──────────────────────────────────────────────
Write-Host "[6/8] Installing dependencies (this will take a while)..." -ForegroundColor Yellow
pnpm install --no-frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pnpm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── 7. Full deploy ────────────────────────────────────────────────────────
Write-Host "[7/8] Running full deploy..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
.\deploy\deploy.ps1

Write-Host ""
Write-Host "=== RESET COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "ROOT credentials:"
Write-Host "  Email:    $($env:ROOT_EMAIL ?? '(definido en ROOT_EMAIL de tu .env)')"
# La contraseña nunca se imprime en texto plano
Write-Host "  Password: (la definida en ROOT_PASSWORD en tu .env)"
Write-Host ""
