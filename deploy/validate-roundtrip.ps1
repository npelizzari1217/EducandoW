# validate-roundtrip.ps1 - Prueba neto-cero del boton "-" (DELETE alumno de grupo) en prod.
# Asigna un alumno candidato y lo quita; el grupo queda identico. Backup ya tomado.
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

$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{ email=$email; password=$pass } | ConvertTo-Json)
$H = @{ Authorization = "Bearer $($login.data.accessToken)" }
Write-Host "LOGIN OK"

# 1) grupo usable (con courseCycleId + materiaId)
$grupos = Invoke-RestMethod -Uri "$base/grupos?institutionId=$InstId" -Headers $H
$g = $grupos.data | Where-Object { $_.courseCycleId -and $_.materiaId } | Select-Object -First 1
if (-not $g) { Write-Host "NO-GRUPO usable"; exit 0 }
Write-Host ("GRUPO: {0} | materia={1} | alumnosCount(meta)={2}" -f $g.id, $g.subjectName, $g.alumnosCount)

# 2) BEFORE
$before = Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos?institutionId=$InstId" -f $g.id) -Headers $H
$beforeCount = @($before.data).Count
$assigned = @{}; @($before.data) | ForEach-Object { $assigned[$_.studentId] = $true }
Write-Host ("BEFORE: {0} alumnos en el grupo" -f $beforeCount)

# 3) candidato no asignado (universo de la materia)
$univ = Invoke-RestMethod -Uri ("$base/course-cycles/{0}/materias/{1}/alumnos?institutionId=$InstId" -f $g.courseCycleId, $g.materiaId) -Headers $H
$cand = @($univ.data) | Where-Object { -not $assigned[$_.studentId] } | Select-Object -First 1
if (-not $cand) { Write-Host "NO-CANDIDATO: todos los alumnos de la materia ya estan en el grupo; no toco datos reales."; exit 0 }
Write-Host ("CANDIDATO: {0} | axmId={1}" -f $cand.studentName, $cand.id)

# 4) POST add
Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos?institutionId=$InstId" -f $g.id) -Method Post -ContentType "application/json" -Body (@{ alumnosXMateriaXCursoXCicloId = $cand.id } | ConvertTo-Json) -Headers $H | Out-Null
$mid = Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos?institutionId=$InstId" -f $g.id) -Headers $H
$midCount = @($mid.data).Count
$new = @($mid.data) | Where-Object { $_.studentId -eq $cand.studentId } | Select-Object -First 1
Write-Host ("AFTER-ADD: {0} alumnos (esperado {1}) | newAxgId={2}" -f $midCount, ($beforeCount + 1), $new.id)
if (-not $new) { Write-Error "no se encontro el alumno agregado"; exit 1 }

# 5) DELETE (el boton "-")
Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos/{1}?institutionId=$InstId" -f $g.id, $new.id) -Method Delete -Headers $H | Out-Null
Write-Host "DELETE (boton -) -> OK"

# 6) AFTER: verificar neto-cero
$after = Invoke-RestMethod -Uri ("$base/grupos/{0}/alumnos?institutionId=$InstId" -f $g.id) -Headers $H
$afterCount = @($after.data).Count
$still = @($after.data) | Where-Object { $_.id -eq $new.id }
Write-Host ("AFTER-DELETE: {0} alumnos (esperado {1}) | removido-sigue-presente={2}" -f $afterCount, $beforeCount, [bool]$still)

if ($afterCount -eq $beforeCount -and -not $still) {
  Write-Host "RESULT: ROUND-TRIP OK - boton DELETE funciona, grupo quedo identico (neto-cero)."
} else {
  Write-Host ("RESULT: INCONSISTENTE - revisar. Si quedo de mas, axgId={0} (backup disponible)." -f $new.id)
}
