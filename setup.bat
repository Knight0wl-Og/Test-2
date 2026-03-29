@echo off
title TradeEdge Setup
color 0B
echo.
echo  ============================================
echo   TradeEdge - Professional Trading Terminal
echo  ============================================
echo.

:: Check Node.js
node --version >/dev/null 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo  Please download and install Node.js LTS from:
    echo  https://nodejs.org
    echo.
    echo  Then run this script again.
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo [OK] Node.js %%v

:: Install dependencies
echo.
echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: Database setup (optional)
echo.
echo [2/4] Setting up database...
psql --version >/dev/null 2>&1
if errorlevel 1 (
    echo [INFO] PostgreSQL not found - app will run with demo data.
    echo        To enable full features, install PostgreSQL from postgresql.org
    goto :create_env
)
psql -U postgres -c "CREATE USER tradeedge WITH PASSWORD 'tradeedge' CREATEDB;" 2>/dev/null
psql -U postgres -c "CREATE DATABASE tradeedge OWNER tradeedge;" 2>/dev/null
call npm run db:migrate --workspace=backend 2>/dev/null
echo [OK] Database ready.

:create_env
:: Create .env if missing
if not exist .env (
    echo.
    echo [3/4] Creating configuration file...
    copy .env.example .env >/dev/null
    echo [OK] Created .env from .env.example
) else (
    echo [3/4] Configuration file already exists.
)

:: Get local IP for Android reference
echo.
echo [4/4] Starting TradeEdge...
echo.
echo  +-----------------------------------------+
echo  ^|  Backend API : http://localhost:3001     ^|
echo  ^|  Frontend    : http://localhost:5173     ^|
echo  ^|                                          ^|
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    goto :show_android
)
:show_android
echo  ^|  Android URL : http://%LOCAL_IP:~1%:3001  ^|
echo  +-----------------------------------------+
echo.
echo  Press Ctrl+C to stop.
echo.

call npm run dev
