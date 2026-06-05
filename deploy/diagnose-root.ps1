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

# Write diagnostic script (single-quoted here-string to avoid PS variable expansion)
$tempScript = Join-Path $API_DIR "diagnose-user-temp.js"

@'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

(async () => {
  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({
    where: { email: 'npelizzari@gmail.com' },
    include: { userRoles: { include: { role: true } } },
  });

  if (!user) {
    console.log('RESULT: USER NOT FOUND in database');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('RESULT: User EXISTS');
  console.log('  Email:    ' + user.email);
  console.log('  Name:     ' + user.name);
  console.log('  Active:   ' + user.active);
  console.log('  Deleted:  ' + (user.deletedAt || 'null'));
  console.log('  Roles:    ' + (user.userRoles || []).map(r => r.role?.name).join(', '));
  console.log('  Hash:     ' + user.passwordHash.substring(0, 40) + '...');

  const match = await bcrypt.compare('***REMOVED***', user.passwordHash);
  console.log('  Password: ' + (match ? 'MATCH' : 'MISMATCH'));

  await prisma.$disconnect();
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
'@ | Out-File -FilePath $tempScript -Encoding UTF8

Set-Location $API_DIR
node $tempScript
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
