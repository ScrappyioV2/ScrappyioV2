@echo off
echo ========================================
echo Scrappy V2 - Shutdown
echo ========================================
echo.

echo Stopping Supabase containers...
cd C:\Users\Admin\Desktop\Project\scrappy-v2\supabase\docker
docker compose down

echo.
echo Scrappy V2 stopped.
pause
