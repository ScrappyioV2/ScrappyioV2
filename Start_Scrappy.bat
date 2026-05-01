@echo off
echo ========================================
echo Scrappy V2 - Startup
echo ========================================
echo.

REM Check Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo Waiting for Docker to start...
    :wait_docker
    timeout /t 5 >nul
    docker info >nul 2>&1
    if errorlevel 1 goto wait_docker
    echo Docker is ready!
)

echo.
echo [1/3] Starting Supabase containers...
cd C:\Users\Admin\Desktop\Project\scrappy-v2\supabase\docker
docker compose up -d

echo.
echo [2/3] Waiting for database to be healthy...
:wait_db
timeout /t 5 >nul
docker exec supabase-db pg_isready -U postgres >nul 2>&1
if errorlevel 1 goto wait_db
echo Database is ready!

echo.
echo [3/3] Starting Scrappy V2...
cd C:\Users\Admin\Desktop\Project\scrappy-v2
start cmd /k "npm run dev"

echo.
echo ========================================
echo  Scrappy V2 is running!
echo ========================================
echo.
echo  App:       http://localhost:3000
echo  Tailscale: http://100.82.234.106:3000
echo  Studio:    http://localhost:3001
echo.
echo  Press any key to close this window.
echo  (Scrappy will keep running in the other window)
pause >nul
