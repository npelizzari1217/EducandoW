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
# Restore original workspace file
Set-Content -Path $workspaceFile -Value $originalYaml
Write-Host "  Dependencies installed." -ForegroundColor Green

# ── 5. Build domain ─────────────────────────────────────────────────────
Write-Host "[5/10] Building domain..." -ForegroundColor Yellow
pnpm --filter "@educandow/domain" run build

# Fix workspace dependency resolution for Windows
Remove-Item -Recurse -Force node_modules\@educandow\domain -ErrorAction SilentlyContinue
New-Item -ItemType Junction -Path node_modules\@educandow\domain -Target packages\domain -Force | Out-Null
Write-Host "  Domain built." -ForegroundColor Green

# ── 6. Prisma generate ──────────────────────────────────────────────────
Write-Host "[6/10] Generating Prisma clients..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm run prisma:generate
Set-Location $PROJECT_DIR
Write-Host "  Prisma clients ready." -ForegroundColor Green

# ── 7. Build API ────────────────────────────────────────────────────────
Write-Host "[7/10] Building API..." -ForegroundColor Yellow
pnpm --filter api run build
Write-Host "  API built." -ForegroundColor Green

# ── 8. Bootstrap master DB (new server) + migrate ────────────────────────
Write-Host "[8/10] Bootstrapping master database..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm bootstrap
Set-Location $PROJECT_DIR
Write-Host "  Master database ready." -ForegroundColor Green

# ── 8b. Migrate all tenant databases ────────────────────────────────────
Write-Host "[8b/10] Migrating all tenant databases..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR\api
pnpm migrate-tenants
Set-Location $PROJECT_DIR
Write-Host "  Tenant migrations complete." -ForegroundColor Green

# ── 9. Start API with pm2 ──────────────────────────────────────────────
Write-Host "[9/10] Starting API..." -ForegroundColor Yellow
pm2 start $PROJECT_DIR\api\dist\main.js --name $API_NAME --env production
pm2 save
Write-Host "  API started on port $API_PORT." -ForegroundColor Green

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

    # Copy proxy config to wwwroot
    Copy-Item -Force deploy\iis-proxy.web.config $WWWROOT\web.config

    Write-Host "  IIS configured." -ForegroundColor Green
}

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host "" -ForegroundColor Cyan
Write-Host "=== Deploy Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "  API:           http://localhost:$API_PORT/v1"
Write-Host "  Health:        http://localhost:$API_PORT/v1/health"
Write-Host "  Swagger:       http://localhost:$API_PORT/docs"
Write-Host "  pm2 status:    pm2 status"
Write-Host "  pm2 logs:      pm2 logs $API_NAME"
Write-Host ""
