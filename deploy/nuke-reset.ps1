# =============================================================================
# EducandoW — NUKE RESET: borra TODO y reinstala desde cero
# ⚠️ DESTRUCTIVO — pierde todos los datos de la base de datos
# =============================================================================
param(
    [switch]$Force
)

if (-not $Force) {
    Write-Host "⚠️  ESTE SCRIPT BORRA TODA LA BASE DE DATOS Y REINSTALA DESDE CERO" -ForegroundColor Red
    Write-Host "    Esto incluye: master DB, todas las tenant DB, node_modules, builds" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Escribí 'BORRAR TODO' para confirmar"
    if ($confirm -ne "BORRAR TODO") {
        Write-Host "Cancelado." -ForegroundColor Yellow
        exit 0
    }
}

$ErrorActionPreference = "Stop"
$PROJECT_DIR = "C:\EducandoW"

Write-Host ""
Write-Host "=== NUKE RESET — EducandoW ===" -ForegroundColor Cyan
Write-Host ""

# ── 1. Detener pm2 ───────────────────────────────────────────────────────
Write-Host "[1/8] Stopping pm2..." -ForegroundColor Yellow
pm2 delete all -s 2>$null
pm2 kill -s 2>$null
Write-Host "  Stopped." -ForegroundColor Green

# ── 2. Cargar .env para obtener credenciales de DB ────────────────────────
Write-Host "[2/8] Loading database credentials..." -ForegroundColor Yellow
$envFile = Join-Path $PROJECT_DIR "api" ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "  WARNING: .env not found, skipping DB drop." -ForegroundColor Yellow
} else {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $value = $parts[1].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }

    if ($env:MASTER_DATABASE_URL) {
        # Extraer host, puerto, usuario del MASTER_DATABASE_URL
        # Formato: postgresql://user:pass@host:port/dbname
        $url = $env:MASTER_DATABASE_URL -replace '^postgresql://', ''
        $userPass, $hostPortDb = $url.Split('@')
        $user, $pass = $userPass.Split(':')
        $hostPort, $dbName = $hostPortDb.Split('/')
        $host, $port = $hostPort.Split(':')
        if (-not $port) { $port = "5432" }

        Write-Host "  DB Host: $host`:$port" -ForegroundColor Gray
        Write-Host "  DB User: $user" -ForegroundColor Gray
        Write-Host "  DB Name: $dbName" -ForegroundColor Gray

        # ── 3. Dropear base maestra ────────────────────────────────────────
        Write-Host "[3/8] Dropping master database '$dbName'..." -ForegroundColor Yellow
        $env:PGPASSWORD = $pass
        $dropResult = & psql -h $host -p $port -U $user -d postgres -c "DROP DATABASE IF EXISTS `"$dbName`" WITH (FORCE);" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  WARNING: psql drop failed: $dropResult" -ForegroundColor Yellow
            Write-Host "  If psql is not installed, install PostgreSQL client tools or drop manually."
        } else {
            Write-Host "  Master database dropped." -ForegroundColor Green
        }

        # ── 4. Dropear bases tenant ────────────────────────────────────────
        Write-Host "[4/8] Finding and dropping tenant databases..." -ForegroundColor Yellow
        $tenantResult = & psql -h $host -p $port -U $user -d postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE 'educandow_%' OR datname = 'educandow_test';" 2>&1
        if ($LASTEXITCODE -eq 0 -and $tenantResult) {
            $tenantDbs = $tenantResult -split '\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }
            foreach ($tdb in $tenantDbs) {
                Write-Host "  Dropping '$tdb'..." -ForegroundColor Gray
                & psql -h $host -p $port -U $user -d postgres -c "DROP DATABASE IF EXISTS `"$tdb`" WITH (FORCE);" 2>&1 | Out-Null
            }
            Write-Host "  Tenant databases dropped." -ForegroundColor Green
        } else {
            Write-Host "  No tenant databases found or psql not available." -ForegroundColor Yellow
        }
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

# ── 5. Limpiar proyecto ──────────────────────────────────────────────────
Write-Host "[5/8] Cleaning project directory..." -ForegroundColor Yellow
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

# ── 6. Git pull (asegurar última versión) ─────────────────────────────────
Write-Host "[6/8] Pulling latest code..." -ForegroundColor Yellow
git fetch origin
git reset --hard origin/main
Write-Host "  Code up to date." -ForegroundColor Green

# ── 7. Instalar dependencias ──────────────────────────────────────────────
Write-Host "[7/8] Installing dependencies (this will take a while)..." -ForegroundColor Yellow
pnpm install --no-frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pnpm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── 8. Full deploy ────────────────────────────────────────────────────────
Write-Host "[8/8] Running full deploy..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
.\deploy\deploy.ps1

Write-Host ""
Write-Host "=== RESET COMPLETE ===" -ForegroundColor Green
Write-Host ""
Write-Host "ROOT credentials:"
Write-Host "  Email:    npelizzari@gmail.com"
Write-Host "  Password: ***REMOVED***"
Write-Host ""
