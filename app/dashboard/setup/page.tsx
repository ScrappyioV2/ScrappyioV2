'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  Download, Network, Chrome, Copy, Check, Pencil, Save, X, Loader2, Settings, FileSpreadsheet,
} from 'lucide-react';

type ConfigMap = {
  tailscale_auth_key: string;
  tailscale_download_url: string;
  scrappy_server_ip: string;
};

const DEFAULT_CONFIG: ConfigMap = {
  tailscale_auth_key: '',
  tailscale_download_url: 'https://tailscale.com/download/windows',
  scrappy_server_ip: '',
};

export default function SetupPage() {
  const { userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ConfigMap>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Admin-only redirect
  useEffect(() => {
    if (authLoading) return;
    if (!userRole) return;
    if (userRole.role !== 'admin') {
      router.replace('/unauthorized');
    }
  }, [authLoading, userRole, router]);

  // Fetch config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('setup_config')
          .select('key, value')
          .in('key', ['tailscale_auth_key', 'tailscale_download_url', 'scrappy_server_ip']);

        if (cancelled) return;
        if (error) {
          console.error('setup_config fetch error:', error.message);
          return;
        }

        const next: ConfigMap = { ...DEFAULT_CONFIG };
        (data || []).forEach((row: { key: string; value: string }) => {
          if (row.key in next) {
            (next as Record<string, string>)[row.key] = row.value;
          }
        });
        setConfig(next);
        setDraftKey(next.tailscale_auth_key);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const tailscaleCommand = `tailscale up --auth-key ${config.tailscale_auth_key}`;

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(tailscaleCommand);
    } catch {
      const t = document.createElement('textarea');
      t.value = tailscaleCommand;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadFullSetup = () => {
    const authKey = config.tailscale_auth_key;
    const serverIp = config.scrappy_server_ip;
    const script = `@echo off
echo ============================================
echo   Scrappy - Full PC Setup
echo ============================================
echo.

:: Check admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

:: Step 1 - Download Tailscale
echo [1/5] Downloading Tailscale...
powershell -Command "Invoke-WebRequest -Uri 'https://pkgs.tailscale.com/stable/tailscale-setup-latest-amd64.msi' -OutFile '%TEMP%\\tailscale-setup.msi'"
if %errorlevel% neq 0 (
    echo ERROR: Download failed. Check internet connection.
    pause
    exit /b 1
)
echo       Done!

:: Step 2 - Install Tailscale
echo [2/5] Installing Tailscale (silent)...
msiexec /i "%TEMP%\\tailscale-setup.msi" /quiet /norestart
echo       Waiting for install to finish...
timeout /t 10 /nobreak >nul
echo       Done!

:: Step 3 - Join Scrappy network
echo [3/5] Joining Scrappy network...
"C:\\Program Files\\Tailscale\\tailscale.exe" up --auth-key=${authKey} --unattended
timeout /t 5 /nobreak >nul
echo       Done!

:: Step 4 - Download and extract Chrome extension
echo [4/5] Setting up Chrome extension...
mkdir "%USERPROFILE%\\Desktop\\Scrappy Extension" 2>nul
powershell -Command "Invoke-WebRequest -Uri 'http://${serverIp}:3000/downloads/scrappy-extension.zip' -OutFile '%TEMP%\\scrappy-extension.zip'"
powershell -Command "Expand-Archive -Path '%TEMP%\\scrappy-extension.zip' -DestinationPath '%USERPROFILE%\\Desktop\\Scrappy Extension' -Force"
echo       Extension extracted to Desktop!

:: Step 5 - Open Chrome extensions page
echo [5/5] Opening Chrome extensions page...
start chrome chrome://extensions
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Tailscale: Connected
echo Extension: Extracted to Desktop\\Scrappy Extension
echo.
echo LAST STEP (manual - Chrome security):
echo   1. Enable "Developer mode" (top right toggle)
echo   2. Click "Load unpacked"
echo   3. Select the "Scrappy Extension" folder on Desktop
echo.
echo Then open: http://${serverIp}:3000
echo.
pause
`;
    const blob = new Blob([script], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scrappy-full-setup.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAuthScript = () => {
    const authKey = config.tailscale_auth_key;
    const serverIp = config.scrappy_server_ip;
    const script = `@echo off
echo Joining Scrappy network...
tailscale up --auth-key=${authKey} --unattended
echo.
echo Done! You can now access Scrappy at:
echo http://${serverIp}:3000
echo.
pause
`;
    const blob = new Blob([script], { type: 'application/x-bat' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'join-scrappy.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveKey = async () => {
    const trimmed = draftKey.trim();
    if (!trimmed || trimmed === config.tailscale_auth_key) {
      setEditingKey(false);
      return;
    }
    setSavingKey(true);
    const { error } = await supabase
      .from('setup_config')
      .update({ value: trimmed, updated_at: new Date().toISOString() })
      .eq('key', 'tailscale_auth_key');
    setSavingKey(false);
    if (error) {
      alert(`Failed to save auth key: ${error.message}`);
      return;
    }
    setConfig((prev) => ({ ...prev, tailscale_auth_key: trimmed }));
    setEditingKey(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <Settings className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Scrappy Setup</h1>
            <p className="text-sm text-gray-400 mt-0.5">Set up a new PC to access Scrappy</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* ONE-CLICK FULL SETUP */}
            <div className="mt-6 rounded-xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 p-[1px] shadow-lg shadow-orange-500/20">
              <div className="rounded-xl bg-gradient-to-br from-orange-600/95 to-amber-600/95 px-5 sm:px-7 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                    <Download className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white">
                      One-Click Full Setup
                    </h2>
                    <p className="text-xs sm:text-sm text-white/85 mt-1 leading-snug">
                      Downloads Tailscale, installs it, joins the network, extracts Chrome extension — Right-click → Run as Administrator
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadFullSetup}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 bg-white text-orange-600 hover:bg-orange-50 text-sm sm:text-base font-bold rounded-lg transition-colors shadow whitespace-nowrap"
                >
                  <Download className="w-5 h-5" />
                  Download Full Setup Script
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-8 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Or set up manually</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* SECTION A — TAILSCALE */}
            <div className="bg-[#111111] border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <Network className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Tailscale (Network Access)</h2>
                  <p className="text-xs text-gray-500">Connect this PC to the private Scrappy network</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* Step 1 */}
                <Step number={1} title="Download Tailscale">
                  <a
                    href={config.tailscale_download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Tailscale
                  </a>
                </Step>

                {/* Step 2 */}
                <Step number={2} title="Install">
                  <p className="text-sm text-gray-300">
                    Double-click the downloaded <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-xs">.msi</code> file and follow the installer.
                  </p>
                </Step>

                {/* Step 3 */}
                <Step number={3} title="Join Network">
                  <div className="space-y-2">
                    <div>
                      <button
                        onClick={downloadAuthScript}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Join Script
                      </button>
                      <p className="text-xs text-gray-500 mt-1.5">Right-click → Run as Administrator</p>
                    </div>

                    <div className="flex items-stretch gap-2">
                      <pre className="flex-1 min-w-0 px-3 py-2 bg-black/60 border border-white/10 rounded-lg text-xs text-emerald-300 font-mono overflow-x-auto whitespace-nowrap">
                        {tailscaleCommand}
                      </pre>
                      <button
                        onClick={handleCopyCommand}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                          copied
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10'
                        }`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>

                    {/* Edit auth key */}
                    {editingKey ? (
                      <div className="flex items-stretch gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={draftKey}
                          onChange={(e) => setDraftKey(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveKey();
                            if (e.key === 'Escape') {
                              setDraftKey(config.tailscale_auth_key);
                              setEditingKey(false);
                            }
                          }}
                          onBlur={handleSaveKey}
                          placeholder="tskey-auth-..."
                          className="flex-1 min-w-0 px-3 py-2 bg-black/60 border border-orange-500/40 focus:border-orange-500 rounded-lg text-xs text-gray-100 font-mono outline-none"
                        />
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleSaveKey}
                          disabled={savingKey}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-orange-500 hover:bg-orange-400 text-white transition-colors disabled:opacity-50"
                        >
                          {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDraftKey(config.tailscale_auth_key);
                            setEditingKey(false);
                          }}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setDraftKey(config.tailscale_auth_key);
                          setEditingKey(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-400 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Auth Key
                      </button>
                    )}
                  </div>
                </Step>

                {/* Step 4 */}
                <Step number={4} title="Verify">
                  <p className="text-sm text-gray-300">
                    Open CMD and run:{' '}
                    <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-emerald-300 font-mono">
                      ping {config.scrappy_server_ip || '<server-ip>'}
                    </code>
                  </p>
                </Step>
              </div>
            </div>

            {/* SECTION B — CHROME EXTENSION */}
            <div className="bg-[#111111] border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <Chrome className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Chrome Extension (Brand Checking Bot)</h2>
                  <p className="text-xs text-gray-500">Install the helper extension into Chrome</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <Step number={1} title="Download Extension">
                  <a
                    href="/downloads/scrappy-extension.zip"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Extension
                  </a>
                </Step>

                <Step number={2} title="Unzip">
                  <p className="text-sm text-gray-300">Unzip the downloaded file.</p>
                </Step>

                <Step number={3} title="Open Chrome Extensions">
                  <p className="text-sm text-gray-300">
                    Open Chrome →{' '}
                    <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-emerald-300 font-mono">
                      chrome://extensions
                    </code>{' '}
                    → Enable <span className="text-orange-400 font-semibold">Developer mode</span>.
                  </p>
                </Step>

                <Step number={4} title="Load Unpacked">
                  <p className="text-sm text-gray-300">
                    Click <span className="text-orange-400 font-semibold">&apos;Load unpacked&apos;</span> → select the unzipped folder.
                  </p>
                </Step>

                <Step number={5} title="Run">
                  <p className="text-sm text-gray-300">
                    Open Scrappy brand checking page + Amazon Seller Central → Click extension → <span className="text-orange-400 font-semibold">Start</span>.
                  </p>
                </Step>
              </div>
            </div>

            {/* SECTION C — MR JS EXTENSION */}
            <div className="bg-[#111111] border border-white/10 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Chrome Extension (Mr JS — JungleScout Bot)</h2>
                  <p className="text-xs text-gray-500">Automates JungleScout CSV collection from seller links</p>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <Step number={1} title="Download Extension">
                  <a
                    href="/downloads/mr-js-extension.zip"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Extension
                  </a>
                </Step>

                <Step number={2} title="Unzip">
                  <p className="text-sm text-gray-300">Unzip the downloaded file.</p>
                </Step>

                <Step number={3} title="Open Chrome Extensions">
                  <p className="text-sm text-gray-300">
                    Open Chrome →{' '}
                    <code className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-emerald-300 font-mono">
                      chrome://extensions
                    </code>{' '}
                    → Enable <span className="text-orange-400 font-semibold">Developer mode</span>.
                  </p>
                </Step>

                <Step number={4} title="Load Unpacked">
                  <p className="text-sm text-gray-300">
                    Click <span className="text-orange-400 font-semibold">&apos;Load unpacked&apos;</span> → select the unzipped folder.
                  </p>
                </Step>

                <Step number={5} title="Run">
                  <p className="text-sm text-gray-300">
                    Open Scrappy Add Seller page → click any profile link to activate the cursor → Click extension → <span className="text-orange-400 font-semibold">Start Mr JS</span>.
                  </p>
                </Step>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
        {children}
      </div>
    </div>
  );
}
