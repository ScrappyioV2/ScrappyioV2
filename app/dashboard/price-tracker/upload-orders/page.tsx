'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Trash2, ArrowLeft } from 'lucide-react'
import Papa from 'papaparse'

type OrderRow = {
  asin: string; title: string; brand: string; order_date: string;
  purchase_ppu: number; listed_ppu: number; item_quantity: number;
  item_subtotal: number; seller_name: string; seller_state: string;
  order_id: string; po_line_item_id: string; order_status: string;
}

export default function UploadOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [filtered, setFiltered] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ inserted: 0, uniqueAsins: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setDone(false)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const raw = result.data as any[]
        const cancelled = raw.filter(r => r['Order Status']?.toLowerCase() === 'cancelled').length
        const valid = raw
          .filter(r => r['Order Status']?.toLowerCase() !== 'cancelled' && r['ASIN'])
          .map(r => ({
            asin: (r['ASIN'] || '').trim(),
            title: (r['Title'] || '').trim(),
            brand: (r['Brand'] || '').trim(),
            order_date: parseDate(r['Order Date'] || ''),
            purchase_ppu: parseFloat(r['Purchase PPU'] || '0') || 0,
            listed_ppu: parseFloat(r['Listed PPU'] || '0') || 0,
            item_quantity: parseInt(r['Item Quantity'] || '0') || 0,
            item_subtotal: parseFloat(r['Item Subtotal'] || '0') || 0,
            seller_name: (r['Seller Name'] || '').trim(),
            seller_state: (r['Seller State'] || '').trim(),
            order_id: (r['Order ID'] || '').trim(),
            po_line_item_id: (r['PO Line Item Id'] || '').trim(),
            order_status: (r['Order Status'] || '').trim(),
          }))
        setOrders(valid)
        setFiltered(cancelled)
      },
      error: () => setError('Failed to parse CSV'),
    })
  }

  const parseDate = (d: string): string => {
    // MM/DD/YYYY → YYYY-MM-DD
    const parts = d.split('/')
    if (parts.length === 3) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    return d
  }

  const handleCommit = async () => {
    if (orders.length === 0) return
    setUploading(true)
    setError('')

    try {
      // Insert orders in batches
      const batchSize = 200
      let inserted = 0
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize)
        const { error: insertErr } = await supabase.from('price_tracker_orders').insert(batch)
        if (insertErr) throw new Error(`Batch ${Math.floor(i / batchSize) + 1} failed: ${insertErr.message}`)
        inserted += batch.length
      }

      // Upsert unique ASINs into products
      const uniqueAsins = [...new Map(orders.map(o => [o.asin, o])).values()]
      const productRows = uniqueAsins.map(o => ({
        asin: o.asin,
        title: o.title,
        brand: o.brand,
      }))
      const { error: prodErr } = await supabase
        .from('price_tracker_products')
        .upsert(productRows, { onConflict: 'asin' })
      if (prodErr) console.error('Product upsert error:', prodErr)

      // Refresh purchase stats
      const { error: rpcErr } = await supabase.rpc('refresh_purchase_stats')
      if (rpcErr) console.error('Stats refresh error:', rpcErr)

      setStats({ inserted, uniqueAsins: uniqueAsins.length })
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setOrders([])
    setFiltered(0)
    setDone(false)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-full bg-[#111111] p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push('/dashboard/price-tracker')} className="text-gray-500 hover:text-gray-300 flex items-center gap-1 text-sm mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Upload Purchase History</h1>
        <p className="text-gray-400 text-sm mb-6">One-time upload of your Amazon purchase orders CSV</p>

        {/* Drop zone */}
        {orders.length === 0 && !done && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/[0.15] rounded-2xl p-16 cursor-pointer hover:border-orange-500/50 transition-colors bg-[#1a1a1a]">
            <Upload className="w-12 h-12 text-gray-500 mb-4" />
            <span className="text-gray-300 text-lg font-medium mb-1">Drop your purchase history CSV here</span>
            <span className="text-gray-500 text-sm">or click to browse</span>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </label>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Preview */}
        {orders.length > 0 && !done && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 text-sm font-medium">{orders.length} valid orders</span>
                </div>
                {filtered > 0 && (
                  <span className="text-yellow-400 text-sm">{filtered} cancelled orders filtered out</span>
                )}
                <span className="text-gray-400 text-sm">{new Set(orders.map(o => o.asin)).size} unique ASINs</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCommit}
                  disabled={uploading}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Commit to Database'}
                </button>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-white/[0.05] rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#0a0a0a] sticky top-0 z-10">
                    <tr className="text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">ASIN</th>
                      <th className="px-4 py-3 text-left">Title</th>
                      <th className="px-4 py-3 text-left">Brand</th>
                      <th className="px-4 py-3 text-right">PPU</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Seller</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 100).map((o, i) => (
                      <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-mono text-xs">
                          <a href={`https://www.amazon.com/dp/${o.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">{o.asin}</a>
                        </td>
                        <td className="px-4 py-2 text-gray-200 truncate max-w-[250px]">{o.title}</td>
                        <td className="px-4 py-2 text-gray-400">{o.brand}</td>
                        <td className="px-4 py-2 text-right text-emerald-400">${o.purchase_ppu.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{o.item_quantity}</td>
                        <td className="px-4 py-2 text-gray-400">{o.order_date}</td>
                        <td className="px-4 py-2 text-gray-400 truncate max-w-[150px]">{o.seller_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 100 && (
                  <div className="text-center py-3 text-gray-500 text-xs">Showing first 100 of {orders.length} rows</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Done */}
        {done && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Upload Complete!</h2>
            <p className="text-gray-300 mb-1">{stats.inserted} orders inserted</p>
            <p className="text-gray-300 mb-4">{stats.uniqueAsins} unique ASINs added to tracking</p>
            <p className="text-gray-400 text-sm">Purchase stats have been refreshed.</p>
            <button onClick={handleClear} className="mt-4 px-5 py-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl text-gray-300 hover:text-white text-sm">
              Upload Another
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
