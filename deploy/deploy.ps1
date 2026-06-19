# =============================================================================
# EducandoW — Full deploy to Windows Server + IIS
# Run as Administrator from C:\EducandoW
# =============================================================================
param(
    [switch]$SkipBuild,
    [switch]$SkipIIS
)

$ErrorActionPreference = "Stop"
$API_PORT = 3001
$PROJECT_DIR = "C:\EducandoW"
$WWWROOT = "C:\inetpub\wwwroot"
$API_NAME = "educandow-api"

Write-Host "=== EducandoW Deploy ===" -ForegroundColor Cyan

# ── 1. Stop previous API ─────────────────────────────────────────────────
Write-Host "[1/10] Stopping previous API..." -ForegroundColor Yellow
pm2 delete $API_NAME -s 2>$null
# Stop the NSSM Windows service too. If the node process keeps running it holds
# a lock on node_modules\.prisma\client\query_engine-windows.dll.node, and step 6
# (prisma generate) then fails with EPERM. pm2 delete is a no-op now (we use NSSM).
Stop-Service -Name $API_NAME -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Stopped." -ForegroundColor Green

# ── 2. Ensure pnpm ───────────────────────────────────────────────────────
Write-Host "[2/10] Checking pnpm..." -ForegroundColor Yellow
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmVersion = if ($pnpm) { & pnpm --version 2>$null }
if ($pnpmVersion -and ($pnpmVersion -replace '\s','') -notmatch '^9\.') {
    Write-Host "  Found incompatible pnpm $pnpmVersion. Removing and reinstalling v9..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$env:LOCALAPPDATA\pnpm" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$env:APPDATA\npm\node_modules\pnpm" -ErrorAction SilentlyContinue
    npm uninstall -g pnpm --silent 2>$null
    npm install -g pnpm@9.15.4
}
elseif (-not $pnpm) {
    Write-Host "  Installing pnpm@9.15.4 globally..." -ForegroundColor Yellow
    npm install -g pnpm@9.15.4
}
$finalVersion = & pnpm --version 2>$null
Write-Host "  pnpm $finalVersion ready." -ForegroundColor Green

# ── 3. Clean previous builds ─────────────────────────────────────────────
Write-Host "[3/10] Cleaning old builds..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force api\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force api\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force web\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force web\node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force packages\domain\dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force packages\domain\node_modules -ErrorAction SilentlyContinue
Write-Host "  Cleaned." -ForegroundColor Green

# ── 4. Install dependencies ──────────────────────────────────────────────
Write-Host "[4/10] Installing dependencies..." -ForegroundColor Yellow
# Strip mobile from workspace (Expo is not needed on VPS)
$workspaceFile = "$PROJECT_DIR\pnpm-workspace.yaml"
$originalYaml = Get-Content $workspaceFile -Raw
$fixedYaml = $originalYaml -replace '^\s*-\s*"mobile"\s*$', '# - "mobile" (disabled for VPS)'
if ($fixedYaml -ne $originalYaml) {
    Set-Content -Path $workspaceFile -Value $fixedYaml
}
pnpm install
$pnpmExit = $LASTEXITCODE
# Restore original workspace file
Set-Content -Path $workspaceFile -Value $originalYaml
if ($pnpmExit -ne 0) { Write-Host "  ERROR: pnpm install failed (exit $pnpmExit)" -ForegroundColor Red; exit 1 }
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── 4b. Install global build tools (nest CLI + tsx) ───────────────────────
# Con node-linker=hoisted (.npmrc) pnpm crea los node_modules/.bin locales en
# Windows, asi que typescript ya NO se necesita global (se usa el local 5.9.3).
Write-Host "[4b/10] Ensuring global nest CLI + tsx (fallback)..." -ForegroundColor Yellow
# Run via cmd so npm's stderr (e.g. an update "npm notice") cannot trip
# $ErrorActionPreference='Stop' as a NativeCommandError and abort the deploy.
# >nul 2>&1 swallows both streams; this step is a non-critical fallback.
cmd /c "npm install -g @nestjs/cli tsx >nul 2>&1"
Write-Host "  Global tools ready (nest, tsx)." -ForegroundColor Green

# ── 5. Build domain ─────────────────────────────────────────────────────
Write-Host "[5/10] Building domain..." -ForegroundColor Yellow
pnpm --filter "@educandow/domain" run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: domain build failed" -ForegroundColor Red; exit 1 }

# Fix workspace dependency resolution for Windows
Remove-Item -Recurse -Force node_modules\@educandow\domain -ErrorAction SilentlyContinue
New-Item -ItemType Junction -Path node_modules\@educandow\domain -Target packages\domain -Force | Out-Null
Write-Host "  Domain built." -ForegroundColor Green

# ── 6. Prisma generate ──────────────────────────────────────────────────
Write-Host "[6/10] Generating Prisma clients..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm run prisma:generate
if ($LASTEXITCODE -ne 0) { Set-Location $PROJECT_DIR; Write-Host "  ERROR: prisma generate failed" -ForegroundColor Red; exit 1 }
Set-Location $PROJECT_DIR
Write-Host "  Prisma clients ready." -ForegroundColor Green

# ── 7. Build API ────────────────────────────────────────────────────────
Write-Host "[7/10] Building API..." -ForegroundColor Yellow
pnpm --filter api run build
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: API build failed" -ForegroundColor Red; exit 1 }
Write-Host "  API built." -ForegroundColor Green

# ── 8. Bootstrap master DB (new server) + migrate ────────────────────────
Write-Host "[8/10] Bootstrapping master database..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm bootstrap
if ($LASTEXITCODE -ne 0) { Set-Location $PROJECT_DIR; Write-Host "  ERROR: bootstrap failed" -ForegroundColor Red; exit 1 }
Set-Location $PROJECT_DIR
Write-Host "  Master database ready." -ForegroundColor Green

# ── 8b. Migrate all tenant databases ────────────────────────────────────
Write-Host "[8b/10] Migrating all tenant databases..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm migrate-tenants
Set-Location $PROJECT_DIR
Write-Host "  Tenant migrations complete." -ForegroundColor Green

# ── 9. (Re)start API as a Windows service via NSSM ────────────────────────
# NSSM corre node dist\main.js como servicio Windows: sobrevive cierre de
# sesion SSH y reboots (pm2 no persistia bajo OpenSSH en este server).
Write-Host "[9/10] Starting API service..." -ForegroundColor Yellow
$nodeExe = (Get-Command node.exe).Source
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) { choco install nssm -y --no-progress | Out-Null; $nssm = "C:\ProgramData\chocolatey\bin\nssm.exe" }

if (-not (Get-Service $API_NAME -ErrorAction SilentlyContinue)) {
    & $nssm install $API_NAME $nodeExe "dist\main.js" | Out-Null
    & $nssm set $API_NAME AppDirectory "$PROJECT_DIR\api" | Out-Null
    & $nssm set $API_NAME AppStdout "$PROJECT_DIR\api\svc-out.log" | Out-Null
    & $nssm set $API_NAME AppStderr "$PROJECT_DIR\api\svc-err.log" | Out-Null
    & $nssm set $API_NAME Start SERVICE_AUTO_START | Out-Null
}

# Puppeteer (boletín PDF): el servicio corre sin HOME, así que Puppeteer busca
# Chrome en su cache (resuelve a system32) y falla. Apuntamos explícitamente al
# Chrome del sistema. Idempotente: se re-aplica en cada deploy y tras un rebuild.
$chromeExe = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (Test-Path $chromeExe) {
    & $nssm set $API_NAME AppEnvironmentExtra "PUPPETEER_EXECUTABLE_PATH=$chromeExe" | Out-Null
    Write-Host "  PUPPETEER_EXECUTABLE_PATH -> $chromeExe" -ForegroundColor Green
} else {
    Write-Host "  WARN: Chrome no encontrado en Program Files; el boletín PDF puede fallar." -ForegroundColor Yellow
}

if ((Get-Service $API_NAME).Status -eq 'Running') { Restart-Service $API_NAME } else { Start-Service $API_NAME }
Write-Host "  API service running on port $API_PORT." -ForegroundColor Green

# ── 10. Health check ─────────────────────────────────────────────────────
Write-Host "[10/10] Checking API health..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$API_PORT/v1/health" -TimeoutSec 10 -UseBasicParsing
    Write-Host "  API health check: $($response.StatusCode) OK" -ForegroundColor Green
} catch {
    Write-Host "  API health check failed: $_" -ForegroundColor Red
}

# ── Deploy IIS (optional) ───────────────────────────────────────────────
if (-not $SkipIIS) {
    Write-Host "" -ForegroundColor Cyan
    Write-Host "=== Deploying to IIS ===" -ForegroundColor Cyan

    # Build web
    Set-Location $PROJECT_DIR
    Write-Host "Building web..." -ForegroundColor Yellow
    pnpm --filter web run build
    if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: web build failed" -ForegroundColor Red; exit 1 }
    Write-Host "  Web built." -ForegroundColor Green

    # Copy web dist
    $webDest = "$WWWROOT\educandow"
    Write-Host "Copying web to $webDest..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $webDest -ErrorAction SilentlyContinue
    Copy-Item -Recurse web\dist $webDest

    # Copy SPA web.config
    Copy-Item -Force web\public\web.config $webDest\web.config

    # Create IIS Application
    Import-Module WebAdministration
    Remove-WebApplication -Name educandow -Site "Default Web Site" -ErrorAction SilentlyContinue
    New-WebApplication -Name educandow -Site "Default Web Site" -PhysicalPath $webDest -ApplicationPool DefaultAppPool -Force

    # NOTA: el Default Web Site apunta su PhysicalPath a $webDest (wwwroot\educandow),
    # asi que web\public\web.config (copiado arriba) ES el config del sitio raiz y
    # ya contiene la regla de proxy /v1 + el fallback SPA. NO se copia nada a
    # $WWWROOT\web.config (no es la raiz del sitio y duplicaria reglas).

    Write-Host "  IIS configured." -ForegroundColor Green
}

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host "" -ForegroundColor Cyan
Write-Host "=== Deploy Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "  API:           http://localhost:$API_PORT/v1"
Write-Host "  Health:        http://localhost:$API_PORT/v1/health"
Write-Host "  Swagger:       http://localhost:$API_PORT/docs"
Write-Host "  Service:       Get-Service $API_NAME"
Write-Host "  Logs:          Get-Content $PROJECT_DIR\api\svc-err.log -Tail 40"
Write-Host "  Restart:       Restart-Service $API_NAME"
Write-Host ""
