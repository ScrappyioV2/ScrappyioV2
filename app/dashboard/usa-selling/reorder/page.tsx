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
  emoji: string
  activeColor: string
  activeShadow: string
}

// Configured Sellers with Colors & Emojis
const SELLERS: Seller[] = [
  { 
    id: 4, 
    name: 'Velvet Vista', 
    table_suffix: 'seller_4', 
    tag: 'VV', 
    emoji: '💜', 
    activeColor: 'bg-violet-600', 
    activeShadow: 'shadow-violet-500/40' 
  },
  { 
    id: 1, 
    name: 'Golden Aura', 
    table_suffix: 'seller_1', 
    tag: 'GA', 
    emoji: '✨', 
    activeColor: 'bg-amber-500', 
    activeShadow: 'shadow-amber-500/40' 
  },
  { 
    id: 2, 
    name: 'Rudra Retail', 
    table_suffix: 'seller_2', 
    tag: 'RR', 
    emoji: '🔴', 
    activeColor: 'bg-red-600', 
    activeShadow: 'shadow-red-500/40' 
  },
  { 
    id: 3, 
    name: 'UBeauty', 
    table_suffix: 'seller_3', 
    tag: 'UB', 
    emoji: '💄', 
    activeColor: 'bg-pink-500', 
    activeShadow: 'shadow-pink-500/40' 
  },
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
        .order('status', { ascending: false })
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
  const handleSyncListings = async () => {
    try {
      setProcessing(true)

      const listingTable = `usa_listing_error_${activeSeller.table_suffix}_done`
      const { data: listedItems, error: listError } = await supabase
        .from(listingTable)
        .select('asin, product_name, seller_link')

      if (listError) throw listError
      if (!listedItems || listedItems.length === 0) {
        alert('No listed items found to sync.')
        return
      }

      const reorderTable = `usa_reorder_${activeSeller.table_suffix}`
      const { data: existingItems } = await supabase
        .from(reorderTable)
        .select('asin')

      const existingAsins = new Set(existingItems?.map(p => p.asin))

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

  // --- 3. Upload Inventory ---
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
          await handleRecalculate()

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

  // --- 4. Recalculate Logic ---
  const handleRecalculate = async () => {
    try {
      setProcessing(true)

      const { data: trackingData, error: trackError } = await supabase
        .from('usa_traking')
        .select('asin, buying_quantity')

      if (trackError) throw trackError

      const incomingMap: Record<string, number> = {}
      trackingData?.forEach(t => {
        const qty = t.buying_quantity || 0
        if (!incomingMap[t.asin]) incomingMap[t.asin] = 0
        incomingMap[t.asin] += qty
      })

      const { data: currentReorderData } = await supabase
        .from(`usa_reorder_${activeSeller.table_suffix}`)
        .select('*')

      if (!currentReorderData) return

      const updates = currentReorderData.map(p => {
        const target = p.admin_target_qty || 0
        const current = p.current_qty || 0
        const incoming = incomingMap[p.asin] || 0

        const deficit = target - current
        let finalReorder = 0
        let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'

        if (deficit > 0) {
          finalReorder = Math.max(0, deficit - incoming)
          if (finalReorder > 0) {
            status = 'Reorder'
          } else {
            status = 'Covered'
          }
        } else {
          status = 'Safe'
        }

        return {
          id: p.id,
          tracking_qty: incoming,
          final_reorder_qty: finalReorder,
          status: status
        }
      })

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
      fetchReorderData()

    } catch (err: any) {
      alert('Calculation failed: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  // --- 5. Update Target Qty ---
  const updateTargetQty = async (id: string, newTarget: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    const current = product.current_qty
    const incoming = product.tracking_qty

    const deficit = newTarget - current
    let finalReorder = 0
    let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'

    if (deficit > 0) {
      finalReorder = Math.max(0, deficit - incoming)
      if (finalReorder > 0) {
        status = 'Reorder'
      } else {
        status = 'Covered'
      }
    } else {
      status = 'Safe'
    }

    setProducts(prev => prev.map(p => p.id === id ? {
      ...p,
      admin_target_qty: newTarget,
      final_reorder_qty: finalReorder,
      status: status
    } : p))

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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase())

    if (activeTab === 'final') {
      return matchesSearch && p.status === 'Reorder'
    }
    return matchesSearch
  })

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">

      {/* HEADER SECTION */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Replenishment Manager</h1>
            <p className="text-slate-400 mt-1">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>

          {/* COLORFUL SELLER TABS */}
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-xl">
            {SELLERS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSeller(s)}
                className={`relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeSeller.id === s.id
                    ? `${s.activeColor} text-white ${s.activeShadow} shadow-lg scale-105 z-10`
                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  }`}
              >
                <span className="text-base">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'main'
              ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
              }`}
          >
            Main Workspace ({products.length})
          </button>

          <button
            onClick={() => setActiveTab('final')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl flex items-center gap-2 transition-all duration-300 ${activeTab === 'final'
              ? 'bg-slate-800 text-rose-400 shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
              }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Final Reorder ({products.filter(p => p.status === 'Reorder').length})
          </button>
        </div>
      </div>

      {/* CONTROLS (Search & Buttons) */}
      <div className="flex gap-3 items-center mb-6 px-6 pt-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ASIN or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-600"
          />
        </div>

        {activeTab === 'main' && (
          <div className="flex gap-2">
            <button
              onClick={handleSyncListings}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
              Sync Listed
            </button>

            <div className="relative">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Inventory
              </button>
            </div>

            <button
              onClick={handleRecalculate}
              disabled={processing}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg text-sm font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              Run Calculation
            </button>
          </div>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-lg text-sm font-medium transition-colors ml-auto"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* TABLE CONTENT */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-slate-800">
              <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">ASIN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800 w-1/4">Product Name</th>
                  {/* ✅ NEW DEDICATED COLUMN FOR LINK */}
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Link</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-indigo-400 uppercase bg-indigo-900/20 border-r border-slate-800">Target Qty</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-orange-400 uppercase bg-orange-900/20 border-r border-slate-800">Current Qty</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Deficit</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-blue-400 uppercase bg-blue-900/20 border-r border-slate-800">Tracking</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-rose-400 uppercase bg-rose-900/20 border-r border-slate-800">Final Order</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                      <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
                      Loading data...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-500">
                      No products match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-slate-300 font-medium border-r border-slate-800/50">
                          {product.asin}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-800/50">
                          <span className="text-sm text-slate-200 font-medium block truncate max-w-xs" title={product.product_name || ''}>
                            {product.product_name || '-'}
                          </span>
                        </td>

                        {/* ✅ DEDICATED LINK CELL */}
                        <td className="px-6 py-4 text-center border-r border-slate-800/50">
                          {product.seller_link ? (
                            <a
                              href={product.seller_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center bg-indigo-900/10 border-r border-slate-800/50">
                          <input
                            type="number"
                            value={product.admin_target_qty}
                            onChange={(e) => updateTargetQty(product.id, parseInt(e.target.value) || 0)}
                            className="w-24 text-center py-1.5 px-2 bg-slate-800 border border-indigo-500/30 rounded-md text-sm text-white font-medium focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                          />
                        </td>

                        <td className="px-6 py-4 text-center bg-orange-900/10 text-orange-300 font-medium text-sm border-r border-slate-800/50">
                          {product.current_qty}
                        </td>

                        <td className={`px-6 py-4 text-center font-bold text-sm border-r border-slate-800/50 ${deficit > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {deficit}
                        </td>

                        <td className="px-6 py-4 text-center bg-blue-900/10 text-blue-300 font-medium text-sm border-r border-slate-800/50">
                          {product.tracking_qty}
                        </td>

                        <td className="px-6 py-4 text-center bg-rose-900/10 border-r border-slate-800/50">
                          {product.final_reorder_qty > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm font-bold bg-rose-500/20 text-rose-300 shadow-sm border border-rose-500/20">
                              {product.final_reorder_qty}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          {product.status === 'Reorder' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="w-3.5 h-3.5" /> Reorder
                            </span>
                          )}
                          {product.status === 'Covered' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              <Package className="w-3.5 h-3.5" /> Covered
                            </span>
                          )}
                          {product.status === 'Safe' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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

          {/* Footer Stats */}
          <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3 flex justify-between items-center">
            <div className="text-sm text-slate-400">
              Showing {filteredProducts.length} items
            </div>
            {activeTab === 'final' && (
              <div className="text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm">
                Total Units to Order: <span className="font-bold text-rose-400 ml-1">{filteredProducts.reduce((sum, p) => sum + p.final_reorder_qty, 0)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}