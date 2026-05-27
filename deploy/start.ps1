# =============================================================================
# EducandoW — Start API only (no rebuild)
# Run from C:\EducandoW
# =============================================================================
$ErrorActionPreference = "Stop"
$PROJECT_DIR = "C:\EducandoW"
$API_NAME = "educandow-api"
$API_PORT = 3001

Write-Host "=== EducandoW API Start ===" -ForegroundColor Cyan

# ── 1. Stop previous instance ────────────────────────────────────────────
Write-Host "[1/4] Stopping previous API..." -ForegroundColor Yellow
pm2 delete $API_NAME -s 2>$null
Write-Host "  Stopped." -ForegroundColor Green

# ── 2. Verify build exists ──────────────────────────────────────────────
Write-Host "[2/4] Verifying build..." -ForegroundColor Yellow
if (-not (Test-Path "$PROJECT_DIR\api\dist\src\main.js")) {
    Write-Host "  ERROR: api\dist\src\main.js not found. Run deploy.ps1 first." -ForegroundColor Red
    exit 1
}
Write-Host "  Build found." -ForegroundColor Green

# ── 3. Setup workspace link ─────────────────────────────────────────────
Write-Host "[3/4] Fixing workspace link..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $PROJECT_DIR\node_modules\@educandow\domain -ErrorAction SilentlyContinue
if (Test-Path "$PROJECT_DIR\packages\domain\dist") {
    New-Item -ItemType Junction -Path $PROJECT_DIR\node_modules\@educandow\domain -Target $PROJECT_DIR\packages\domain -Force | Out-Null
    Write-Host "  Junction created." -ForegroundColor Green
}

# ── 4. Start with pm2 ────────────────────────────────────────────────────
Write-Host "[4/4] Starting API on port $API_PORT..." -ForegroundColor Yellow
Set-Location $PROJECT_DIR
pm2 start api\dist\src\main.js --name $API_NAME --env production
pm2 save

Write-Host "" -ForegroundColor Cyan
Write-Host "=== API Started ===" -ForegroundColor Green
Write-Host ""
Write-Host "  pm2 status:    pm2 status"
Write-Host "  pm2 logs:      pm2 logs $API_NAME"
Write-Host "  Health:        http://localhost:$API_PORT/v1/auth/health"
Write-Host ""
Write-Host "To run on boot:  npm install -g pm2-windows-service && pm2-service-install"
Write-Host ""
