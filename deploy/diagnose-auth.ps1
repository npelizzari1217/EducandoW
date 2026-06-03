# =============================================================================
# EducandoW — Auth Diagnostic Script
# Ejecutar en el VPS: powershell -File diagnose-auth.ps1
# =============================================================================

$ErrorActionPreference = "Continue"
$API_DIR = "C:\EducandoW\api"

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  EducandoW - Diagnostico de Autenticacion" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Leer variables de entorno ─────────────────────────────────
Write-Host "[1/6] Leyendo variables de entorno..." -ForegroundColor Yellow
$envFile = "$API_DIR\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
    Write-Host "  .env cargado desde $envFile" -ForegroundColor Green
} else {
    Write-Host "  WARN: .env NO encontrado en $envFile" -ForegroundColor Red
}

$MASTER_URL = [Environment]::GetEnvironmentVariable("MASTER_DATABASE_URL", "Process")
if (-not $MASTER_URL) { $MASTER_URL = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process") }
if (-not $MASTER_URL) { $MASTER_URL = "postgresql://postgres:postgres@localhost:5433/educandow_master" }
Write-Host "  MASTER_DATABASE_URL: $MASTER_URL" -ForegroundColor Gray

# Parse connection string
if ($MASTER_URL -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $DB_USER   = $matches[1]
    $DB_PASS   = $matches[2]
    $DB_HOST   = $matches[3]
    $DB_PORT   = $matches[4]
    $DB_NAME   = $matches[5]
} else {
    Write-Host "  ERROR: No se pudo parsear DATABASE_URL" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ── 2. Testear conectividad a PostgreSQL ───────────────────────
Write-Host "[2/6] Testeando conectividad a PostgreSQL..." -ForegroundColor Yellow
$env:PGPASSWORD = $DB_PASS
$pgResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT 1 AS connected;" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Conectado a $DB_HOST`:$DB_PORT/$DB_NAME" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] No se pudo conectar a PostgreSQL:" -ForegroundColor Red
    Write-Host "     $pgResult" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Esta corriendo PostgreSQL? Verifica con:" -ForegroundColor Yellow
    Write-Host "    Get-Service postgresql*" -ForegroundColor Gray
    Write-Host "    netstat -ano | findstr $DB_PORT" -ForegroundColor Gray
    exit 1
}

# ── 3. Verificar si el usuario existe ──────────────────────────
Write-Host "[3/6] Buscando usuario npelizzari@gmail.com..." -ForegroundColor Yellow
$userQuery = "SELECT id, email, name, active, password, institution_id, created_at FROM users WHERE email = 'npelizzari@gmail.com' AND deleted_at IS NULL;"

$userResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -F "|||" -c $userQuery 2>&1

if (-not $userResult -or $userResult -match '\(0 rows?\)') {
    Write-Host "  [FAIL] USUARIO NO ENCONTRADO" -ForegroundColor Red
    Write-Host ""
    Write-Host "  La base de datos NO fue seedeada (o se borro el usuario)." -ForegroundColor Yellow
    Write-Host ""
    
    # ── 4. Verificar si el seed se ejecuto (chequear roles) ───
    Write-Host "[4/6] Se ejecuto el seed? Verificando tabla roles..." -ForegroundColor Yellow
    $roleCount = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -c "SELECT COUNT(*) FROM roles;" 2>&1
    Write-Host "  Roles en la DB: $roleCount" -ForegroundColor $(if ($roleCount -gt 0) { "Green" } else { "Red" })
    
    Write-Host ""
    Write-Host "  ===================================================" -ForegroundColor Cyan
    Write-Host "  ACCION REQUERIDA: Ejecutar el seed" -ForegroundColor Cyan
    Write-Host "  ===================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  cd $API_DIR" -ForegroundColor White
    Write-Host "  pnpm prisma:seed" -ForegroundColor White
    Write-Host ""
    Write-Host "  Despues de seedear, la contrasena sera: ***REMOVED***" -ForegroundColor Yellow
    exit 1
}

# Parsear resultado usando triple pipe como separador
$fields = $userResult -split '\|\|\|'
$userId        = $fields[0]
$email         = $fields[1]
$name          = $fields[2]
$active        = $fields[3]
$passwordHash  = $fields[4]
$instId        = $fields[5]
$created       = $fields[6]

Write-Host "  [OK] Usuario encontrado:" -ForegroundColor Green
Write-Host "     ID:           $userId" -ForegroundColor Gray
Write-Host "     Email:        $email" -ForegroundColor Gray
Write-Host "     Nombre:       $name" -ForegroundColor Gray
if ($active -eq 'true') {
    Write-Host "     Activo:       true" -ForegroundColor Green
} else {
    Write-Host "     Activo:       false  <-- INACTIVO!" -ForegroundColor Red
}
if ($instId) {
    Write-Host "     Institucion:  $instId" -ForegroundColor Gray
} else {
    Write-Host "     Institucion:  (ROOT - sin institucion)" -ForegroundColor Gray
}
Write-Host "     Creado:       $created" -ForegroundColor Gray

if ($active -ne 'true') {
    Write-Host ""
    Write-Host "  WARN: El usuario esta INACTIVO (active=false)" -ForegroundColor Red
    Write-Host "  Ejecuta en psql para activarlo:" -ForegroundColor Yellow
    Write-Host "    UPDATE users SET active = true WHERE email = 'npelizzari@gmail.com';" -ForegroundColor White
}

# ── 5. Testear bcrypt compare con Node.js ──────────────────────
Write-Host ""
Write-Host "[5/6] Testeando bcrypt.compare en el VPS..." -ForegroundColor Yellow

$hashTrimmed = $passwordHash.Trim()

# Write a temp JS file instead of inline (avoids encoding issues)
$tempJs = "$env:TEMP\bcrypt_test.js"
@"
const bcrypt = require('bcrypt');
const hash = '$hashTrimmed';
const passwords = ['***REMOVED***', 'Admin123!', 'admin123', 'password'];
let anyMatch = false;
for (const pw of passwords) {
    const result = bcrypt.compareSync(pw, hash);
    const icon = result ? 'MATCH' : 'NO MATCH';
    console.log('  [' + icon + ']  "' + pw + '"');
    if (result) anyMatch = true;
}
if (!anyMatch) {
    console.log('');
    console.log('  WARN: NINGUNA de las contrasenas probadas matchea.');
    console.log('  La contrasena en la DB es distinta a las esperadas.');
} else {
    console.log('');
    console.log('  Usa la marcada con MATCH para loguearte.');
}
"@ | Out-File -FilePath $tempJs -Encoding ASCII

Set-Location $API_DIR
$nodeResult = node $tempJs 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host $nodeResult
} else {
    Write-Host "  WARN: No se pudo ejecutar bcrypt (npm install ejecutado?):" -ForegroundColor Yellow
    Write-Host "     $nodeResult" -ForegroundColor Red
}
Remove-Item $tempJs -ErrorAction SilentlyContinue

# ── 6. Resumen y proximos pasos ────────────────────────────────
Write-Host ""
Write-Host "[6/6] Chequeos adicionales..." -ForegroundColor Yellow

# Check if API is running
try {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost:3001/v1/health" -TimeoutSec 3 -UseBasicParsing
    Write-Host "  [OK] API responde en puerto 3001" -ForegroundColor Green
} catch {
    Write-Host "  WARN: API no responde en http://localhost:3001/v1/health" -ForegroundColor Yellow
}

# Check user roles
$roleQuery = "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = '$userId';"
$userRoles = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -c $roleQuery 2>&1
if ($userRoles) {
    Write-Host "  Roles del usuario: $userRoles" -ForegroundColor Gray
} else {
    Write-Host "  WARN: El usuario NO tiene roles asignados" -ForegroundColor Red
}

# Check locked status
$lockQuery = "SELECT failed_attempts, locked_until FROM users WHERE email = 'npelizzari@gmail.com';"
$lockResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -F "|||" -c $lockQuery 2>&1
if ($lockResult) {
    $lockfields = $lockResult -split '\|\|\|'
    $attempts = $lockfields[0]
    $locked   = $lockfields[1]
    if ($attempts -gt 0) {
        Write-Host "  Failed attempts: $attempts" -ForegroundColor Yellow
    }
    if ($locked -and $locked -ne '') {
        Write-Host "  [FAIL] CUENTA BLOQUEADA hasta $locked" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  Diagnostico completo" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
