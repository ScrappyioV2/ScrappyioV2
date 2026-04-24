'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Filter, Loader2, X, Search } from 'lucide-react'

type Alert = {
  id: string; asin: string; title: string; alert_type: string;
  message: string; report_date: string; is_read: boolean; created_at: string;
}

const ALERT_TYPES = [
  'milestone_down_buybox', 'milestone_up_buybox', 'milestone_down_amazon', 'milestone_up_amazon',
  'all_time_low_buybox', 'all_time_low_amazon', 'below_purchase', 'below_min_ever',
  'sell_signal', 'seller_change', 'blank_price', 'not_in_report', 'back_in_stock',
]

const alertLabel = (type: string) => {
  const map: Record<string, { label: string; color: string }> = {
    milestone_down_buybox: { label: '📉 Milestone ↓ BB', color: 'text-red-400' },
    milestone_up_buybox: { label: '📈 Milestone ↑ BB', color: 'text-blue-400' },
    milestone_down_amazon: { label: '📉 Milestone ↓ AMZ', color: 'text-red-400' },
    milestone_up_amazon: { label: '📈 Milestone ↑ AMZ', color: 'text-blue-400' },
    all_time_low_buybox: { label: '🏆 ATL (BB)', color: 'text-emerald-400' },
    all_time_low_amazon: { label: '🏆 ATL (AMZ)', color: 'text-emerald-400' },
    below_purchase: { label: '💰 Below Purchase', color: 'text-emerald-400' },
    below_min_ever: { label: '💎 Below Min Ever', color: 'text-emerald-400' },
    sell_signal: { label: '💵 Sell Signal', color: 'text-orange-400' },
    seller_change: { label: '🔄 Seller Change', color: 'text-purple-400' },
    blank_price: { label: '⚠️ Blank Price', color: 'text-yellow-400' },
    not_in_report: { label: '❌ Not in Report', color: 'text-red-400' },
    back_in_stock: { label: '✅ Back in Stock', color: 'text-emerald-400' },
  }
  return map[type] || { label: type, color: 'text-gray-400' }
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchAlerts() }, [filter])

  const fetchAlerts = async () => {
    setLoading(true)
    let q = supabase.from('price_tracker_alerts').select('*').order('created_at', { ascending: false }).limit(200)
    if (filter !== 'all' && filter !== 'unread') q = q.eq('alert_type', filter)
    if (filter === 'unread') q = q.eq('is_read', false)
    const { data } = await q
    setAlerts(data || [])
    setLoading(false)
  }

  const markRead = async (ids: string[]) => {
    await supabase.from('price_tracker_alerts').update({ is_read: true }).in('id', ids)
    setAlerts(prev => prev.map(a => ids.includes(a.id) ? { ...a, is_read: true } : a))
    setSelectedIds(new Set())
  }

  const markAllRead = async () => {
    await supabase.from('price_tracker_alerts').update({ is_read: true }).eq('is_read', false)
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const filteredAlerts = alerts.filter(a =>
    !search || a.asin.toLowerCase().includes(search.toLowerCase()) || a.message.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-full bg-[#111111] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Bell className="w-6 h-6 text-orange-500" /> Alerts
          </h1>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={() => markRead([...selectedIds])}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center gap-1.5 hover:bg-emerald-500/20"
              >
                <Check className="w-4 h-4" /> Mark {selectedIds.size} Read
              </button>
            )}
            <button
              onClick={markAllRead}
              className="px-3 py-2 bg-[#1a1a1a] border border-white/[0.1] rounded-lg text-gray-400 text-sm flex items-center gap-1.5 hover:text-white"
            >
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ASIN or message..."
              className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:border-orange-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['all', 'unread', ...ALERT_TYPES].map(t => {
              const info = t === 'all' ? { label: 'All', color: 'text-gray-300' } : t === 'unread' ? { label: 'Unread', color: 'text-orange-400' } : alertLabel(t)
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filter === t ? 'bg-orange-500 text-white' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-white/[0.05]'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'unread' ? 'Unread' : info.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Alerts List */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No alerts found</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredAlerts.map(a => {
              const info = alertLabel(a.alert_type)
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    a.is_read
                      ? 'bg-[#1a1a1a] border-white/[0.03] hover:bg-white/[0.03]'
                      : 'bg-orange-500/[0.03] border-orange-500/20 hover:bg-orange-500/[0.06]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    className="shrink-0 w-4 h-4 accent-orange-500"
                  />
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => router.push(`/dashboard/price-tracker/asin/${a.asin}`)}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
                      <span className="text-[10px] text-gray-500">{a.report_date}</span>
                      {!a.is_read && <span className="w-2 h-2 bg-orange-500 rounded-full" />}
                    </div>
                    <p className="text-sm text-gray-200">{a.message}</p>
                    <span className="text-xs text-gray-500 font-mono">{a.asin}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); markRead([a.id]) }}
                    className="shrink-0 p-1.5 text-gray-500 hover:text-emerald-400 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
