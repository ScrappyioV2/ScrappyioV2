'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  Loader2,
  RefreshCw,
  Upload,
  Save,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  Package,
  ExternalLink
} from 'lucide-react'

// --- Types ---
type ReorderProduct = {
  id: string
  asin: string
  product_name: string | null
  seller_link: string | null
  admin_target_qty: number
  current_qty: number
  tracking_qty: number
  final_reorder_qty: number
  status: 'Safe' | 'Covered' | 'Reorder'
  updated_at: string
}

type Seller = {
  id: number
  name: string
  table_suffix: string
  tag: string
}

// Configured Sellers
const SELLERS: Seller[] = [
  { id: 4, name: 'Velvet Vista', table_suffix: 'seller_4', tag: 'VV' },
  { id: 1, name: 'Golden Aura', table_suffix: 'seller_1', tag: 'GA' },
  { id: 2, name: 'Rudra Retail', table_suffix: 'seller_2', tag: 'RR' },
  { id: 3, name: 'UBeauty', table_suffix: 'seller_3', tag: 'UB' },
]

export default function ReorderPage() {
  // State
  const [activeSeller, setActiveSeller] = useState<Seller>(SELLERS[0])
  const [activeTab, setActiveTab] = useState<'main' | 'final'>('main')
  const [products, setProducts] = useState<ReorderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- 1. Fetch Data ---
  const fetchReorderData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from(`usa_reorder_${activeSeller.table_suffix}`)
        .select('*')
        .order('status', { ascending: false }) // 'Reorder' first, then 'Safe'
        .order('product_name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Refetch when seller changes
  useEffect(() => {
    fetchReorderData()
  }, [activeSeller])

  // --- 2. Sync Listed Products ---
  // Fetches only "Listed" items from Listing & Error and adds them here
  const handleSyncListings = async () => {
    try {
      setProcessing(true)

      // A. Get "Listed" items from Listing Module (DONE items only)
      const listingTable = `usa_listing_error_${activeSeller.table_suffix}_done`
      const { data: listedItems, error: listError } = await supabase
        .from(listingTable)
        .select('asin, product_name, seller_link')

      if (listError) throw listError
      if (!listedItems || listedItems.length === 0) {
        alert('No listed items found to sync.')
        return
      }

      // B. Get existing Reorder items to avoid duplicates
      const reorderTable = `usa_reorder_${activeSeller.table_suffix}`
      const { data: existingItems } = await supabase
        .from(reorderTable)
        .select('asin')

      const existingAsins = new Set(existingItems?.map(p => p.asin))

      // C. Filter new items
      const newItems = listedItems
        .filter(p => !existingAsins.has(p.asin))
        .map(p => ({
          asin: p.asin,
          product_name: p.product_name,
          seller_link: p.seller_link,
          admin_target_qty: 0,
          current_qty: 0,
          status: 'Safe'
        }))

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from(reorderTable)
          .insert(newItems)

        if (insertError) throw insertError
        alert(`Synced ${newItems.length} new products!`)
        fetchReorderData()
      } else {
        alert('All listed products are already in Reorder.')
      }

    } catch (err: any) {
      console.error('Sync error:', err)
      alert('Failed to sync: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // --- 3. Upload Inventory (Current Qty) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[]
          const updates: Record<string, number> = {}

          // Smart Header Matching
          rows.forEach(row => {
            const asinKey = Object.keys(row).find(k => k.toLowerCase().includes('asin'))
            const qtyKey = Object.keys(row).find(k =>
              k.toLowerCase().includes('fulfillable') || k.toLowerCase().includes('quantity')
            )

            if (asinKey && qtyKey) {
              const asin = row[asinKey]?.trim()
              const qty = parseInt(row[qtyKey] || '0')
              if (asin) updates[asin] = qty
            }
          })

          // Update DB
          const promises = products
            .filter(p => updates[p.asin] !== undefined)
            .map(p =>
              supabase
                .from(`usa_reorder_${activeSeller.table_suffix}`)
                .update({ current_qty: updates[p.asin] })
                .eq('asin', p.asin)
            )

          await Promise.all(promises)
          alert('Inventory updated successfully! Recalculating...')
          await handleRecalculate() // Auto-calculate logic after upload

        } catch (err) {
          console.error(err)
          alert('Error processing file')
        } finally {
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }
    })
  }

  // --- 4. EXCEL LOGIC CALCULATION ---
  const handleRecalculate = async () => {
    try {
      setProcessing(true)

      // A. Fetch Tracking Data (Sum incoming qty per ASIN)
      const { data: trackingData, error: trackError } = await supabase
        .from('usa_traking') // Note: using your spelling 'traking'
        .select('asin, buying_quantity')

      if (trackError) throw trackError

      const incomingMap: Record<string, number> = {}
      trackingData?.forEach(t => {
        const qty = t.buying_quantity || 0
        if (!incomingMap[t.asin]) incomingMap[t.asin] = 0
        incomingMap[t.asin] += qty
      })

      // B. Fetch Latest Reorder Data
      const { data: currentReorderData } = await supabase
        .from(`usa_reorder_${activeSeller.table_suffix}`)
        .select('*')

      if (!currentReorderData) return

      // C. APPLY LOGIC
      const updates = currentReorderData.map(p => {
        const target = p.admin_target_qty || 0
        const current = p.current_qty || 0
        const incoming = incomingMap[p.asin] || 0

        // Step 1: Calculate Deficit
        const deficit = target - current
        let finalReorder = 0
        let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'

        if (deficit > 0) {
          // Step 2: Subtract Incoming (Excel Logic)
          finalReorder = Math.max(0, deficit - incoming)

          if (finalReorder > 0) {
            status = 'Reorder' // Needs to be ordered
          } else {
            status = 'Covered' // Deficit exists but covered by tracking
          }
        } else {
          status = 'Safe' // Stock is healthy
        }

        return {
          id: p.id,
          tracking_qty: incoming,
          final_reorder_qty: finalReorder,
          status: status
        }
      })

      // D. Save to DB
      const updatePromises = updates.map(u =>
        supabase
          .from(`usa_reorder_${activeSeller.table_suffix}`)
          .update({
            tracking_qty: u.tracking_qty,
            final_reorder_qty: u.final_reorder_qty,
            status: u.status
          })
          .eq('id', u.id)
      )

      await Promise.all(updatePromises)

      fetchReorderData() // Refresh UI

    } catch (err: any) {
      alert('Calculation failed: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // --- 5. Edit Target Qty ---
  // --- 5. Edit Target Qty (With Auto-Calculation) ---
  const updateTargetQty = async (id: string, newTarget: number) => {
    // 1. Find the product
    const product = products.find(p => p.id === id)
    if (!product) return

    // 2. Perform the Calculation Logic Locally
    const current = product.current_qty
    const incoming = product.tracking_qty // Already fetched

    const deficit = newTarget - current
    let finalReorder = 0
    let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'

    if (deficit > 0) {
      // Excel Logic: Deficit - Incoming
      finalReorder = Math.max(0, deficit - incoming)

      if (finalReorder > 0) {
        status = 'Reorder'
      } else {
        status = 'Covered'
      }
    } else {
      status = 'Safe'
    }

    // 3. Optimistic UI Update (Instant Feedback)
    setProducts(prev => prev.map(p => p.id === id ? {
      ...p,
      admin_target_qty: newTarget,
      final_reorder_qty: finalReorder,
      status: status
    } : p))

    // 4. Save Everything to DB
    await supabase
      .from(`usa_reorder_${activeSeller.table_suffix}`)
      .update({
        admin_target_qty: newTarget,
        final_reorder_qty: finalReorder,
        status: status
      })
      .eq('id', id)
  }

  // --- 6. Export ---
  const handleExport = () => {
    const dataToExport = activeTab === 'main'
      ? products
      : products.filter(p => p.status === 'Reorder')

    const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(p => ({
      ASIN: p.asin,
      'Product Name': p.product_name,
      'Target Qty': p.admin_target_qty,
      'Current Qty': p.current_qty,
      'Incoming (Tracking)': p.tracking_qty,
      'Final Reorder': p.final_reorder_qty,
      'Status': p.status
    })))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reorder")
    XLSX.writeFile(workbook, `Reorder_${activeSeller.name}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Filter View
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase())

    if (activeTab === 'final') {
      return matchesSearch && p.status === 'Reorder'
    }
    return matchesSearch
  })

  return (
    <div className="h-screen flex flex-col bg-slate-50">

      {/* HEADER & CONTROLS */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-none">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Replenishment Manager</h1>
            <p className="text-slate-500 text-sm">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {SELLERS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSeller(s)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeSeller.id === s.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'main' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Main Workspace
            </button>
            <button
              onClick={() => setActiveTab('final')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'final' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              Final Reorder ({products.filter(p => p.status === 'Reorder').length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'main' && (
              <>
                <button onClick={handleSyncListings} disabled={processing} className="flex items-center gap-2 px-3 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${processing ? 'animate-spin' : ''}`} />
                  Sync Listed ASINs
                </button>

                <div className="relative">
                  <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-xs font-medium transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Inventory
                  </button>
                </div>

                <button
                  onClick={handleRecalculate}
                  disabled={processing}
                  className="flex items-center gap-2 px-3 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 text-xs font-medium shadow-sm transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Run Calculation
                </button>
              </>
            )}

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* TABLE CONTENT */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by ASIN or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-200">ASIN</th>
                  <th className="px-6 py-4 border-b border-slate-200 w-1/4">Product Details</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center bg-indigo-50/50 text-indigo-700">Target Qty</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center bg-orange-50/50 text-orange-700">Current Qty</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center text-slate-600">Deficit</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center bg-blue-50/50 text-blue-700">Tracking</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center bg-rose-50/50 text-rose-700">Final Order</th>
                  <th className="px-6 py-4 border-b border-slate-200 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="p-12 text-center text-slate-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" />Loading data...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={8} className="p-12 text-center text-slate-400">No products match your criteria.</td></tr>
                ) : (
                  filteredProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-slate-600 font-medium">{product.asin}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-slate-900 font-medium truncate max-w-xs" title={product.product_name || ''}>{product.product_name || '-'}</span>
                            {product.seller_link && (
                              <a href={product.seller_link} target="_blank" className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1">
                                View Listing <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center bg-indigo-50/20">
                          <input
                            type="number"
                            value={product.admin_target_qty}
                            onChange={(e) => updateTargetQty(product.id, parseInt(e.target.value) || 0)}
                            className="w-24 text-center py-1 px-2 border border-indigo-200 rounded-md text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                          />
                        </td>

                        <td className="px-6 py-4 text-center bg-orange-50/20 text-orange-700 font-medium text-sm">
                          {product.current_qty}
                        </td>

                        <td className={`px-6 py-4 text-center font-bold text-sm ${deficit > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {deficit}
                        </td>

                        <td className="px-6 py-4 text-center bg-blue-50/20 text-blue-700 font-medium text-sm">
                          {product.tracking_qty}
                        </td>

                        <td className="px-6 py-4 text-center bg-rose-50/20">
                          {product.final_reorder_qty > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm font-bold bg-rose-100 text-rose-700 shadow-sm">
                              {product.final_reorder_qty}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {product.status === 'Reorder' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3.5 h-3.5" /> Reorder
                            </span>
                          )}
                          {product.status === 'Covered' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              <Package className="w-3.5 h-3.5" /> Covered
                            </span>
                          )}
                          {product.status === 'Safe' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Safe
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Showing {filteredProducts.length} items</span>
            {activeTab === 'final' && (
              <div className="text-sm text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                Total Units to Order: <span className="font-bold text-rose-600 ml-1">{filteredProducts.reduce((sum, p) => sum + p.final_reorder_qty, 0)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}