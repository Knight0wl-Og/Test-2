#Requires -Version 5.0
$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "TradeEdge Setup"

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host "   TradeEdge - Professional Trading Terminal " -ForegroundColor Cyan
Write-Host "  ============================================" -ForegroundColor Cyan
Write-Host ""

# ── Node.js check ───────────────────────────────────────────────────────────
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js not found." -ForegroundColor Red
    Write-Host "  Download from: https://nodejs.org" -ForegroundColor Yellow
    Start-Process "https://nodejs.org"
    Read-Host "Press Enter after installing Node.js, then run this script again"
    exit 1
}
Write-Host "[OK] Node.js $(node --version)" -ForegroundColor Green

# ── Install dependencies ────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] npm install failed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Dependencies installed." -ForegroundColor Green

# ── PostgreSQL setup (optional) ─────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Setting up database..." -ForegroundColor Yellow
if (Get-Command psql -ErrorAction SilentlyContinue) {
    psql -U postgres -c "CREATE USER tradeedge WITH PASSWORD 'tradeedge' CREATEDB;" 2>$null
    psql -U postgres -c "CREATE DATABASE tradeedge OWNER tradeedge;" 2>$null
    npm run db:migrate --workspace=backend 2>$null
    Write-Host "[OK] Database configured." -ForegroundColor Green
} else {
    Write-Host "[INFO] PostgreSQL not found — app will run with demo data." -ForegroundColor Yellow
    Write-Host "       Install from postgresql.org to enable watchlist persistence." -ForegroundColor DarkGray
}

# ── .env file ───────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Checking configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[OK] Created .env from .env.example" -ForegroundColor Green
} else {
    Write-Host "[OK] .env already exists." -ForegroundColor Green
}

# ── Windows Firewall (for Android access) ───────────────────────────────────
Write-Host ""
Write-Host "[4/4] Configuring Windows Firewall for Android access..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName "TradeEdge Backend" -ErrorAction SilentlyContinue
if (-not $rule) {
    try {
        New-NetFirewallRule -DisplayName "TradeEdge Backend" `
            -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow | Out-Null
        Write-Host "[OK] Firewall rule added (port 3001 open for Android)." -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not add firewall rule — run this script as Administrator for Android access." -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] Firewall rule already exists." -ForegroundColor Green
}

# ── Display connection info ──────────────────────────────────────────────────
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.PrefixOrigin -eq "Dhcp" } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor Cyan
Write-Host "  |  Backend API  :  http://localhost:3001           |" -ForegroundColor White
Write-Host "  |  Frontend     :  http://localhost:5173           |" -ForegroundColor White
if ($ip) {
Write-Host "  |  Android URL  :  http://${ip}:3001     |" -ForegroundColor Magenta
Write-Host "  |  (enter this in the Android app settings)        |" -ForegroundColor DarkGray
}
Write-Host "  +--------------------------------------------------+" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

npm run dev
