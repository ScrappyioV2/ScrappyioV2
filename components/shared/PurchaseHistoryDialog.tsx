'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Loader2, History } from 'lucide-react'

type SellerRow = {
  tag: string
  count: number
  avgQty: number
  last3Highest: number[]
  minPrice: number | null
  avgPrice: number | null
  topLinks: string[]
}

type HistoryResult = {
  totalJourneys: number
  totalPurchases: number
  sellerRows: SellerRow[]
  headerMinPrice: number | null
  headerAvgPrice: number | null
}

type Props = {
  asin: string | null
  marketplace: 'india' | 'flipkart' | 'usa' | 'uae' | 'uk'
  onClose: () => void
}

const PURCHASE_TABLE: Record<string, string> = {
  india: 'india_purchases',
  flipkart: 'flipkart_purchases',
  usa: 'usa_purchases',
  uae: 'uae_purchases',
  uk: 'uk_purchases',
}

const HISTORY_TABLE: Record<string, string> = {
  india: 'india_asin_history',
  flipkart: 'flipkart_asin_history',
  usa: 'usa_asin_history',
  uae: 'uae_asin_history',
  uk: 'uk_asin_history',
}

const SELLER_COLORS: Record<string, string> = {
  GR: 'bg-yellow-500', RR: 'bg-orange-400', UB: 'bg-pink-500',
  VV: 'bg-emerald-500', DE: 'bg-orange-500', CV: 'bg-green-600',
  MV: 'bg-orange-600', KL: 'bg-lime-500',
}

export default function PurchaseHistoryDialog({ asin, marketplace, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<HistoryResult | null>(null)

  useEffect(() => {
    if (!asin) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setData(null)
      try {
        const purchaseTable = PURCHASE_TABLE[marketplace]
        const historyTable = HISTORY_TABLE[marketplace]

        const { data: purchases, error } = await supabase
          .from(purchaseTable)
          .select('seller_tag, buying_price, buying_quantity, journey_number, inr_purchase_link, seller_link, created_at')
          .eq('asin', asin)
          .eq('admin_confirmed', true)
          .order('created_at', { ascending: false })

        if (error) throw error

        const { data: historyRows } = await supabase
          .from(historyTable)
          .select('journey_number')
          .eq('asin', asin)

        const allJourneyNums = new Set([
          ...(purchases || []).map((p: any) => p.journey_number),
          ...(historyRows || []).map((h: any) => h.journey_number),
        ].filter(Boolean))

        const sellerMap: Record<string, { count: number; quantities: number[]; prices: number[]; links: string[] }> = {}

        for (const p of (purchases || [])) {
          const tag = p.seller_tag || 'Unknown'
          if (!sellerMap[tag]) sellerMap[tag] = { count: 0, quantities: [], prices: [], links: [] }
          sellerMap[tag].count++
          if (p.buying_quantity) sellerMap[tag].quantities.push(p.buying_quantity)
          if (p.buying_price) sellerMap[tag].prices.push(p.buying_price)
          const link = p.inr_purchase_link || p.seller_link
          if (link) sellerMap[tag].links.push(link)
        }

        const sellerRows = Object.entries(sellerMap)
          .map(([tag, d]) => {
            const avgQty = d.quantities.length > 0 ? Math.round(d.quantities.reduce((a, b) => a + b, 0) / d.quantities.length) : 0
            const last3Highest = [...d.quantities].sort((a, b) => b - a).slice(0, 3)
            const minPrice = d.prices.length > 0 ? Math.min(...d.prices) : null
            const avgPrice = d.prices.length > 0 ? Math.round(d.prices.reduce((a, b) => a + b, 0) / d.prices.length) : null
            const linkFreq: Record<string, number> = {}
            d.links.forEach(l => { linkFreq[l] = (linkFreq[l] || 0) + 1 })
            const topLinks = Object.entries(linkFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([link]) => link)
            return { tag, count: d.count, avgQty, last3Highest, minPrice, avgPrice, topLinks }
          })
          .sort((a, b) => b.count - a.count)

        const allPrices = (purchases || []).map((p: any) => p.buying_price).filter(Boolean) as number[]
        if (cancelled) return
        setData({
          totalJourneys: allJourneyNums.size,
          totalPurchases: (purchases || []).length,
          sellerRows,
          headerMinPrice: allPrices.length > 0 ? Math.min(...allPrices) : null,
          headerAvgPrice: allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : null,
        })
      } catch (err) {
        console.error('History fetch failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [asin, marketplace])

  if (!asin) return null

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/60 z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#111111] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.1]">
            <div>
              <h2 className="text-xl font-bold text-white">Purchase History</h2>
              <p className="text-sm text-gray-400 font-mono mt-0.5">{asin}</p>
            </div>
            <div className="flex items-center gap-4">
              {!loading && data && (
                <div className="flex gap-3 text-xs">
                  <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-full font-medium">
                    {data.totalJourneys} Journey{data.totalJourneys !== 1 ? 's' : ''}
                  </span>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full font-medium">
                    {data.totalPurchases} Purchase{data.totalPurchases !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <button onClick={onClose} className="p-2 hover:bg-white/[0.05] rounded-lg text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin w-8 h-8 text-orange-500" /></div>
            ) : !data || data.sellerRows.length === 0 ? (
              <div className="text-center text-gray-500 py-16">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No purchase history found.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/[0.1]">
                    <th className="px-4 py-3 text-left font-medium">Seller</th>
                    <th className="px-4 py-3 text-center font-medium">Times Bought</th>
                    <th className="px-4 py-3 text-center font-medium"><div>Avg. Buying Qty</div><div className="text-[10px] text-gray-500 normal-case mt-0.5">Last 3 highest</div></th>
                    <th className="px-4 py-3 text-center font-medium"><div>Min Price</div><div className="text-[10px] text-orange-400 normal-case mt-0.5">All: {data.headerMinPrice ? `₹${data.headerMinPrice}` : '-'}</div></th>
                    <th className="px-4 py-3 text-center font-medium"><div>Avg. Price</div><div className="text-[10px] text-orange-400 normal-case mt-0.5">All: {data.headerAvgPrice ? `₹${data.headerAvgPrice}` : '-'}</div></th>
                    <th className="px-4 py-3 text-left font-medium">Most Used Buying Links</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sellerRows.map((seller, idx) => (
                    <tr key={seller.tag} className={`border-b border-white/[0.05] hover:bg-white/[0.02] ${idx === 0 ? 'bg-orange-500/5' : ''}`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold text-white ${SELLER_COLORS[seller.tag] || 'bg-gray-500'}`}>{seller.tag}</span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-white font-bold text-lg">{seller.count}</span></td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-white font-medium">{seller.avgQty}</div>
                        {seller.last3Highest.length > 0 && <div className="text-[10px] text-gray-500 mt-0.5">Top: {seller.last3Highest.join(', ')}</div>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-emerald-400 font-medium">{seller.minPrice ? `₹${seller.minPrice}` : '-'}</span></td>
                      <td className="px-4 py-3 text-center"><span className="text-blue-300 font-medium">{seller.avgPrice ? `₹${seller.avgPrice}` : '-'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {seller.topLinks.length === 0 ? <span className="text-gray-500 text-xs">-</span> : seller.topLinks.map((link, i) => (
                            <a key={i} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs truncate max-w-[250px] block" title={link}>
                              {link.replace(/https?:\/\/(www\.)?/, '').slice(0, 40)}...
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
