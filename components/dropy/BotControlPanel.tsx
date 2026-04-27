'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Play, Pause, Square, Settings, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface BotProduct {
  id: string;
  asin: string;
  product_name: string | null;
  amz_link: string | null;
  [key: string]: any;
}

interface BotControlPanelProps {
  products: BotProduct[];
  moveProduct: (product: BotProduct, action: 'approved' | 'not_approved') => Promise<void>;
  sellerName: string;
}

export default function BotControlPanel({ products, moveProduct, sellerName }: BotControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const [delayMs, setDelayMs] = useState(3000);
  const [processedCount, setProcessedCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [notApprovedCount, setNotApprovedCount] = useState(0);
  const [currentAsin, setCurrentAsin] = useState('');
  const [logs, setLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const amazonWindowRef = useRef<Window | null>(null);
  const resolveResultRef = useRef<((result: { asin: string; result: string }) => void) | null>(null);
  const productsRef = useRef(products);
  const logBoxRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => { productsRef.current = products; }, [products]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Check extension on mount
  useEffect(() => {
    const checkExtension = () => {
      window.dispatchEvent(new CustomEvent('scrappy-bot-ping'));
    };

    const handlePong = (e: Event) => {
      setExtensionInstalled(true);
    };

    window.addEventListener('scrappy-bot-pong', handlePong);
    checkExtension();

    // If no pong within 2 seconds, extension not installed
    const timeout = setTimeout(() => {
      setExtensionInstalled(prev => prev === null ? false : prev);
    }, 2000);

    return () => {
      window.removeEventListener('scrappy-bot-pong', handlePong);
      clearTimeout(timeout);
    };
  }, []);

  // Listen for Amazon results from extension
  useEffect(() => {
    const handleResult = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (resolveResultRef.current) {
        resolveResultRef.current(detail);
        resolveResultRef.current = null;
      }
    };

    window.addEventListener('scrappy-bot-result', handleResult);
    return () => window.removeEventListener('scrappy-bot-result', handleResult);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((text: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => {
      const next = [...prev, { text: `[${ts}] ${text}`, type }];
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, []);

  // Wait for Amazon result with timeout
  const waitForAmazonResult = (): Promise<{ asin: string; result: string }> => {
    return new Promise((resolve, reject) => {
      resolveResultRef.current = resolve;
      // Timeout after 30 seconds
      setTimeout(() => {
        if (resolveResultRef.current) {
          resolveResultRef.current = null;
          reject(new Error('Timeout waiting for Amazon result'));
        }
      }, 30000);
    });
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Wait while paused
  const waitWhilePaused = async () => {
    while (pausedRef.current && runningRef.current) {
      await sleep(500);
    }
  };

  const processProducts = async () => {
    addLog(`Bot started for ${sellerName}`, 'success');

    while (runningRef.current) {
      await waitWhilePaused();
      if (!runningRef.current) break;

      // Get the first product with an amz_link
      const currentProducts = productsRef.current;
      const product = currentProducts.find(p => p.amz_link);

      if (!product) {
        addLog('No more products with AMZ links on this page.', 'warn');
        stopBot();
        break;
      }

      if (!product.amz_link) {
        addLog(`ASIN ${product.asin}: No AMZ link, skipping`, 'warn');
        continue;
      }

      setCurrentAsin(product.asin);
      addLog(`Processing ASIN: ${product.asin}`);

      try {
        // Open Amazon tab
        const amzUrl = product.amz_link.startsWith('http')
          ? product.amz_link
          : `https://${product.amz_link}`;

        addLog(`Opening Amazon page...`);
        amazonWindowRef.current = window.open(amzUrl, '_blank');

        // Wait for extension to check the page and send result
        const result = await waitForAmazonResult();

        // Close Amazon window if still open
        if (amazonWindowRef.current && !amazonWindowRef.current.closed) {
          amazonWindowRef.current.close();
        }
        amazonWindowRef.current = null;

        if (!runningRef.current) break;

        // Apply the result
        const action = result.result === 'approved' ? 'approved' : 'not_approved';
        addLog(
          `ASIN ${product.asin}: ${action === 'approved' ? '✓ APPROVED' : '✗ NOT APPROVED'}`,
          action === 'approved' ? 'success' : 'warn'
        );

        // Call moveProduct directly
        await moveProduct(product, action);

        // Update stats
        setProcessedCount(prev => prev + 1);
        if (action === 'approved') {
          setApprovedCount(prev => prev + 1);
        } else {
          setNotApprovedCount(prev => prev + 1);
        }

        // Delay before next
        if (runningRef.current) {
          addLog(`Waiting ${delayMs / 1000}s...`);
          await sleep(delayMs);
        }

      } catch (err: any) {
        addLog(`Error: ${err.message}`, 'error');
        // Close Amazon window on error
        if (amazonWindowRef.current && !amazonWindowRef.current.closed) {
          amazonWindowRef.current.close();
        }
        amazonWindowRef.current = null;
        // Wait before retrying
        await sleep(2000);
      }
    }

    addLog('Bot stopped.', 'info');
  };

  const startBot = () => {
    if (extensionInstalled === false) {
      addLog('Chrome extension not detected! Install the Scrappy ASIN Auto Checker extension first.', 'error');
      return;
    }

    setRunning(true);
    setPaused(false);
    setProcessedCount(0);
    setApprovedCount(0);
    setNotApprovedCount(0);
    setLogs([]);
    setCurrentAsin('');

    // Start processing in next tick
    setTimeout(() => processProducts(), 100);
  };

  const stopBot = () => {
    setRunning(false);
    setPaused(false);
    setCurrentAsin('');
    resolveResultRef.current = null;
    if (amazonWindowRef.current && !amazonWindowRef.current.closed) {
      amazonWindowRef.current.close();
    }
    amazonWindowRef.current = null;
  };

  const togglePause = () => {
    setPaused(prev => {
      const next = !prev;
      addLog(next ? 'Bot paused' : 'Bot resumed', 'warn');
      return next;
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg shadow-lg shadow-orange-500/20 transition-all hover:scale-105 border border-orange-400/30 text-sm"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-bold">ASIN Bot</span>
        {running && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[340px] bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 border-b border-white/[0.1]">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${running ? (paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse') : 'bg-gray-300'}`} />
          <span className="text-sm font-bold text-white tracking-wide">ASIN Auto Checker</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 rounded-lg hover:bg-[#111111]/10 text-gray-400 hover:text-white transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[#111111]/10 text-gray-400 hover:text-white transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Extension Warning */}
      {extensionInstalled === false && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800/30 text-xs text-red-300">
          ⚠️ Chrome extension not detected. Install &quot;Scrappy ASIN Auto Checker&quot; extension.
        </div>
      )}

      {/* Status */}
      <div className="px-4 py-2 bg-[#1a1a1a] border-b border-white/[0.1]">
        <span className="text-xs text-gray-400">
          {!running ? 'Idle' : paused ? 'Paused' : currentAsin ? `Processing: ${currentAsin}` : 'Starting...'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-2 p-3">
        <button
          onClick={startBot}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white"
        >
          <Play className="w-3.5 h-3.5" /> Start
        </button>
        <button
          onClick={togglePause}
          disabled={!running}
          className="px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-black"
        >
          <Pause className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={stopBot}
          disabled={!running}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white"
        >
          <Square className="w-3.5 h-3.5" /> Stop
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-3 pb-3">
        <div className="flex-1 text-center py-2 bg-[#1a1a1a]/50 rounded-lg">
          <span className="block text-lg font-bold text-white">{processedCount}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Processed</span>
        </div>
        <div className="flex-1 text-center py-2 bg-emerald-500/10 rounded-lg border border-emerald-800/30">
          <span className="block text-lg font-bold text-emerald-400">{approvedCount}</span>
          <span className="text-[10px] text-emerald-600 uppercase tracking-wider">Approved</span>
        </div>
        <div className="flex-1 text-center py-2 bg-rose-500/10 rounded-lg border border-rose-800/30">
          <span className="block text-lg font-bold text-rose-400">{notApprovedCount}</span>
          <span className="text-[10px] text-rose-600 uppercase tracking-wider">Not Appr.</span>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="px-4 py-3 border-t border-white/[0.1] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Delay between actions</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={delayMs}
                onChange={e => setDelayMs(Math.max(1000, Number(e.target.value)))}
                disabled={running}
                className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white text-center disabled:opacity-50"
                min={1000}
                max={15000}
                step={500}
              />
              <span className="text-[10px] text-gray-500">ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="border-t border-white/[0.1]">
        <div className="px-4 py-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Activity Log</span>
        </div>
        <div
          ref={logBoxRef}
          className="max-h-[140px] overflow-y-auto px-3 pb-3 space-y-0.5"
        >
          {logs.length === 0 ? (
            <div className="text-[11px] text-gray-500 text-center py-4">
              Click Start to begin auto-checking
            </div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`text-[11px] font-mono py-0.5 ${
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'warn' ? 'text-amber-400' :
                  'text-gray-500'
                }`}
              >
                {log.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
