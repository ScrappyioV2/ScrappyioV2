'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Search, XCircle, AlertCircle } from 'lucide-react'

type MissingItem = {
  asin: string; title: string; brand: string; missing_type: string;
  last_price: number | null; last_seller: string; last_seen: string; days_missing: number;
}

export default function MissingPage() {
  const router = useRouter()
  const [items, setItems] = useState<MissingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'blank_price' | 'not_in_report'>('blank_price')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchMissing() }, [])

  const fetchMissing = async () => {
    setLoading(true)
    const { data } = await supabase.from('price_tracker_missing').select('*')
    setItems(data || [])
    setLoading(false)
  }

  const filtered = items
    .filter(i => i.missing_type === tab)
    .filter(i => !search || i.asin.toLowerCase().includes(search.toLowerCase()) || i.title?.toLowerCase().includes(search.toLowerCase()))

  const blankCount = items.filter(i => i.missing_type === 'blank_price').length
  const notInCount = items.filter(i => i.missing_type === 'not_in_report').length

  return (
    <div className="min-h-full bg-[#111111] p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-yellow-500" /> Missing / Blank Items
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setTab('blank_price')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === 'blank_price' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-[#1a1a1a] text-gray-400 border border-white/[0.05]'
            }`}
          >
            <AlertCircle className="w-4 h-4" /> Blank Price ({blankCount})
          </button>
          <button
            onClick={() => setTab('not_in_report')}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              tab === 'not_in_report' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#1a1a1a] text-gray-400 border border-white/[0.05]'
            }`}
          >
            <XCircle className="w-4 h-4" /> Not in Report ({notInCount})
          </button>

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ASIN..."
              className="bg-[#1a1a1a] border border-white/[0.1] rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:border-orange-500 outline-none w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No {tab === 'blank_price' ? 'blank price' : 'missing'} items</p>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0a0a0a]">
                <tr className="text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">ASIN</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Brand</th>
                  <th className="px-4 py-3 text-right">Last Price</th>
                  <th className="px-4 py-3 text-left">Last Seller</th>
                  <th className="px-4 py-3 text-left">Last Seen</th>
                  <th className="px-4 py-3 text-center">Days</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr
                    key={item.asin}
                    onClick={() => router.push(`/dashboard/price-tracker/asin/${item.asin}`)}
                    className="border-t border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{item.asin}</td>
                    <td className="px-4 py-3 text-gray-200 truncate max-w-[250px]">{item.title}</td>
                    <td className="px-4 py-3 text-gray-400">{item.brand}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{item.last_price ? `$${item.last_price.toFixed(2)}` : '-'}</td>
                    <td className="px-4 py-3 text-gray-400 truncate max-w-[120px]">{item.last_seller || '-'}</td>
                    <td className="px-4 py-3 text-gray-400">{item.last_seen || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.days_missing > 7 ? 'bg-red-500/10 text-red-400' :
                        item.days_missing > 3 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {item.days_missing}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
