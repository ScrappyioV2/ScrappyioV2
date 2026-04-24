'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useParams, useRouter } from 'next/navigation'
import {
  TrendingDown, TrendingUp, Loader2, RefreshCw, ArrowLeft,
  RotateCcw, Bell, BellOff, ShoppingCart, DollarSign, Calendar
} from 'lucide-react'

type Product = { asin: string; title: string; brand: string; category_root: string }
type Snapshot = { report_date: string; buybox_current: number | null; amazon_current: number | null; buybox_seller: string }
type Purchase = { rank: number; order_date: string; purchase_ppu: number; item_quantity: number; seller_name: string }
type Config = {
  asin: string; buybox_baseline: number | null; amazon_baseline: number | null;
  alerts_enabled: boolean; milestones_triggered: number[];
  sell_threshold_pct: number; baseline_set_at: string;
}
type Alert = { id: string; alert_type: string; message: string; report_date: string; is_read: boolean }
type PurchaseStat = { asin: string; last_price: number; min_price: number; max_price: number; avg_price: number; times_purchased: number }

export default function AsinDetailPage() {
  const params = useParams()
  const router = useRouter()
  const asin = params.asin as string

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [config, setConfig] = useState<Config | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [purchaseStats, setPurchaseStats] = useState<PurchaseStat | null>(null)
  const [resetting, setResetting] = useState(false)
  const [togglingAlerts, setTogglingAlerts] = useState(false)

  useEffect(() => { if (asin) fetchAll() }, [asin])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [prodRes, snapRes, purchRes, configRes, alertRes, statsRes] = await Promise.all([
        supabase.from('price_tracker_products').select('*').eq('asin', asin).maybeSingle(),
        supabase.from('price_tracker_snapshots').select('report_date, buybox_current, amazon_current, buybox_seller').eq('asin', asin).order('report_date', { ascending: true }),
        supabase.rpc('get_last_n_purchases', { p_asin: asin, p_n: 10 }),
        supabase.from('price_tracker_alert_config').select('*').eq('asin', asin).maybeSingle(),
        supabase.from('price_tracker_alerts').select('*').eq('asin', asin).order('created_at', { ascending: false }).limit(20),
        supabase.from('price_tracker_purchase_stats').select('*').eq('asin', asin).maybeSingle(),
      ])

      setProduct(prodRes.data)
      setSnapshots(snapRes.data || [])
      setPurchases(purchRes.data || [])
      setConfig(configRes.data)
      setAlerts(alertRes.data || [])
      setPurchaseStats(statsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const resetBaseline = async (source: 'buybox' | 'amazon' | 'both') => {
    setResetting(true)
    try {
      await supabase.rpc('reset_price_tracker_baseline', { p_asin: asin, p_source: source })
      await fetchAll()
    } catch (err) {
      console.error(err)
    } finally {
      setResetting(false)
    }
  }

  const toggleAlerts = async () => {
    if (!config) return
    setTogglingAlerts(true)
    try {
      await supabase.from('price_tracker_alert_config').update({ alerts_enabled: !config.alerts_enabled }).eq('asin', asin)
      setConfig({ ...config, alerts_enabled: !config.alerts_enabled })
    } finally {
      setTogglingAlerts(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-[#111111] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="h-full bg-[#111111] flex flex-col items-center justify-center">
        <p className="text-gray-400 mb-4">ASIN not found: {asin}</p>
        <button onClick={() => router.back()} className="text-orange-400 hover:text-orange-300 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Go back
        </button>
      </div>
    )
  }

  const latestSnap = snapshots[snapshots.length - 1]
  const bbChange = config?.buybox_baseline && latestSnap?.buybox_current
    ? ((latestSnap.buybox_current - config.buybox_baseline) / config.buybox_baseline * 100)
    : null

  // Simple sparkline using CSS
  const bbPrices = snapshots.map(s => s.buybox_current).filter(Boolean) as number[]
  const amzPrices = snapshots.map(s => s.amazon_current).filter(Boolean) as number[]
  const allPrices = [...bbPrices, ...amzPrices]
  const priceMin = allPrices.length > 0 ? Math.min(...allPrices) : 0
  const priceMax = allPrices.length > 0 ? Math.max(...allPrices) : 1

  const alertLabel = (type: string) => {
    const map: Record<string, string> = {
      milestone_down_buybox: '📉 Milestone ↓ BB', milestone_up_buybox: '📈 Milestone ↑ BB',
      all_time_low_buybox: '🏆 ATL BB', below_purchase: '💰 Below Purchase',
      below_min_ever: '💎 Below Min', sell_signal: '💵 Sell',
      seller_change: '🔄 Seller', blank_price: '⚠️ Blank', back_in_stock: '✅ Back',
    }
    return map[type] || type
  }

  return (
    <div className="min-h-full bg-[#111111] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => router.push('/dashboard/price-tracker')} className="text-gray-500 hover:text-gray-300 flex items-center gap-1 text-sm mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="text-xl font-bold text-white">{product.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 font-mono">{asin}</span>
              <a href={`https://www.amazon.com/dp/${asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 underline">View on Amazon</a>
              <span className="text-sm text-gray-400">{product.brand}</span>
              {product.category_root && <span className="text-xs text-gray-500 bg-white/[0.05] px-2 py-0.5 rounded">{product.category_root}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAlerts}
              disabled={togglingAlerts}
              className={`px-3 py-2 rounded-xl text-sm flex items-center gap-2 border transition-colors ${
                config?.alerts_enabled
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
              }`}
            >
              {config?.alerts_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {config?.alerts_enabled ? 'Alerts ON' : 'Alerts OFF'}
            </button>
            <button onClick={fetchAll} className="p-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl hover:border-orange-500/50">
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Price Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4">
            <span className="text-gray-400 text-xs uppercase">Buy Box</span>
            <div className="text-2xl font-bold text-white mt-1">{latestSnap?.buybox_current ? `$${latestSnap.buybox_current.toFixed(2)}` : '-'}</div>
            {bbChange !== null && (
              <span className={`text-sm font-medium ${bbChange < 0 ? 'text-red-400' : bbChange > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                {bbChange > 0 ? '+' : ''}{bbChange.toFixed(1)}% vs baseline
              </span>
            )}
          </div>
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4">
            <span className="text-gray-400 text-xs uppercase">Amazon</span>
            <div className="text-2xl font-bold text-white mt-1">{latestSnap?.amazon_current ? `$${latestSnap.amazon_current.toFixed(2)}` : '-'}</div>
          </div>
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4">
            <span className="text-gray-400 text-xs uppercase">BB Baseline</span>
            <div className="text-2xl font-bold text-orange-400 mt-1">{config?.buybox_baseline ? `$${config.buybox_baseline.toFixed(2)}` : '-'}</div>
            <span className="text-[10px] text-gray-500">{config?.baseline_set_at ? `Set ${config.baseline_set_at.split('T')[0]}` : ''}</span>
          </div>
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4">
            <span className="text-gray-400 text-xs uppercase">BB Seller</span>
            <div className="text-lg font-medium text-gray-200 mt-1 truncate">{latestSnap?.buybox_seller || '-'}</div>
          </div>
        </div>

        {/* Baseline Reset */}
        <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-sm text-gray-300 font-medium">Reset Baseline</span>
            <p className="text-xs text-gray-500 mt-0.5">Sets current price as new baseline. Clears milestone history.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {['buybox', 'amazon', 'both'].map(source => (
              <button
                key={source}
                onClick={() => resetBaseline(source as any)}
                disabled={resetting}
                className="px-3 py-1.5 bg-[#111111] border border-white/[0.1] rounded-lg text-xs text-gray-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> {source === 'both' ? 'Both' : source === 'buybox' ? 'Buy Box' : 'Amazon'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Price History Table */}
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" /> Price History ({snapshots.length} days)
            </h2>
            {snapshots.length === 0 ? (
              <p className="text-gray-500 text-sm">No snapshots yet</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111111] sticky top-0">
                    <tr className="text-gray-400 text-xs uppercase">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Buy Box</th>
                      <th className="px-3 py-2 text-right">Amazon</th>
                      <th className="px-3 py-2 text-left">Seller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots].reverse().map((s, i) => (
                      <tr key={i} className="border-t border-white/[0.03]">
                        <td className="px-3 py-2 text-gray-400 text-xs">{s.report_date}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">{s.buybox_current ? `$${s.buybox_current.toFixed(2)}` : '-'}</td>
                        <td className="px-3 py-2 text-right text-blue-300">{s.amazon_current ? `$${s.amazon_current.toFixed(2)}` : '-'}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[100px]">{s.buybox_seller || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Purchase History */}
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" /> Purchase History
            </h2>
            {purchaseStats && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-[#111111] rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Times</div>
                  <div className="text-lg font-bold text-white">{purchaseStats.times_purchased}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Min</div>
                  <div className="text-sm font-bold text-emerald-400">${purchaseStats.min_price?.toFixed(2)}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Avg</div>
                  <div className="text-sm font-bold text-blue-300">${purchaseStats.avg_price?.toFixed(2)}</div>
                </div>
                <div className="bg-[#111111] rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Max</div>
                  <div className="text-sm font-bold text-orange-400">${purchaseStats.max_price?.toFixed(2)}</div>
                </div>
              </div>
            )}
            {purchases.length === 0 ? (
              <p className="text-gray-500 text-sm">No purchase history</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#111111] sticky top-0">
                    <tr className="text-gray-400 text-xs uppercase">
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">PPU</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-left">Seller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p, i) => (
                      <tr key={i} className="border-t border-white/[0.03]">
                        <td className="px-3 py-2 text-gray-500 text-xs">{p.rank}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{p.order_date}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">${p.purchase_ppu?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{p.item_quantity}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[100px]">{p.seller_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Milestones */}
          {config && config.milestones_triggered && config.milestones_triggered.length > 0 && (
            <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-5">
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">Milestones Triggered</h2>
              <div className="flex flex-wrap gap-1.5">
                {config.milestones_triggered.sort((a, b) => a - b).map(m => (
                  <span
                    key={m}
                    className={`px-2 py-1 rounded text-xs font-mono font-medium ${
                      m < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {m > 0 ? '+' : ''}{m}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Alerts */}
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-5">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400" /> Recent Alerts ({alerts.length})
            </h2>
            {alerts.length === 0 ? (
              <p className="text-gray-500 text-sm">No alerts for this ASIN</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                {alerts.map(a => (
                  <div key={a.id} className={`p-3 rounded-lg border ${a.is_read ? 'border-white/[0.03] bg-[#111111]' : 'border-orange-500/20 bg-orange-500/[0.03]'}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-orange-400">{alertLabel(a.alert_type)}</span>
                      <span className="text-[10px] text-gray-500">{a.report_date}</span>
                    </div>
                    <p className="text-sm text-gray-300">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
