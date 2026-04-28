'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import {
  TrendingDown, TrendingUp, DollarSign, ShoppingCart,
  AlertTriangle, Bell, Calendar, ArrowDown, ArrowUp,
  RefreshCw, Eye, ExternalLink, Loader2, Users, Search, Download, CheckCircle2
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
  const [funnelMap, setFunnelMap] = useState<Record<string, string>>({})
  const [completedAsins, setCompletedAsins] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchOpen, setSearchOpen] = useState(false)

  const downloadTrackedAsins = async () => {
    const { data } = await supabase.from('price_tracker_products').select('asin, title, brand, category_root, sku, created_at').order('asin')
    if (!data || data.length === 0) return
    const csv = [
      ['ASIN', 'Title', 'Brand', 'Category', 'SKU', 'Added On'].join(','),
      ...data.map(r => [r.asin, `"${(r.title || '').replace(/"/g, '""')}"`, `"${r.brand || ''}"`, `"${r.category_root || ''}"`, r.sku || '', r.created_at?.split('T')[0] || ''].join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tracked-asins-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); setSearchOpen(false); return }
    const { data } = await supabase
      .from('price_tracker_products')
      .select('asin, title, brand, sku')
      .or(`asin.ilike.%${query}%,title.ilike.%${query}%,brand.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(8)
    setSearchResults(data || [])
    setSearchOpen(true)
  }

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
      const { data: buys } = await supabase.from('price_tracker_buy_signals').select('*').order('diff_pct', { ascending: true })
      setBuySignals(buys || [])

      // Sell signals
      const { data: sells } = await supabase.from('price_tracker_alerts').select('*').eq('alert_type', 'sell_signal').eq('is_read', false).order('created_at', { ascending: false })
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

        setTopLosers(withChange.sort((a, b) => a.pct_change - b.pct_change))
        setTopGainers(withChange.sort((a, b) => b.pct_change - a.pct_change))
      }

      // Seller changes
      const { data: sellerAlerts } = await supabase.from('price_tracker_alerts').select('*').eq('alert_type', 'seller_change').eq('is_read', false).order('created_at', { ascending: false })
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

      // Funnel tags: copies first, then validation fallback
      const allAsins = skuRows?.map(r => r.asin) || []
      const fMap: Record<string, string> = {}
      if (allAsins.length > 0) {
        for (let i = 0; i < allAsins.length; i += 500) {
          const chunk = allAsins.slice(i, i + 500)
          const { data: copyFunnels } = await supabase
            .from('india_purchase_copies')
            .select('asin, funnel')
            .in('asin', chunk)
          copyFunnels?.forEach(r => { if (r.funnel) fMap[r.asin] = r.funnel })
        }
        const missingFunnel = allAsins.filter(a => !fMap[a])
        for (let i = 0; i < missingFunnel.length; i += 500) {
          const chunk = missingFunnel.slice(i, i + 500)
          const { data: valFunnels } = await supabase
            .from('india_validation_main_file')
            .select('asin, funnel')
            .in('asin', chunk)
          valFunnels?.forEach(r => { if (r.funnel) fMap[r.asin] = r.funnel })
        }
      }
      setFunnelMap(fMap)

      // Completed ASINs for current report
      const currentReport = lastSnap.data?.[0]?.report_date
      if (currentReport) {
        const { data: completedRows } = await supabase
          .from('price_tracker_work_history')
          .select('asin')
          .eq('report_date', currentReport)
        setCompletedAsins(new Set(completedRows?.map(r => r.asin) || []))
      }

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const completedClass = (asin: string) =>
    completedAsins.has(asin) ? 'ring-1 ring-emerald-500/40 bg-emerald-500/5' : ''

  const renderFunnelTag = (asin: string) => {
    const f = funnelMap[asin]
    if (!f) return null
    const tag = f.trim()
    return (
      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
        tag === 'RS' ? 'bg-emerald-500/20 text-emerald-400' :
        tag === 'DP' ? 'bg-blue-500/20 text-blue-400' :
        'bg-gray-500/20 text-gray-400'
      }`}>
        {tag}
      </span>
    )
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <div key="Tracked ASINs" className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl p-4 relative">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-gray-400 text-xs uppercase tracking-wider">Tracked ASINs</span>
          </div>
          <span className="text-white text-2xl font-bold">{stats.totalProducts}</span>
          <button
            onClick={downloadTrackedAsins}
            className="absolute top-3 right-3 p-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-gray-300 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            title="Download tracked ASINs CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        {[
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
        {/* Completed counter */}
        {(() => {
          const allSignalAsins = new Set([
            ...buySignals.map(b => b.asin),
            ...sellSignals.map(s => s.asin),
            ...topLosers.map(s => s.asin),
            ...topGainers.map(s => s.asin),
            ...sellerChanges.map(s => s.asin),
          ])
          return (
            <div className={`border rounded-xl p-4 ${
              completedAsins.size > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#1a1a1a] border-white/[0.05]'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-gray-400 text-xs uppercase tracking-wider">Completed</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-emerald-400 text-2xl font-bold">{completedAsins.size}</span>
                <span className="text-gray-500 text-sm">/ {allSignalAsins.size}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
            placeholder="Search ASIN, product, brand..."
            className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-xl pl-10 pr-4 py-2 text-sm text-gray-200 focus:border-orange-500 outline-none"
          />
          {searchOpen && searchResults.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl z-50 max-h-[400px] overflow-y-auto">
                {searchResults.map(r => (
                  <div
                    key={r.asin}
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); router.push(`/dashboard/price-tracker/asin/${r.asin}`) }}
                    className="px-4 py-3 hover:bg-white/[0.05] cursor-pointer border-b border-white/[0.03] last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-400 font-mono">{r.asin}</span>
                      {r.sku && <span className="text-xs text-gray-500">{r.sku}</span>}
                      {renderFunnelTag(r.asin)}
                      {r.brand && <span className="text-xs text-gray-500 ml-auto">{r.brand}</span>}
                    </div>
                    <p className="text-sm text-gray-300 truncate mt-0.5">{r.title}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Buy Signals */}
        <div className="bg-[#1a1a1a] border border-emerald-500/20 rounded-xl p-5">
          <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2 mb-4 shrink-0">
            <DollarSign className="w-5 h-5" /> BUY NOW
            {buySignals.length > 0 && (
              <span className="ml-auto text-sm font-mono text-emerald-400/70">
                {buySignals.filter(b => completedAsins.has(b.asin)).length}/{buySignals.length}
              </span>
            )}
          </h2>
          {buySignals.length === 0 ? (
            <p className="text-gray-500 text-sm">No buy opportunities today</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {buySignals.map(b => (
                <div
                  key={b.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${b.asin}`)}
                  className={`flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-emerald-500/5 border border-white/[0.05] transition-colors ${completedClass(b.asin)}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${b.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{b.asin}</a>
                    {skuMap[b.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[b.asin]}</span>}
                    {renderFunnelTag(b.asin)}
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
            {sellSignals.length > 0 && (
              <span className="ml-auto text-sm font-mono text-emerald-400/70">
                {sellSignals.filter(a => completedAsins.has(a.asin)).length}/{sellSignals.length}
              </span>
            )}
          </h2>
          {sellSignals.length === 0 ? (
            <p className="text-gray-500 text-sm">No sell signals</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sellSignals.map(a => (
                <div
                  key={a.id}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${a.asin}`)}
                  className={`flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-orange-500/5 border border-white/[0.05] transition-colors ${completedClass(a.asin)}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${a.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{a.asin}</a>
                    {skuMap[a.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[a.asin]}</span>}
                    {renderFunnelTag(a.asin)}
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
            {topLosers.length > 0 && (
              <span className="ml-auto text-sm font-mono text-emerald-400/70">
                {topLosers.filter(s => completedAsins.has(s.asin)).length}/{topLosers.length}
              </span>
            )}
          </h2>
          {topLosers.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {topLosers.map(s => (
                <div
                  key={s.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${s.asin}`)}
                  className={`flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-red-500/5 border border-white/[0.05] transition-colors ${completedClass(s.asin)}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{s.asin}</a>
                    {skuMap[s.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[s.asin]}</span>}
                    {renderFunnelTag(s.asin)}
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
            {topGainers.length > 0 && (
              <span className="ml-auto text-sm font-mono text-emerald-400/70">
                {topGainers.filter(s => completedAsins.has(s.asin)).length}/{topGainers.length}
              </span>
            )}
          </h2>
          {topGainers.length === 0 ? (
            <p className="text-gray-500 text-sm">No data yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {topGainers.map(s => (
                <div
                  key={s.asin}
                  onClick={() => router.push(`/dashboard/price-tracker/asin/${s.asin}`)}
                  className={`flex items-center justify-between p-3 bg-[#111111] rounded-lg cursor-pointer hover:bg-blue-500/5 border border-white/[0.05] transition-colors ${completedClass(s.asin)}`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline" onClick={e => e.stopPropagation()}>{s.asin}</a>
                    {skuMap[s.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[s.asin]}</span>}
                    {renderFunnelTag(s.asin)}
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
            {sellerChanges.length > 0 && (
              <span className="ml-auto text-sm font-mono text-emerald-400/70">
                {sellerChanges.filter(a => completedAsins.has(a.asin)).length}/{sellerChanges.length}
              </span>
            )}
          </h2>
          {sellerChanges.length === 0 ? (
            <p className="text-gray-500 text-sm">No seller changes detected</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sellerChanges.map(a => (
                <div key={a.id} className={`p-3 bg-[#111111] rounded-lg border border-white/[0.05] ${completedClass(a.asin)}`}>
                  <a href={`https://www.amazon.com/dp/${a.asin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 font-mono underline">{a.asin}</a>
                  {skuMap[a.asin] && <span className="text-xs text-gray-500 ml-2">{skuMap[a.asin]}</span>}
                  {renderFunnelTag(a.asin)}
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
