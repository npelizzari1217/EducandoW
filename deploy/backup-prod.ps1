# backup-prod.ps1 — Dump de todas las DBs de prod (master + test + tenants) antes de un deploy.
# Lee DATABASE_URL de api\.env, no imprime el secreto. Uso: powershell -NoProfile -File backup-prod.ps1 <tag>
param([string]$Tag = "predeploy")

$ErrorActionPreference = "Stop"
$envFile = "C:\EducandoW\api\.env"
$pgBin   = "C:\Program Files\PostgreSQL\16\bin"
$dir     = "C:\EducandoW\backups"

$line = Get-Content $envFile | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $line) { Write-Error "DATABASE_URL no encontrado en $envFile"; exit 1 }
$url = ($line -replace "^DATABASE_URL=", "").Trim().Trim('"')
$uri = [System.Uri]$url

$ui      = $uri.UserInfo
$pgUser  = [System.Uri]::UnescapeDataString($ui.Substring(0, $ui.IndexOf(":")))
$env:PGPASSWORD = [System.Uri]::UnescapeDataString($ui.Substring($ui.IndexOf(":") + 1))
$pgHost  = $uri.Host
$pgPort  = $uri.Port

$psql    = Join-Path $pgBin "psql.exe"
$pgdump  = Join-Path $pgBin "pg_dump.exe"
$stamp   = Get-Date -Format "yyyyMMdd-HHmmss"

$dbs = & $psql -h $pgHost -p $pgPort -U $pgUser -d postgres -t -A `
  -c "SELECT datname FROM pg_database WHERE datistemplate=false AND datname<>'postgres' ORDER BY datname;"

Write-Host "=== Backup prod ($Tag) @ $stamp -> $dir ===" -ForegroundColor Cyan
foreach ($db in $dbs) {
  $db = $db.Trim()
  if (-not $db) { continue }
  $out = Join-Path $dir "${db}_pre_${Tag}_${stamp}.dump"
  & $pgdump -h $pgHost -p $pgPort -U $pgUser -d $db -Fc -f $out
  if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump FALLO en $db"; exit 1 }
  $sz = (Get-Item $out).Length
  Write-Host ("OK  {0,-45} {1,10:N0} bytes" -f $db, $sz) -ForegroundColor Green
}
Write-Host "=== Backup completo ===" -ForegroundColor Cyan
