import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data } = await supabase
    .from('setup_config')
    .select('key, value')

  const config: Record<string, string> = {}
  data?.forEach((row: { key: string; value: string }) => { config[row.key] = row.value })

  const authKey = config['tailscale_auth_key'] || ''
  const serverIp = config['scrappy_server_ip'] || '100.82.234.106'

  const script = `@echo off
echo ============================================
echo   Scrappy - Full PC Setup
echo ============================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo [1/5] Downloading Tailscale...
powershell -Command "Invoke-WebRequest -Uri 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile '%TEMP%\\\\tailscale-setup.msi'"
if %errorlevel% neq 0 (
    echo ERROR: Download failed. Check internet connection.
    pause
    exit /b 1
)
echo       Done!

echo [2/5] Installing Tailscale (silent)...
msiexec /i "%TEMP%\\\\tailscale-setup.msi" /quiet /norestart
echo       Waiting for install to finish...
timeout /t 10 /nobreak >nul
echo       Done!

echo [3/5] Joining Scrappy network...
"C:\\\\Program Files\\\\Tailscale\\\\tailscale.exe" up --auth-key=${authKey} --unattended
timeout /t 5 /nobreak >nul
echo       Done!

echo [4/5] Setting up Chrome extension...
mkdir "%USERPROFILE%\\\\Desktop\\\\Scrappy Extension" 2>nul
powershell -Command "Invoke-WebRequest -Uri 'http://${serverIp}:3000/downloads/scrappy-extension.zip' -OutFile '%TEMP%\\\\scrappy-extension.zip'"
powershell -Command "Expand-Archive -Path '%TEMP%\\\\scrappy-extension.zip' -DestinationPath '%USERPROFILE%\\\\Desktop\\\\Scrappy Extension' -Force"
echo       Extension extracted to Desktop!

echo [5/5] Opening Chrome extensions page...
start chrome chrome://extensions
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo LAST STEP (manual):
echo   1. Enable "Developer mode" (top right)
echo   2. Click "Load unpacked"
echo   3. Select "Scrappy Extension" folder on Desktop
echo.
echo Then open: http://${serverIp}:3000
echo.
pause
`

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="scrappy-full-setup.bat"',
    },
  })
}
