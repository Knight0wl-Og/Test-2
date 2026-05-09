@echo off
REM build.bat — build the TradeEdge C++ core on Windows
REM Usage: scripts\build.bat [clean]
setlocal enabledelayedexpansion

set ROOT=%~dp0..
set BUILD=%ROOT%\build

if "%1"=="clean" (
    echo Cleaning %BUILD% ...
    if exist "%BUILD%" rmdir /s /q "%BUILD%"
)

if not exist "%BUILD%" mkdir "%BUILD%"
cd /d "%BUILD%"

cmake "%ROOT%" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DBUILD_PYTHON_BINDINGS=ON ^
    -DBUILD_REST_SERVER=ON ^
    -DBUILD_TESTS=ON

if errorlevel 1 (
    echo [ERROR] CMake configure failed
    exit /b 1
)

cmake --build . --config Release

if errorlevel 1 (
    echo [ERROR] Build failed
    exit /b 1
)

echo.
echo ==========================================
echo  Build complete
echo ==========================================
echo   REST server  : %BUILD%\Release\tradeedge_server.exe
echo   Python module: %BUILD%\Release\tradeedge_core.pyd
echo.
echo   Run tests    : cd %BUILD% ^&^& ctest -C Release --output-on-failure
echo.
