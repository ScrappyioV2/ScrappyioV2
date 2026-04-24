'use client'

import { useState, useRef, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Trash2, Bell, ArrowLeft } from 'lucide-react'
// XLSX loaded dynamically on file select

type SnapshotRow = {
  asin: string; title: string; brand: string; category_root: string;
  buybox_current: number | null; buybox_lowest: number | null; buybox_seller: string;
  amazon_current: number | null; amazon_lowest: number | null;
  list_price: number | null; sales_rank: number | null;
  new_offer_count: number | null; coupon_pct: number | null;
  report_date: string;
}

type AlertSummary = { type: string; count: number }

export default function UploadKeepaPage() {
  const router = useRouter()
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [reportDate, setReportDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [alertsSummary, setAlertsSummary] = useState<AlertSummary[]>([])
  const [insertStats, setInsertStats] = useState({ products: 0, snapshots: 0, alerts: 0 })
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const parseKeepaPrice = (val: any): number | null => {
    if (val === null || val === undefined || val === '' || val === '-') return null
    const num = typeof val === 'string' ? parseFloat(val.replace(/[$,₹]/g, '')) : Number(val)
    return isNaN(num) ? null : num
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setDone(false)
    setDuplicateWarning(false)

    const XLSX = await import('xlsx')
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data, { type: 'array' })
    const sheetName = wb.SheetNames[0]

    // Auto-detect date from sheet name
    let date = sheetName
    const dateMatch = sheetName.match(/\d{4}-\d{2}-\d{2}/)
    if (dateMatch) {
      date = dateMatch[0]
    } else {
      // Try other date formats
      const altMatch = sheetName.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (altMatch) date = `${altMatch[3]}-${altMatch[1].padStart(2, '0')}-${altMatch[2].padStart(2, '0')}`
    }
    setReportDate(date)

    const sheet = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    const parsed: SnapshotRow[] = rows
      .filter(r => r['ASIN'])
      .map(r => ({
        asin: (r['ASIN'] || '').trim(),
        title: (r['Title'] || '').trim(),
        brand: (r['Brand'] || '').trim(),
        category_root: (r['Categories: Root'] || '').trim(),
        buybox_current: parseKeepaPrice(r['Buy Box: Current']),
        buybox_lowest: parseKeepaPrice(r['Buy Box: Lowest']),
        buybox_seller: (r['Buy Box: Buy Box Seller'] || '').trim(),
        amazon_current: parseKeepaPrice(r['Amazon: Current']),
        amazon_lowest: parseKeepaPrice(r['Amazon: Lowest']),
        list_price: parseKeepaPrice(r['List Price: Current']),
        sales_rank: parseKeepaPrice(r['Sales Rank: Current']),
        new_offer_count: parseKeepaPrice(r['New Offer Count: Current']),
        coupon_pct: parseKeepaPrice(r['One Time Coupon: Percentage']),
        report_date: date,
      }))

    setSnapshots(parsed)

    // Check for duplicate date
    const { data: existing } = await supabase
      .from('price_tracker_snapshots')
      .select('asin', { count: 'exact', head: true })
      .eq('report_date', date)
    if (existing !== null && (existing as any) > 0) {
      setDuplicateWarning(true)
    }
  }

  const handleCommit = async () => {
    if (snapshots.length === 0) return
    setUploading(true)
    setError('')

    try {
      // 1. Upsert products
      const uniqueAsins = [...new Map(snapshots.map(s => [s.asin, s])).values()]
      const productRows = uniqueAsins.map(s => ({
        asin: s.asin,
        title: s.title,
        brand: s.brand,
        category_root: s.category_root,
      }))
      const { error: prodErr } = await supabase
        .from('price_tracker_products')
        .upsert(productRows, { onConflict: 'asin' })
      if (prodErr) console.error('Product upsert error:', prodErr)

      // 2. Insert snapshots in batches
      const batchSize = 200
      let snapsInserted = 0
      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize)
        const { error: snapErr } = await supabase
          .from('price_tracker_snapshots')
          .upsert(batch, { onConflict: 'asin,report_date' })
        if (snapErr) throw new Error(`Snapshot batch failed: ${snapErr.message}`)
        snapsInserted += batch.length
      }

      // 3. Process alerts
      const { data: alertResult, error: alertErr } = await supabase.rpc('process_price_tracker_alerts', { p_report_date: reportDate })
      if (alertErr) console.error('Alert processing error:', alertErr)

      // 4. Get alerts summary for this date
      const { data: alerts } = await supabase
        .from('price_tracker_alerts')
        .select('alert_type')
        .eq('report_date', reportDate)

      const summary: Record<string, number> = {}
      alerts?.forEach(a => { summary[a.alert_type] = (summary[a.alert_type] || 0) + 1 })
      const summaryArr = Object.entries(summary).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

      setAlertsSummary(summaryArr)
      setInsertStats({
        products: productRows.length,
        snapshots: snapsInserted,
        alerts: alerts?.length || 0,
      })
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleClear = () => {
    setSnapshots([])
    setReportDate('')
    setDone(false)
    setError('')
    setDuplicateWarning(false)
    setAlertsSummary([])
    if (fileRef.current) fileRef.current.value = ''
  }

  const alertLabel = (type: string) => {
    const map: Record<string, string> = {
      milestone_down_buybox: '📉 Milestone ↓ (BB)', milestone_up_buybox: '📈 Milestone ↑ (BB)',
      milestone_down_amazon: '📉 Milestone ↓ (AMZ)', milestone_up_amazon: '📈 Milestone ↑ (AMZ)',
      all_time_low_buybox: '🏆 ATL (BB)', all_time_low_amazon: '🏆 ATL (AMZ)',
      below_purchase: '💰 Below Purchase', below_min_ever: '💎 Below Min Ever',
      sell_signal: '💵 Sell Signal', seller_change: '🔄 Seller Change',
      blank_price: '⚠️ Blank Price', not_in_report: '❌ Not in Report',
      back_in_stock: '✅ Back in Stock',
    }
    return map[type] || type
  }

  return (
    <div className="min-h-full bg-[#111111] p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push('/dashboard/price-tracker')} className="text-gray-500 hover:text-gray-300 flex items-center gap-1 text-sm mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Daily Keepa Upload</h1>
        <p className="text-gray-400 text-sm mb-6">Upload your daily Keepa Excel export to track prices and trigger alerts</p>

        {/* Drop zone */}
        {snapshots.length === 0 && !done && (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/[0.15] rounded-2xl p-16 cursor-pointer hover:border-orange-500/50 transition-colors bg-[#1a1a1a]">
            <FileSpreadsheet className="w-12 h-12 text-gray-500 mb-4" />
            <span className="text-gray-300 text-lg font-medium mb-1">Drop your Keepa Excel file here</span>
            <span className="text-gray-500 text-sm">Sheet name should be the date (e.g. 2026-04-23)</span>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-yellow-300 text-sm">Data already exists for {reportDate}. Uploading will overwrite existing snapshots.</span>
          </div>
        )}

        {/* Preview */}
        {snapshots.length > 0 && !done && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full">
                  <span className="text-blue-400 text-sm font-medium">📅 {reportDate}</span>
                </div>
                <span className="text-gray-300 text-sm">{snapshots.length} ASINs</span>
                <span className="text-gray-400 text-sm">
                  {snapshots.filter(s => s.buybox_current !== null).length} with Buy Box price
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleClear} className="px-3 py-2 text-sm text-gray-400 hover:text-white">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCommit}
                  disabled={uploading}
                  className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Processing...' : 'Commit & Process Alerts'}
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
                      <th className="px-4 py-3 text-right">Buy Box</th>
                      <th className="px-4 py-3 text-right">Amazon</th>
                      <th className="px-4 py-3 text-left">BB Seller</th>
                      <th className="px-4 py-3 text-right">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.slice(0, 100).map((s, i) => (
                      <tr key={i} className="border-t border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-mono text-xs">
                          <a href={`https://www.amazon.com/dp/${s.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 underline">{s.asin}</a>
                        </td>
                        <td className="px-4 py-2 text-gray-200 truncate max-w-[250px]">{s.title}</td>
                        <td className="px-4 py-2 text-right text-emerald-400">{s.buybox_current !== null ? `$${s.buybox_current.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-2 text-right text-blue-300">{s.amazon_current !== null ? `$${s.amazon_current.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-2 text-gray-400 truncate max-w-[120px]">{s.buybox_seller || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{s.sales_rank || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {snapshots.length > 100 && (
                  <div className="text-center py-3 text-gray-500 text-xs">Showing first 100 of {snapshots.length} rows</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Done */}
        {done && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8">
            <div className="text-center mb-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Upload Complete — {reportDate}</h2>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="text-gray-300">{insertStats.products} products</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-300">{insertStats.snapshots} snapshots</span>
                <span className="text-gray-500">•</span>
                <span className="text-orange-400 font-medium">{insertStats.alerts} alerts fired</span>
              </div>
            </div>

            {alertsSummary.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-orange-400" /> Alert Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {alertsSummary.map(a => (
                    <div key={a.type} className="bg-[#111111] border border-white/[0.05] rounded-lg px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-300">{alertLabel(a.type)}</span>
                      <span className="text-orange-400 font-bold">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-center mt-6">
              <button onClick={handleClear} className="px-5 py-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl text-gray-300 hover:text-white text-sm">
                Upload Another Day
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
