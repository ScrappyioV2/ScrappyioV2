@echo off
supabase stop
taskkill /F /IM node.exe /T 2>nul
echo Project stopped!
pause
