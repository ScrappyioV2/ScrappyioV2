'use client'

import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
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
  History,
  ArrowRightCircle,
  X,
  Send,
  Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ConfirmDialog from '@/components/ConfirmDialog';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// --- Types ---
type ReorderProduct = {
  id: string;
  asin: string;
  sku?: string | null;
  product_name: string | null;
  seller_link: string | null;
  admin_target_qty: number;
  current_qty: number;
  tracking_qty: number;
  tracking_sources?: { inbound: number; boxes: number; checking: number; restock: number };
  final_reorder_qty: number;
  status: 'Safe' | 'Covered' | 'Reorder';
  updated_at: string;
  journey_id?: string;
  journey_number?: number;
  is_in_final_reorder?: boolean;
  remark: string | null;
  funnel?: string | null;
  origin_india?: boolean | null;
  origin_china?: boolean | null;
  origin_us?: boolean | null;
};

type HistorySnapshot = {
  id: string
  stage: string
  created_at: string
  snapshot_data: any
  journey_number: number
  profit?: number
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

// Configured Sellers
const SELLERS: Seller[] = [
  { id: 1, name: "Golden Aura", table_suffix: "seller_1", tag: "GR", emoji: "✨", activeColor: "bg-amber-500", activeShadow: "shadow-amber-500/40" },
  { id: 2, name: "Rudra Retail", table_suffix: "seller_2", tag: "RR", emoji: "🔴", activeColor: "bg-red-600", activeShadow: "shadow-red-500/40" },
  { id: 3, name: "UBeauty", table_suffix: "seller_3", tag: "UB", emoji: "💅", activeColor: "bg-pink-500", activeShadow: "shadow-pink-500/40" },
  { id: 4, name: "Velvet Vista", table_suffix: "seller_4", tag: "VV", emoji: "💜", activeColor: "bg-violet-600", activeShadow: "shadow-violet-500/40" },
  { id: 5, name: "Dropy Ecom", table_suffix: "seller_5", tag: "DE", emoji: "🟠", activeColor: "bg-orange-500", activeShadow: "shadow-orange-500/40" },  // ✅ NEW
  { id: 6, name: "Costech Ventures", table_suffix: "seller_6", tag: "CV", emoji: "🟢", activeColor: "bg-green-600", activeShadow: "shadow-green-500/40" },  // ✅ NEW
];

export default function ReorderPage() {
  // State
  const [activeSeller, setActiveSeller] = useState<Seller>(SELLERS[0])
  const [activeTab, setActiveTab] = useState<'main' | 'final'>('main')
  const [products, setProducts] = useState<ReorderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { logActivity } = useActivityLogger();
  // Filter states (persisted)
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [originFilter, setOriginFilter] = useState<'ALL' | 'India' | 'China' | 'US'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaReorderOriginFilter') as 'ALL' | 'India' | 'China' | 'US') || 'ALL';
  });

  const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaReorderFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
  });

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Safe' | 'Covered' | 'Reorder'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaReorderStatusFilter') as 'ALL' | 'Safe' | 'Covered' | 'Reorder') || 'ALL';
  });

  useEffect(() => {
    localStorage.setItem('indiaReorderOriginFilter', originFilter);
  }, [originFilter]);

  useEffect(() => {
    localStorage.setItem('indiaReorderFunnelFilter', funnelFilter);
  }, [funnelFilter]);

  useEffect(() => {
    localStorage.setItem('indiaReorderStatusFilter', statusFilter);
  }, [statusFilter]);
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);  // ✅ ADD THIS
  const [selectedRemark, setSelectedRemark] = useState<{ id: string; asin: string; remark: string | null } | null>(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [editingRemarkProductId, setEditingRemarkProductId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  // --- 1. Fetch Data ---
  const fetchReorderData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from(`india_reorder_${activeSeller.table_suffix}`)
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

  useEffect(() => {
    fetchReorderData()
  }, [activeSeller])

  // --- 2. Sync Listed Products (FIXED: Carries Journey ID) ---
  const handleSyncListings = async () => {
    try {
      setProcessing(true)

      const listingTable = `india_listing_error_${activeSeller.table_suffix}_done`
      // ✅ Fetch journey_id from source
      const { data: listedItems, error: listError } = await supabase
        .from(listingTable)
        .select('asin, product_name, seller_link, journey_id, journey_number, remark, sku')

      if (listError) throw listError
      if (!listedItems || listedItems.length === 0) {
        alert('No listed items found to sync.')
        return
      }

      const reorderTable = `india_reorder_${activeSeller.table_suffix}`
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
          status: 'Safe',
          journey_id: p.journey_id, // ✅ Pass the Bag
          journey_number: p.journey_number,
          is_in_final_reorder: false,
          remark: p.remark ?? null,
          sku: p.sku ?? null,
        }))

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from(reorderTable)
          .insert(newItems)

        if (insertError) throw insertError
        alert(`Synced ${newItems.length} new products with history links!`);
        // ✅ ADD THIS:
        logActivity({
          action: 'submit',
          marketplace: 'india',
          page: 'reorder',
          table_name: `india_reorder_${activeSeller.table_suffix}`,
          asin: `${newItems.length} ASINs synced`,
          details: { seller: activeSeller.name }
        });
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

  // --- 3. Upload Inventory (Optimized for your CSV) ---
  // const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0]
  //   if (!file) return

  //   setProcessing(true)

  //   Papa.parse(file, {
  //     header: true,
  //     skipEmptyLines: true,
  //     // 1. Clean headers (removes hidden BOM characters and spaces)
  //     transformHeader: (header) => header.replace(/[\ufeff]/g, '').trim(),
  //     complete: async (results) => {
  //       try {
  //         const rows = results.data as any[]
  //         const updates: Record<string, number> = {}
  //         let matchCount = 0

  //         rows.forEach((row) => {
  //           const keys = Object.keys(row)

  //           // 2. Specific matching for your file headers
  //           const asinKey = keys.find(k => k.toLowerCase() === 'asin')
  //           const qtyKey = keys.find(k =>
  //             k.toLowerCase() === 'afn-fulfillable-quantity' ||
  //             k.toLowerCase().includes('quantity') ||
  //             k.toLowerCase().includes('fulfillable')
  //           )

  //           if (asinKey && qtyKey) {
  //             const rawAsin = row[asinKey]
  //             const rawQty = row[qtyKey]

  //             if (rawAsin) {
  //               // Normalize: Uppercase and Trim (e.g. "b09..." -> "B09...")
  //               const asin = String(rawAsin).trim().toUpperCase()
  //               // Parse Quantity: "10" -> 10
  //               const qty = parseInt(String(rawQty).replace(/[^0-9]/g, '') || '0')
  //               updates[asin] = qty
  //             }
  //           }
  //         })

  //         // 3. Find matches in your current workspace
  //         const promises = products
  //           .filter(p => {
  //             const pAsin = p.asin.trim().toUpperCase()
  //             return updates[pAsin] !== undefined
  //           })
  //           .map(p => {
  //             matchCount++
  //             const pAsin = p.asin.trim().toUpperCase()
  //             return supabase
  //               .from(`india_reorder_${activeSeller.table_suffix}`)
  //               .update({ current_qty: updates[pAsin] })
  //               .eq('id', p.id)
  //           })

  //         if (matchCount === 0) {
  //           alert(`No matches found! \n\nWe checked ${rows.length} CSV rows against your listed products, but none matched.\n\nExample CSV ASIN: ${rows[0]?.Asin || 'N/A'}\nExample Screen ASIN: ${products[0]?.asin || 'N/A'}`)
  //           setProcessing(false)
  //           return
  //         }

  //         // 4. Execute Updates
  //         await Promise.all(promises)
  //         await fetchReorderData() // Refresh UI immediately

  //         // 5. Offer Recalculation
  //         const autoRecalc = window.confirm(`Success! Updated ${matchCount} products.\n\nDo you want to run the Reorder Calculation now?`)
  //         if (autoRecalc) {
  //           await handleRecalculate()
  //         }

  //       } catch (err: any) {
  //         console.error(err)
  //         alert('Error processing file: ' + err.message)
  //       } finally {
  //         setProcessing(false)
  //         if (fileInputRef.current) fileInputRef.current.value = ''
  //       }
  //     }
  //   })
  // }

  // --- 3. Upload Inventory (Enhanced: CSV + Excel Support) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setProcessing(true)

    // ✅ NEW: Detect file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      // 📄 Handle CSV File (Original Logic)
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.replace(/[\ufeff]/g, '').trim(),
        complete: async (results) => {
          await processInventoryData(results.data as any[])
        },
        error: (error) => {
          console.error('CSV Parse Error:', error)
          alert('Failed to parse CSV file: ' + error.message)
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // 📊 Handle Excel File (NEW)
      const reader = new FileReader()

      reader.onload = async (evt) => {
        try {
          const data = evt.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          // ✅ Read ALL sheets and merge data
          let allRows: any[] = []

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName]
            const sheetData = XLSX.utils.sheet_to_json(worksheet, { raw: false })
            allRows = allRows.concat(sheetData)
          })

          console.log(`📊 Excel: Found ${workbook.SheetNames.length} sheet(s), Total rows: ${allRows.length}`)

          await processInventoryData(allRows)

        } catch (error: any) {
          console.error('Excel Parse Error:', error)
          alert('Failed to parse Excel file: ' + error.message)
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }

      reader.onerror = (error) => {
        console.error('File Read Error:', error)
        alert('Failed to read file')
        setProcessing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }

      reader.readAsBinaryString(file)

    } else {
      alert('Unsupported file format. Please upload CSV, XLSX, or XLS files.')
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ✅ NEW: Unified Data Processing Function (Works for Both CSV & Excel)
  const processInventoryData = async (rows: any[]) => {
    try {
      const updates: Record<string, number> = {}
      let matchCount = 0

      rows.forEach((row) => {
        const keys = Object.keys(row)

        // ✅ ENHANCED: Flexible ASIN matching (case-insensitive)
        const asinKey = keys.find(k => {
          const lower = k.toLowerCase().trim()
          return lower === 'asin'
        })

        // ✅ ENHANCED: Flexible Quantity matching (multiple variations)
        const qtyKey = keys.find(k => {
          const lower = k.toLowerCase().trim()
          return (
            lower === 'afn-fulfillable-quantity' ||
            lower === 'afn-fulfillable-quentity' ||
            lower === 'quantity' ||
            lower === 'quentity' ||
            lower === 'qty' ||
            lower === 'fulfillable' ||
            lower.includes('quantity') ||
            lower.includes('fulfillable')
          )
        })

        if (asinKey && qtyKey) {
          const rawAsin = row[asinKey]
          const rawQty = row[qtyKey]

          if (rawAsin) {
            // Normalize: Uppercase and Trim
            const asin = String(rawAsin).trim().toUpperCase()
            // Parse Quantity
            const qty = parseInt(String(rawQty).replace(/[^0-9]/g, '') || '0')
            updates[asin] = qty
          }
        }
      })

      // Find matches in current workspace
      const promises = products
        .filter(p => {
          const pAsin = p.asin.trim().toUpperCase()
          return updates[pAsin] !== undefined
        })
        .map(p => {
          matchCount++
          const pAsin = p.asin.trim().toUpperCase()
          return supabase
            .from(`india_reorder_${activeSeller.table_suffix}`)
            .update({ current_qty: updates[pAsin] })
            .eq('id', p.id)
        })

      if (matchCount === 0) {
        alert(`No matches found! \n\nWe checked ${rows.length} rows against your listed products, but none matched.\n\nExample File ASIN: ${rows[0]?.ASIN || rows[0]?.asin || rows[0]?.Asin || 'N/A'}\nExample Screen ASIN: ${products[0]?.asin || 'N/A'}`)
        setProcessing(false)
        return
      }

      // Execute Updates
      await Promise.all(promises)
      await fetchReorderData(); // Refresh UI immediately
      // ✅ ADD THIS:
      logActivity({
        action: 'submit',
        marketplace: 'india',
        page: 'reorder',
        table_name: `india_reorder_${activeSeller.table_suffix}`,
        asin: `${matchCount} ASINs updated`,
        details: { type: 'inventory_upload', seller: activeSeller.name }
      });

      // Offer Recalculation
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setConfirmDialog({
        title: 'Recalculate Reorder?',
        message: `Success! Updated ${matchCount} products.\n\nDo you want to run the Reorder Calculation now?`,
        confirmText: 'Recalculate',
        type: 'warning',
        onConfirm: async () => {
          setConfirmDialog(null);
          await handleRecalculate()
        }
      });

    } catch (err: any) {
      console.error(err)
      alert('Error processing file: ' + err.message)
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // --- 4. Recalculate Logic (✅ UPDATED: Checks new tracking tables) ---
  const handleRecalculate = async () => {
    try {
      setProcessing(true)

      const sellerTag = activeSeller.tag  // e.g. 'GR', 'RR', etc.

      // ✅ Fetch current reorder data
      const { data: currentReorderData } = await supabase
        .from(`india_reorder_${activeSeller.table_suffix}`)
        .select('*')

      if (!currentReorderData || currentReorderData.length === 0) {
        alert('No products in reorder table.')
        return
      }

      console.log(`🚀 Recalculating for ${activeSeller.name} (${sellerTag})...`)

      // ✅ Build tracking quantity map by summing across ALL 4 pipeline tables
      const trackingMap: Record<string, number> = {}

      const trackingSourcesMap: Record<string, { inbound: number; boxes: number; checking: number; restock: number }> = {}

      const addToSourceMap = (asin: string, qty: number, source: 'inbound' | 'boxes' | 'checking' | 'restock') => {
        if (!asin || qty <= 0) return
        const key = asin.trim().toUpperCase()
        if (!trackingSourcesMap[key]) trackingSourcesMap[key] = { inbound: 0, boxes: 0, checking: 0, restock: 0 }
        trackingSourcesMap[key][source] += qty
      }

      const addToMap = (asin: string, qty: number) => {
        if (!asin || qty <= 0) return
        const key = asin.trim().toUpperCase()
        trackingMap[key] = (trackingMap[key] || 0) + qty
      }

      // ✅ Helper: For shared tables with possible comma-separated seller_tag,
      // calculate this seller's share of buying_quantity
      const getSellerShare = (rowSellerTag: string, buyingQty: number): number => {
        if (!rowSellerTag || !buyingQty) return 0
        const tags = rowSellerTag.split(',').map(t => t.trim().toUpperCase())
        if (!tags.includes(sellerTag)) return 0
        // If single seller tag, full qty. If comma-separated, divide equally.
        return Math.floor(buyingQty / tags.length)
      }

      // --- Table 1: india_inbound_tracking (shared) ---
      {
        const { data, error } = await supabase
          .from('india_inbound_tracking')
          .select('asin, buying_quantity, seller_tag')
          .like('seller_tag', `%${sellerTag}%`)

        if (error) console.warn('⚠️ Error querying india_inbound_tracking:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'inbound')
          })
          console.log(`  📦 Inbound: ${data?.length || 0} rows matched for ${sellerTag}`)
        }
      }

      // --- Table 2: india_inbound_boxes (shared) ---
      {
        const { data, error } = await supabase
          .from('india_inbound_boxes')
          .select('asin, buying_quantity, seller_tag')
          .like('seller_tag', `%${sellerTag}%`)

        if (error) console.warn('⚠️ Error querying india_inbound_boxes:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'boxes')
          })
          console.log(`  📦 Boxes: ${data?.length || 0} rows matched for ${sellerTag}`)
        }
      }

      // --- Table 3: india_box_checking (shared) ---
      {
        const { data, error } = await supabase
          .from('india_box_checking')
          .select('asin, buying_quantity, seller_tag')
          .like('seller_tag', `%${sellerTag}%`)

        if (error) console.warn('⚠️ Error querying india_box_checking:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'checking')
          })
          console.log(`  📦 Checking: ${data?.length || 0} rows matched for ${sellerTag}`)
        }
      }

      // --- Table 4: india_restock_seller_X (per-seller, no split needed) ---
      {
        const restockTable = `india_restock_${activeSeller.table_suffix}`
        const { data, error } = await supabase
          .from(restockTable)
          .select('asin, buying_quantity')

        if (error) console.warn(`⚠️ Error querying ${restockTable}:`, error.message)
        else {
          data?.forEach(row => {
            addToMap(row.asin, row.buying_quantity || 0)
            addToSourceMap(row.asin, row.buying_quantity || 0, 'restock')
          })
          console.log(`  📦 Restock: ${data?.length || 0} rows`)
        }
      }

      console.log('✅ Tracking map built:', Object.keys(trackingMap).length, 'unique ASINs')

      // ✅ Calculate reorder quantities
      const updates = currentReorderData.map(p => {
        const target = p.admin_target_qty || 0
        const current = p.current_qty || 0
        const incoming = trackingMap[p.asin?.trim().toUpperCase()] || 0

        const deficit = target - current
        let finalReorder = 0
        let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'
        let isInFinalReorder = false

        if (deficit > 0) {
          finalReorder = Math.max(0, deficit - incoming)
          if (finalReorder > 0) {
            status = 'Reorder'
            isInFinalReorder = true
          } else {
            status = 'Covered'
            isInFinalReorder = false
          }
        } else {
          status = 'Safe'
          isInFinalReorder = false
        }

        return {
          id: p.id,
          tracking_qty: incoming,
          tracking_sources: trackingSourcesMap[p.asin?.trim().toUpperCase()] || { inbound: 0, boxes: 0, checking: 0, restock: 0 },
          final_reorder_qty: finalReorder,
          status: status,
          is_in_final_reorder: isInFinalReorder
        }
      })

      // ✅ Update database
      const updatePromises = updates.map(u =>
        supabase
          .from(`india_reorder_${activeSeller.table_suffix}`)
          .update({
            tracking_qty: u.tracking_qty,
            final_reorder_qty: u.final_reorder_qty,
            status: u.status,
            is_in_final_reorder: u.is_in_final_reorder
          })
          .eq('id', u.id)
      )

      await Promise.all(updatePromises)

      // Merge tracking sources into local state (client-side only, not persisted to DB)
      const sourcesById = new Map(updates.map(u => [u.id, u]))
      setProducts(prev => prev.map(p => {
        const update = sourcesById.get(p.id)
        if (!update) return p
        return {
          ...p,
          tracking_qty: update.tracking_qty,
          final_reorder_qty: update.final_reorder_qty,
          status: update.status,
          is_in_final_reorder: update.is_in_final_reorder,
          tracking_sources: update.tracking_sources,
        }
      }))

      alert(`✅ Calculation complete! Tracked ${Object.keys(trackingMap).length} ASINs across Inbound → Boxes → Checking → Restock.`);
      logActivity({
        action: 'submit',
        marketplace: 'india',
        page: 'reorder',
        table_name: `india_reorder_${activeSeller.table_suffix}`,
        asin: `${updates.length} ASINs recalculated`,
        details: { type: 'recalculate', seller: activeSeller.name }
      });

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
    let isInFinalReorder = false

    if (deficit > 0) {
      finalReorder = Math.max(0, deficit - incoming)
      if (finalReorder > 0) {
        status = 'Reorder'
        isInFinalReorder = true
      } else {
        status = 'Covered'
        isInFinalReorder = false
      }
    } else {
      status = 'Safe'
      isInFinalReorder = false
    }

    setProducts(prev => prev.map(p => p.id === id ? {
      ...p,
      admin_target_qty: newTarget,
      final_reorder_qty: finalReorder,
      status: status,
      is_in_final_reorder: isInFinalReorder
    } : p))

    await supabase
      .from(`india_reorder_${activeSeller.table_suffix}`)
      .update({
        admin_target_qty: newTarget,
        final_reorder_qty: finalReorder,
        status: status,
        is_in_final_reorder: isInFinalReorder
      })
      .eq('id', id)
  }

  const handleRemarkSave = async (productId: string, newRemark: string | null) => {
    try {
      const { error } = await supabase.from(`india_reorder_${activeSeller.table_suffix}`).update({ remark: newRemark }).eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, remark: newRemark } : p));
    } catch (err: any) { console.error('Failed to update remark:', err); }
  };

  // --- 6. Fetch History (The Sidebar Logic) ---
  const fetchHistory = async (asin: string) => {
    setSelectedHistoryAsin(asin)
    setHistoryLoading(true)
    try {
      // Fetch last 5 history entries
      const { data, error } = await supabase
        .from('india_asin_history')
        .select('*')
        .eq('asin', asin)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setHistoryData(data || [])
    } catch (err) {
      console.error(err)
      alert('Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }

  // --- 7. Send Back to Validation (Restart Loop) ---
  const sendToValidation = (product: ReorderProduct) => {
    setConfirmDialog({
      title: 'Send Back to Validation',
      message: `Send ASIN ${product.asin} back to Validation for re-evaluation?`,
      confirmText: 'Send to Validation',
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setProcessing(true)

          // 🔍 STEP 1: Fetch the ACTUAL max journey_number from history
          const { data: historyData, error: historyError } = await supabase
            .from('india_asin_history')
            .select('journey_number')
            .eq('asin', product.asin)
            .order('journey_number', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (historyError && historyError.code !== 'PGRST116') {
            throw historyError
          }

          // Calculate ACTUAL next journey number
          const currentMaxJourney = historyData?.journey_number || 1
          const nextJourneyNum = currentMaxJourney + 1

          console.log(`📊 ASIN ${product.asin}: Current max journey = ${currentMaxJourney}, Next = ${nextJourneyNum}`)

          // 🔍 STEP 2: Fetch "Master Data" from the Validation Table itself
          const { data: masterData, error: fetchError } = await supabase
            .from('india_validation_main_file')
            .select('brand, seller_tag, funnel, origin, product_name, india_link, sku')
            .eq('asin', product.asin)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError
          }

          // 3. Generate NEW Journey ID
          const newJourneyId = generateUUID();

          // 4. Insert into Validation Main File with RESTORED DATA
          const { error: insertError } = await supabase
            .from('india_validation_main_file')
            .upsert({
              asin: product.asin,

              // Use master data name if available, otherwise current reorder name
              product_name: masterData?.product_name || product.product_name,

              current_journey_id: newJourneyId, // ✅ New ID
              journey_number: nextJourneyNum,   // ✅ FIXED: Uses actual max + 1
              status: 'pending',

              // ♻️ RESTORED FIELDS (The "Bag" Contents)
              brand: masterData?.brand || null,
              seller_tag: masterData?.seller_tag || null,
              funnel: masterData?.funnel || null,
              origin: masterData?.origin || 'India', // Default to India if unknown
              india_link: masterData?.india_link || product.seller_link,
              remark: product.remark ?? null,
              sku: masterData?.sku || product.sku || null,
              // Reset operational fields
              no_of_seller: 1,
              sent_to_purchases: false,
              admin_status: 'pending',
              // Reset work fields for new journey
              judgement: 'PENDING',
              calculated_judgement: null,
              is_new: true,
              usd_price: null,
              product_weight: null,
              inr_purchase: null,
              inr_purchase_link: null,
              total_cost: null,
              total_revenue: null,
              profit: null,
            }, { onConflict: 'asin' })

          if (insertError) throw insertError

          // 5. 🗑️ REMOVE from Reorder Page (It has moved on)
          const { error: deleteError } = await supabase
            .from(`india_reorder_${activeSeller.table_suffix}`)
            .delete()
            .eq('id', product.id)

          if (deleteError) throw deleteError

          // 6. Update UI instantly
          setProducts(prev => prev.filter(p => p.id !== product.id))
          alert(`✅ ASIN ${product.asin} sent to Validation! Journey #${nextJourneyNum}`);
          // ✅ ADD THIS:
          logActivity({
            action: 'move',
            marketplace: 'india',
            page: 'reorder',
            table_name: `india_reorder_${activeSeller.table_suffix}`,
            asin: product.asin,
            details: { from: 'reorder', to: 'validation', journey: nextJourneyNum }
          });

        } catch (err: any) {
          console.error(err)
          alert('Failed to send: ' + err.message)
        } finally {
          setProcessing(false)
        }
      }
    });
  }

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Origin Filter
    if (originFilter !== 'ALL') {
      if (originFilter === 'India' && !p.origin_india) return false;
      if (originFilter === 'China' && !p.origin_china) return false;
      if (originFilter === 'US' && !p.origin_us) return false;
    }

    // Funnel Filter (RS = HD+LD, DP = DP)
    if (funnelFilter !== 'ALL') {
      const productFunnel = p.funnel;
      if (funnelFilter === 'RS') {
        if (productFunnel !== 'HD' && productFunnel !== 'LD') return false;
      } else if (funnelFilter === 'DP') {
        if (productFunnel !== 'DP') return false;
      }
    }

    // Status Filter (Safe/Covered/Reorder)
    if (statusFilter !== 'ALL') {
      if (p.status !== statusFilter) return false;
    }

    if (activeTab === 'final') {
      return p.status === 'Reorder';
    } else {
      return (p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined);
    }
  });

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 relative overflow-hidden">

      {/* HEADER */}
      <div className="flex-none px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 pb-4 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white">Replenishment Manager</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>

          {/* SELLER TABS */}
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 shadow-xl overflow-x-auto scrollbar-none">
            {SELLERS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSeller(s)}
                className={`relative px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${activeSeller.id === s.id
                  ? `${s.activeColor} text-white ${s.activeShadow} shadow-lg scale-105 z-10`
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                  }`}
              >
                <span className="text-base">{s.emoji}</span>
                <span className="hidden sm:inline">{s.name}</span>
                <span className="sm:hidden">{s.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {/* WORKSPACE TABS */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl transition-all duration-300 whitespace-nowrap ${activeTab === 'main'
              ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
              }`}
          >
            Main Workspace ({products.filter(p => p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined).length})
          </button>

          <button
            onClick={() => setActiveTab('final')}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'final'
              ? 'bg-slate-800 text-rose-400 shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
              }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Final Reorder ({products.filter(p => p.status === 'Reorder' && p.is_in_final_reorder === true).length})
          </button>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex gap-2 sm:gap-3 items-center flex-wrap mb-4 sm:mb-6 px-3 sm:px-4 lg:px-6 pt-4">
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by ASIN, Name, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-600"
          />
        </div>

        {/* Funnel Filter Pills - RS / DP */}
        <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-800 p-1">
          {(['ALL', 'RS', 'DP'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFunnelFilter(opt)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === opt
                ? opt === 'RS' ? 'bg-emerald-600 text-white shadow-lg'
                  : opt === 'DP' ? 'bg-amber-500 text-black shadow-lg'
                    : 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Filter Button + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border ${originFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/30'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {(originFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <span className="w-5 h-5 bg-white/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                {[originFilter !== 'ALL', statusFilter !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-72">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-200 text-sm">Filters</h3>
                  {(originFilter !== 'ALL' || statusFilter !== 'ALL') && (
                    <button
                      onClick={() => { setOriginFilter('ALL'); setStatusFilter('ALL'); }}
                      className="text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Origin Filter */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Origin</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'India', 'China', 'US'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setOriginFilter(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${originFilter === opt
                          ? opt === 'India' ? 'bg-orange-500 text-white'
                            : opt === 'China' ? 'bg-rose-500 text-white'
                              : opt === 'US' ? 'bg-sky-500 text-white'
                                : 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'Safe', 'Covered', 'Reorder'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setStatusFilter(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === opt
                          ? opt === 'Safe' ? 'bg-emerald-500 text-white'
                            : opt === 'Covered' ? 'bg-amber-500 text-black'
                              : opt === 'Reorder' ? 'bg-rose-500 text-white'
                                : 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {activeTab === 'main' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSyncListings} disabled={processing} className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 shrink-0 ${processing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Listed</span><span className="sm:hidden">Sync</span>
            </button>
            <div className="relative">
              <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-medium transition-colors">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Upload Inventory</span><span className="sm:hidden">Upload</span>
              </button>
            </div>
            <button onClick={handleRecalculate} disabled={processing} className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg text-xs sm:text-sm font-medium transition-colors">
              <Save className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Run Calculation</span><span className="sm:hidden">Calculate</span>
            </button>
          </div>
        )}
      </div>

      {/* MAIN TABLE */}
      <div className="flex-1 overflow-hidden px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
        <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-slate-800">
              <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">ASIN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800 w-1/4">Product Name</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">History</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Remark</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-indigo-400 uppercase bg-indigo-900/20 border-r border-slate-800">Target Qty</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-orange-400 uppercase bg-orange-900/20 border-r border-slate-800">Current</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Deficit</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-blue-400 uppercase bg-blue-900/20 border-r border-slate-800">Tracking</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-rose-400 uppercase bg-rose-900/20 border-r border-slate-800">Final Order</th>
                  {activeTab === 'final' && <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={10} className="p-12 text-center text-slate-500"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-indigo-500" />Loading data...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  filteredProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-slate-300 font-medium border-r border-slate-800/50">{product.asin}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500 border-r border-slate-800/50">{product.sku || '-'}</td>
                        <td className="px-6 py-4 border-r border-slate-800/50">
                          <span className="text-sm text-slate-200 font-medium block truncate max-w-xs" title={product.product_name || ''}>{product.product_name || '-'}</span>
                          {product.seller_link && <a href={product.seller_link} target="_blank" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">View Link</a>}
                        </td>

                        {/* ✅ HISTORY BUTTON */}
                        <td className="px-6 py-4 text-center border-r border-slate-800/50">
                          <button
                            onClick={() => fetchHistory(product.asin)}
                            className="p-2 rounded-full hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                            title="View Journey History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </td>

                        {/* ✅ REMARK BUTTON */}
                        <td className="px-4 py-3 text-center">
                          {product.remark ? (
                            <button
                              onClick={() => {
                                setSelectedRemark({
                                  id: product.id,
                                  asin: product.asin,
                                  remark: product.remark,
                                });
                                setEditingRemarkText(product.remark || '');
                                setEditingRemarkProductId(product.id);
                                setRemarkModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                          ) : (
                            <button onClick={() => { setSelectedRemark({ id: product.id, asin: product.asin, remark: null }); setEditingRemarkText(''); setEditingRemarkProductId(product.id); setRemarkModalOpen(true); }} className="text-slate-600 hover:text-slate-400 text-xs cursor-pointer">+ Add</button>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center bg-indigo-900/10 border-r border-slate-800/50">
                          <input
                            type="number"
                            value={product.admin_target_qty}
                            onChange={(e) => updateTargetQty(product.id, parseInt(e.target.value) || 0)}
                            className="w-24 text-center py-1.5 px-2 bg-slate-800 border border-indigo-500/30 rounded-md text-sm text-white font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-center bg-orange-900/10 text-orange-300 font-medium text-sm border-r border-slate-800/50">{product.current_qty}</td>
                        <td className={`px-6 py-4 text-center font-bold text-sm border-r border-slate-800/50 ${deficit > 0 ? 'text-rose-400' : 'text-slate-500'}`}>{deficit}</td>
                        <td className="px-6 py-4 text-center bg-blue-900/10 border-r border-slate-800/50 group/track relative">
                          <span className="text-blue-300 font-medium text-sm cursor-help inline-flex items-center gap-1">
                            {product.tracking_qty}
                            {product.tracking_sources && product.tracking_qty > 0 && (
                              <Info className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </span>
                          {product.tracking_sources && product.tracking_qty > 0 && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/track:block z-50 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2.5 text-xs pointer-events-none">
                              <div className="text-slate-400 font-semibold mb-1.5 text-center">Source Breakdown</div>
                              {product.tracking_sources.inbound > 0 && (
                                <div className="flex justify-between py-0.5">
                                  <span className="text-cyan-400">Inbound</span>
                                  <span className="text-white font-medium">{product.tracking_sources.inbound}</span>
                                </div>
                              )}
                              {product.tracking_sources.boxes > 0 && (
                                <div className="flex justify-between py-0.5">
                                  <span className="text-amber-400">Boxes</span>
                                  <span className="text-white font-medium">{product.tracking_sources.boxes}</span>
                                </div>
                              )}
                              {product.tracking_sources.checking > 0 && (
                                <div className="flex justify-between py-0.5">
                                  <span className="text-purple-400">Checking</span>
                                  <span className="text-white font-medium">{product.tracking_sources.checking}</span>
                                </div>
                              )}
                              {product.tracking_sources.restock > 0 && (
                                <div className="flex justify-between py-0.5">
                                  <span className="text-emerald-400">Restock</span>
                                  <span className="text-white font-medium">{product.tracking_sources.restock}</span>
                                </div>
                              )}
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-slate-700" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center border-r border-slate-800/50">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${product.status === 'Reorder'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : product.status === 'Covered'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                            {product.status || 'Safe'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center bg-rose-900/10 border-r border-slate-800/50">
                          {product.final_reorder_qty > 0 ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm font-bold bg-rose-500/20 text-rose-300">{product.final_reorder_qty}</span> : <span className="text-slate-600">-</span>}
                        </td>

                        {/* ✅ RESTART LOOP BUTTON */}
                        {activeTab === 'final' && (
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => sendToValidation(product)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white rounded-lg border border-indigo-500/30 transition-all text-xs font-medium"
                            >
                              <Send className="w-3 h-3" />
                              To Validation
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ✅ HISTORY SIDEBAR (SLIDE-OVER) */}
      <AnimatePresence>
        {selectedHistoryAsin && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryAsin(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-4 sm:p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white">Journey History</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedHistoryAsin}</p>
                </div>
                <button onClick={() => setSelectedHistoryAsin(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {historyLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>
                ) : historyData.length === 0 ? (
                  <div className="text-center text-slate-500 py-10">No history found for this item.</div>
                ) : (
                  historyData.map((snapshot, idx) => (
                    <div key={snapshot.id} className="relative pl-6 border-l-2 border-indigo-500/30 last:border-0 pb-6">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500" />

                      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Journey #{snapshot.journey_number}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(snapshot.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-white mb-2 capitalize">
                          {snapshot.stage.replace(/_/g, ' ')}
                        </h3>

                        {/* Snapshot Details */}
                        <div className="space-y-1 text-xs text-slate-300">
                          {snapshot.profit && (
                            <div className="flex justify-between">
                              <span>Profit:</span>
                              <span className={snapshot.profit > 0 ? "text-emerald-400" : "text-rose-400"}>
                                ₹{snapshot.profit}
                              </span>
                            </div>
                          )}
                          {snapshot.snapshot_data?.product_weight && (
                            <div className="flex justify-between">
                              <span>Weight:</span>
                              <span>{snapshot.snapshot_data.product_weight}g</span>
                            </div>
                          )}
                          {snapshot.snapshot_data?.usd_price && (
                            <div className="flex justify-between">
                              <span>USD Price:</span>
                              <span>${snapshot.snapshot_data.usd_price}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
        {remarkModalOpen && selectedRemark && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setRemarkModalOpen(false);
                setSelectedRemark(null);
                setEditingRemarkText('');
                setEditingRemarkProductId(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 pb-0 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Remark</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedRemark.asin}</p>
                </div>
                <button
                  onClick={() => {
                    setRemarkModalOpen(false);
                    setSelectedRemark(null);
                    setEditingRemarkText('');
                    setEditingRemarkProductId(null);
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700/50">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validation Remark</span>
                    </div>
                    <textarea
                      value={editingRemarkText}
                      onChange={(e) => setEditingRemarkText(e.target.value)}
                      className="w-full bg-transparent text-slate-200 text-sm leading-relaxed resize-none focus:outline-none min-h-[100px] placeholder:text-slate-600"
                      placeholder="Enter remark..."
                      rows={4}
                    />
                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                      <span>{editingRemarkText.length} characters</span>
                      <span>{editingRemarkText.split('\n').length} lines</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between mt-auto">
                  <div className="text-xs text-slate-500">
                    Press <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(editingRemarkText)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors text-sm"
                    >
                      Copy
                    </button>
                    {editingRemarkText.trim() !== (selectedRemark.remark || '').trim() && editingRemarkProductId && (
                      <button
                        onClick={async () => {
                          if (!editingRemarkProductId) return;
                          await handleRemarkSave(editingRemarkProductId, editingRemarkText.trim() || null);
                          setRemarkModalOpen(false);
                          setSelectedRemark(null);
                          setEditingRemarkText('');
                          setEditingRemarkProductId(null);
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-emerald-900/20"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => { setRemarkModalOpen(false); setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          cancelText="Cancel"
          type={confirmDialog.type}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}