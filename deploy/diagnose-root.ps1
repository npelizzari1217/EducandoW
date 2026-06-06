# =============================================================================
# EducandoW — Diagnostic: check ROOT user in master database
# Run from C:\EducandoW
# =============================================================================

$ErrorActionPreference = "Stop"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Resolve-Path "$SCRIPT_DIR\.."
$API_DIR = "$PROJECT_DIR\api"

# Load .env
$envFile = Join-Path $API_DIR ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env not found at $envFile" -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
        $parts = $line.Split("=", 2)
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

# Verificamos que las variables de entorno necesarias estén disponibles.
# El .env ya fue cargado más arriba, así que ROOT_EMAIL y ROOT_PASSWORD
# deben estar definidas en ese archivo.
$rootEmail = $env:ROOT_EMAIL
if (-not $rootEmail) {
    Write-Host "ERROR: ROOT_EMAIL no está definido en .env ni en el entorno." -ForegroundColor Red
    exit 1
}

# Escribimos el script de diagnóstico usando variables de entorno de Node para la password.
# El email se inyecta en tiempo de escritura (ya viene del .env cargado arriba).
# La password NUNCA se escribe en el archivo temporal; Node la lee de process.env.ROOT_PASSWORD.
$tempScript = Join-Path $API_DIR "diagnose-user-temp.js"

@"
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

(async () => {
  const prisma = new PrismaClient();

  // Email inyectado desde ROOT_EMAIL (cargado del .env por el script de PowerShell)
  const targetEmail = '$rootEmail';
  // Password leída de la variable de entorno para no hardcodear ningún secreto
  const rootPassword = process.env.ROOT_PASSWORD;

  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    console.log('RESULT: USER NOT FOUND in database');
    await prisma.\`$disconnect();
    process.exit(1);
  }

  console.log('RESULT: User EXISTS');
  console.log('  Email:    ' + user.email);
  console.log('  Name:     ' + user.name);
  console.log('  Active:   ' + user.active);
  console.log('  Deleted:  ' + (user.deletedAt || 'null'));
  console.log('  Roles:    ' + (user.userRoles || []).map(r => r.role?.name).join(', '));
  console.log('  Hash:     ' + user.passwordHash.substring(0, 40) + '...');

  if (rootPassword) {
    const match = await bcrypt.compare(rootPassword, user.passwordHash);
    console.log('  Password: ' + (match ? 'MATCH' : 'MISMATCH'));
  } else {
    console.log('  Password: (ROOT_PASSWORD no definida en entorno — omitiendo verificación bcrypt)');
  }

  await prisma.\`$disconnect();
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
"@ | Out-File -FilePath $tempScript -Encoding UTF8

Set-Location $API_DIR
node $tempScript
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
