'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  TrendingDown, TrendingUp, DollarSign, ShoppingCart,
  AlertTriangle, Bell, Calendar, ArrowDown, ArrowUp,
  RefreshCw, Eye, ExternalLink, Loader2, Users
} from 'lucide-react'

type BuySignal = { asin: string; title: string; brand: string; buybox_current: number; last_purchase_price: number; diff_pct: number; report_date: string }
type Alert = { id: string; asin: string; title: string; alert_type: string; message: string; created_at: string; is_read: boolean }
type Snapshot = { asin: string; title: string; brand: string; buybox_current: number; buybox_baseline: number; pct_change: number }

export default function PriceTrackerDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalProducts: 0, totalAlerts: 0, unreadAlerts: 0, lastUpload: '', totalOrders: 0 })
  const [buySignals, setBuySignals] = useState<BuySignal[]>([])
  const [sellSignals, setSellSignals] = useState<Alert[]>([])
  const [topLosers, setTopLosers] = useState<Snapshot[]>([])
  const [topGainers, setTopGainers] = useState<Snapshot[]>([])
  const [sellerChanges, setSellerChanges] = useState<Alert[]>([])
  const [missingCount, setMissingCount] = useState({ blank: 0, notInReport: 0 })
  const [skuMap, setSkuMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // Stats
      const [prodCount, alertCount, unreadCount, lastSnap, orderCount] = await Promise.all([
        supabase.from('price_tracker_products').select('*', { count: 'exact', head: true }),
        supabase.from('price_tracker_alerts').select('*', { count: 'exact', head: true }),
        supabase.from('price_tracker_alerts').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('price_tracker_snapshots').select('report_date').order('report_date', { ascending: false }).limit(1),
        supabase.from('price_tracker_orders').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        totalProducts: prodCount.count || 0,
        totalAlerts: alertCount.count || 0,
        unreadAlerts: unreadCount.count || 0,
        lastUpload: lastSnap.data?.[0]?.report_date || 'Never',
        totalOrders: orderCount.count || 0,
      })

      // Buy signals
      const { data: buys } = await supabase.from('price_tracker_buy_signals').select('*').order('diff_pct', { ascending: true }).limit(10)
      setBuySignals(buys || [])

      // Sell signals
      const { data: sells } = await supabase.from('price_tracker_alerts').select('*').eq('alert_type', 'sell_signal').eq('is_read', false).order('created_at', { ascending: false }).limit(10)
      setSellSignals(sells || [])

      // Top losers/gainers (latest snapshot vs baseline)
      const { data: snaps } = await supabase
        .from('price_tracker_snapshots')
        .select('asin, title, brand, buybox_current, report_date')
        .order('report_date', { ascending: false })
        .limit(500)

      if (snaps && snaps.length > 0) {
        const latestDate = snaps[0].report_date
        const latestSnaps = snaps.filter(s => s.report_date === latestDate)

        // Get baselines
        const asins = latestSnaps.map(s => s.asin)
        const { data: configs } = await supabase
          .from('price_tracker_alert_config')
          .select('asin, buybox_baseline')
          .in('asin', asins)

        const baselineMap: Record<string, number> = {}
        configs?.forEach(c => { if (c.buybox_baseline) baselineMap[c.asin] = c.buybox_baseline })

        const withChange = latestSnaps
          .filter(s => s.buybox_current && baselineMap[s.asin])
          .map(s => ({
            ...s,
            buybox_baseline: baselineMap[s.asin],
            pct_change: ((s.buybox_current - baselineMap[s.asin]) / baselineMap[s.asin]) * 100
          }))

        setTopLosers(withChange.sort((a, b) => a.pct_change - b.pct_change).slice(0, 5))
        setTopGainers(withChange.sort((a, b) => b.pct_change - a.pct_change).slice(0, 5))
      }

      // Seller changes
      const { data: sellerAlerts } = await supabase.from('price_tracker_alerts').select('*').eq('alert_type', 'seller_change').eq('is_read', false).order('created_at', { ascending: false }).limit(5)
      setSellerChanges(sellerAlerts || [])

      // Missing count
      const { data: missing } = await supabase.from('price_tracker_missing').select('missing_type')
      const blank = missing?.filter(m => m.missing_type === 'blank_price').length || 0
      const notIn = missing?.filter(m => m.missing_type === 'not_in_report').length || 0
      setMissingCount({ blank, notInReport: notIn })

      // SKU map
      const { data: skuRows } = await supabase.from('price_tracker_products').select('asin, sku')
      const skuMap: Record<string, string> = {}
      skuRows?.forEach(r => { if (r.sku) skuMap[r.asin] = r.sku })
      setSkuMap(skuMap)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-[#111111] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full bg-[#111111] flex flex-col overflow-hidden">
      <div className="shrink-0 p-6 pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingDown className="w-7 h-7 text-orange-500" />
            Price Tracker
          </h1>
          <p className="text-gray-400 text-sm mt-1">Daily Amazon price monitoring with buy/sell signals</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/price-tracker/alerts')}
            className="relative p-2.5 bg-[#1a1a1a] border border-white/[0.1] rounded-xl hover:border-orange-500/50 transition-colors"
          >
            <Bell className="w-5 h-5 text-gray-400" />
            {stats.unreadAlerts > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {stats.unreadAlerts}
              </span>
            )}
          </button>
          <button onClick={fetchAll} className="p-2.5 bg-[#1a1a1a] border border-white/[0.1] rounded-xl hover:border-orange-500/50 transition-colors">
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Tracked ASINs', value: stats.totalProducts, icon: Eye, color: 'text-blue-400' },
          { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-emerald-400' },
          { label: 'Total Alerts', value: stats.totalAlerts, icon: Bell, color: 'text-orange-400' },
          { label: 'Unread', value: stats.unreadAlerts, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Last Upload', value: stats.lastUpload, icon: Calendar, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-gray-400 text-xs uppercase tracking-wider">{s.label}</span>
            </div>
            <span className="text-white text-2xl font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { label: 'Upload Orders', path: '/dashboard/price-tracker/upload-orders', icon: 'ShoppingCart' },
          { label: 'Daily Upload', path: '/dashboard/price-tracker/upload', icon: 'Upload' },
          { label: 'Alerts', path: '/dashboard/price-tracker/alerts', icon: 'Bell' },
          { label: 'Missing Items', path: '/dashboard/price-tracker/missing', icon: 'AlertTriangle' },
        ].map(btn => (
          <button
            key={btn.path}
            onClick={() => router.push(btn.path)}
            className="px-4 py-2 bg-[#1a1a1a] border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:text-orange-400 hover:border-orange-500/30 transition-colors flex items-center gap-2"
          >
            {btn.label}
          </button>
        ))}
      </div>

      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buy Signals */}
        <div className="bg-[#1a1a1a] border border-emerald-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2 mb-4 shrink-0">
            <DollarSign className="w-5 h-5" /> BUY NOW
          </h2>
          {buySignals.length === 0 ? (
            <p className="text-gray-500 text-sm">No buy opportunities today</p>
          ) : (
            <div className="space-y-2">
              {buySignals.map(b => (
                <div
                  key={b.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${b.asin}`)}
                  className="flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-emerald-500/5 border border-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${b.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{b.asin}</a>
                    {skuMap[b.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[b.asin]}</span>}
                    <p className="text-sm text-gray-200 truncate">{b.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-emerald-400 font-bold">₹{b.buybox_current?.toFixed(0)}</div>
                    <div className="text-red-400 text-xs line-through">₹{b.last_purchase_price?.toFixed(0)}</div>
                    <div className="text-emerald-400 text-xs font-medium">{b.diff_pct?.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sell Signals */}
        <div className="bg-[#1a1a1a] border border-orange-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2 mb-4 shrink-0">
            <TrendingUp className="w-5 h-5" /> SELL SIGNALS
          </h2>
          {sellSignals.length === 0 ? (
            <p className="text-gray-500 text-sm">No sell signals</p>
          ) : (
            <div className="space-y-2">
              {sellSignals.map(a => (
                <div
                  key={a.id}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${a.asin}`)}
                  className="flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-orange-500/5 border border-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${a.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{a.asin}</a>
                    {skuMap[a.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[a.asin]}</span>}
                    <p className="text-sm text-gray-300">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Losers */}
        <div className="bg-[#1a1a1a] border border-red-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-4 shrink-0">
            <ArrowDown className="w-5 h-5" /> Top Losers
          </h2>
          {topLosers.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topLosers.map(s => (
                <div
                  key={s.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${s.asin}`)}
                  className="flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-red-500/5 border border-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{s.asin}</a>
                    {skuMap[s.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[s.asin]}</span>}
                    <p className="text-sm text-gray-200 truncate">{s.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-red-400 font-bold">{s.pct_change.toFixed(1)}%</div>
                    <div className="text-gray-400 text-xs">₹{s.buybox_current?.toFixed(0)} ← ₹{s.buybox_baseline?.toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Gainers */}
        <div className="bg-[#1a1a1a] border border-blue-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-4 shrink-0">
            <ArrowUp className="w-5 h-5" /> Top Gainers
          </h2>
          {topGainers.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topGainers.map(s => (
                <div
                  key={s.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${s.asin}`)}
                  className="flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-blue-500/5 border border-white/[0.05] transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{s.asin}</a>
                    {skuMap[s.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[s.asin]}</span>}
                    <p className="text-sm text-gray-200 truncate">{s.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-blue-400 font-bold">+{s.pct_change.toFixed(1)}%</div>
                    <div className="text-gray-400 text-xs">₹{s.buybox_current?.toFixed(0)} ← ₹{s.buybox_baseline?.toFixed(0)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seller Changes */}
        <div className="bg-[#1a1a1a] border border-purple-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2 mb-4 shrink-0">
            <Users className="w-5 h-5" /> Seller Changes
          </h2>
          {sellerChanges.length === 0 ? (
            <p className="text-gray-500 text-sm">No seller changes detected</p>
          ) : (
            <div className="space-y-2">
              {sellerChanges.map(a => (
                <div key={a.id} className="p-3 bg-[#111111] rounded-lg border border-white/[0.05]">
                  <a href={`https://www.amazon.com/dp/${a.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline">{a.asin}</a>
                  {skuMap[a.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[a.asin]}</span>}
                  <p className="text-sm text-gray-300 mt-0.5">{a.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing / Blank */}
        <div
          onClick={() => router.push('/dashboard/price-tracker/missing')}
          className="bg-[#1a1a1a] border border-yellow-500/20 rounded-xl p-5 cursor-pointer hover:border-yellow-500/40 transition-colors"
        >
          <h2 className="text-lg font-bold text-yellow-400 flex items-center gap-2 mb-4 shrink-0">
            <AlertTriangle className="w-5 h-5" /> Missing / Blank
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111111] rounded-lg p-4 text-center border border-yellow-500/10">
              <div className="text-3xl font-bold text-yellow-400">{missingCount.blank}</div>
              <div className="text-xs text-gray-400 mt-1">Blank Price</div>
            </div>
            <div className="bg-[#111111] rounded-lg p-4 text-center border border-red-500/10">
              <div className="text-3xl font-bold text-red-400">{missingCount.notInReport}</div>
              <div className="text-xs text-gray-400 mt-1">Not in Report</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
