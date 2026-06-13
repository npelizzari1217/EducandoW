# validate-deploy.ps1 - Validacion read-only post-deploy: login ROOT + GETs de grupos.
# No modifica datos. Password/token nunca se imprimen.
param([string]$InstId = "81de34f4-e5ae-4b0f-b83e-8c9fe7e69d27")

$ErrorActionPreference = "Stop"
$base    = "http://localhost:3001/v1"
$envFile = "C:\EducandoW\api\.env"

function Get-EnvVar($name) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$name=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^$name=", "").Trim().Trim('"')
}

$email = Get-EnvVar "ROOT_EMAIL"; if (-not $email) { $email = "npelizzari@gmail.com" }
$pass  = Get-EnvVar "ROOT_PASSWORD"
if (-not $pass) { Write-Error "ROOT_PASSWORD no encontrado en env"; exit 1 }

# 1) Login
$loginBody = @{ email = $email; password = $pass } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $login.data.accessToken
Write-Host ("LOGIN OK - roles: {0}" -f ($login.data.user.roles -join ","))
$headers = @{ Authorization = "Bearer $token" }

# 2) GET /course-cycles (smoke)
$cc = Invoke-RestMethod -Uri "$base/course-cycles?institutionId=$InstId" -Headers $headers
$ccCount = if ($cc.data) { $cc.data.Count } else { 0 }
Write-Host ("GET /course-cycles -> {0} items" -f $ccCount)

# 3) GET /grupos (global con scope por rol)
$grupos = Invoke-RestMethod -Uri "$base/grupos?institutionId=$InstId" -Headers $headers
$gCount = if ($grupos.data) { $grupos.data.Count } else { 0 }
Write-Host ("GET /grupos -> {0} grupos" -f $gCount)

# 4) Si hay grupos, validar GET /grupos/:id/alumnos (shape id,studentId,studentName)
if ($gCount -gt 0) {
  $g0 = $grupos.data[0]
  $al = Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos?institutionId=$InstId" -f $g0.id) -Headers $headers
  $aCount = if ($al.data) { $al.data.Count } else { 0 }
  $sample = if ($aCount -gt 0) { ($al.data | Select-Object -First 1 | ConvertTo-Json -Compress) } else { "(grupo sin alumnos)" }
  Write-Host ("GET /grupos/{0}/alumnos -> {1} alumnos; shape: {2}" -f $g0.id, $aCount, $sample)
  Write-Host ("PROBE-GRUPO-ID={0}" -f $g0.id)
} else {
  Write-Host "SIN-GRUPOS: no hay grupos en prod; el DELETE no se puede probar sin crear escenario."
}
Write-Host "VALIDACION READ-ONLY COMPLETA"
