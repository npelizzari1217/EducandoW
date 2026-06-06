# =============================================================================
# EducandoW — Create ROOT user in master database
# =
# Usage:
#   .\deploy\create-root.ps1
#   .\deploy\create-root.ps1 -Email "otro@email.com" -Password "OtraPass123"
# =============================================================================
# Email y Password son obligatorios. Si no se pasan como argumento, se leen de las
# variables de entorno ROOT_EMAIL y ROOT_PASSWORD. Si ninguna fuente los provee,
# el script falla de forma explícita (fail-fast).
param(
    [string]$Email = $env:ROOT_EMAIL,
    [string]$Password = $env:ROOT_PASSWORD,
    [string]$Role = "ROOT"
)

if (-not $Email) {
    Write-Host "ERROR: Falta el email ROOT. Pasalo con -Email o definí ROOT_EMAIL en el entorno." -ForegroundColor Red
    exit 1
}
if (-not $Password) {
    Write-Host "ERROR: Falta la contraseña ROOT. Pasala con -Password o definí ROOT_PASSWORD en el entorno." -ForegroundColor Red
    exit 1
}

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Resolve-Path "$SCRIPT_DIR\.."
$API_DIR = "$PROJECT_DIR\api"

Write-Host "=== Create ROOT User ===" -ForegroundColor Cyan

# ── 1. Load .env ──────────────────────────────────────────────────────────
$envFile = Join-Path $API_DIR ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env not found at $envFile" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if (-not (Test-Path "env:$key")) {
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

if (-not $env:MASTER_DATABASE_URL) {
    Write-Host "ERROR: MASTER_DATABASE_URL not found in .env" -ForegroundColor Red
    exit 1
}

# ── 2. Write temp Node.js script ──────────────────────────────────────────
$tempScript = Join-Path $API_DIR "create-root-temp.js"

@'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const EMAIL = process.env.USER_EMAIL;
const PASSWORD = process.env.USER_PASSWORD;
const ROLE_NAME = process.env.USER_ROLE;

async function main() {
  const prisma = new PrismaClient();

  console.log('Ensuring role exists...');
  const role = await prisma.role.upsert({
    where: { name: ROLE_NAME },
    create: {
      id: 'r-root',
      name: ROLE_NAME,
      description: 'Super administrador — acceso total',
    },
    update: {},
  });
  console.log('  Role "' + ROLE_NAME + '" ready.');

  console.log('Processing user...');
  const hashed = await bcrypt.hash(PASSWORD, 12);

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { email: EMAIL },
      data: { passwordHash: hashed, name: ROLE_NAME },
    });
    console.log('  User UPDATED (already existed).');
  } else {
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: hashed,
        name: ROLE_NAME,
        userRoles: { create: { roleId: role.id } },
      },
    });
    console.log('  User CREATED.');
  }

  // Re-ensure role assignment
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });

  await prisma.$disconnect();

  console.log('');
  console.log('══ ROOT USER READY ══');
  console.log('  Email:    ' + EMAIL);
  console.log('  Password: ' + PASSWORD);
  console.log('  Role:     ' + ROLE_NAME);
  console.log('══════════════════════');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
'@ | Out-File -FilePath $tempScript -Encoding UTF8

# ── 3. Execute script ─────────────────────────────────────────────────────
Write-Host "Executing..." -ForegroundColor Yellow
Set-Location $API_DIR
$env:USER_EMAIL = $Email
$env:USER_PASSWORD = $Password
$env:USER_ROLE = $Role
node $tempScript

if ($LASTEXITCODE -ne 0) {
    Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
    Write-Host "ERROR: Failed to create ROOT user." -ForegroundColor Red
    exit 1
}

# ── 4. Cleanup ────────────────────────────────────────────────────────────
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Green
