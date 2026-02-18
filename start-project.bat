@echo off
echo ====================================
echo Starting Scrappy-v2 Project
echo ====================================

cd /d "%~dp0"

echo [1/2] Starting Supabase...
start "Supabase" cmd /k "supabase start"

echo Waiting 30 seconds for Supabase...
timeout /t 30 /nobreak

echo [2/2] Starting Next.js...
start "Next.js App" cmd /k "npm run dev"

echo.
echo ====================================
echo URLs:
echo   Supabase: http://localhost:54333
echo   App: http://localhost:3000
echo ====================================
pause
