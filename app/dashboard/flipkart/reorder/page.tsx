'use client'

import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Papa from 'papaparse'
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
import PurchaseHistoryDialog from '@/components/shared/PurchaseHistoryDialog'
import { ensureAbsoluteUrl } from '@/lib/utils'

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
  sns_active?: boolean | null;
};

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
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
    return (localStorage.getItem('flipkartReorderOriginFilter') as 'ALL' | 'India' | 'China' | 'US') || 'ALL';
  });

  const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('flipkartReorderFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
  });

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Safe' | 'Covered' | 'Reorder'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('flipkartReorderStatusFilter') as 'ALL' | 'Safe' | 'Covered' | 'Reorder') || 'ALL';
  });

  useEffect(() => {
    localStorage.setItem('flipkartReorderOriginFilter', originFilter);
  }, [originFilter]);

  useEffect(() => {
    localStorage.setItem('flipkartReorderFunnelFilter', funnelFilter);
  }, [funnelFilter]);

  useEffect(() => {
    localStorage.setItem('flipkartReorderStatusFilter', statusFilter);
  }, [statusFilter]);
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
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
        .from('tracking_ops')
        .select('*')
        .eq('marketplace', 'flipkart')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')
        .order('status', { ascending: false })
        .order('product_name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
      setLoading(false)
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

      // ✅ Fetch journey_id from unified listing_errors
      const { data: listedItems, error: listError } = await supabase
        .from('listing_errors')
        .select('asin, product_name, seller_link, journey_id, journey_number, remark, sku, sns_active')
        .eq('marketplace', 'flipkart')
        .eq('seller_id', activeSeller.id)
        .eq('error_status', 'done')

      if (listError) throw listError
      if (!listedItems || listedItems.length === 0) {
        setToast({ message: 'No listed items found to sync.', type: 'error' })
        return
      }

      const { data: existingItems } = await supabase
        .from('tracking_ops')
        .select('asin')
        .eq('marketplace', 'flipkart')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')

      const existingAsins = new Set(existingItems?.map(p => p.asin))

      const newItems = listedItems
        .filter(p => !existingAsins.has(p.asin))
        .map(p => ({
          marketplace: 'flipkart',
          seller_id: activeSeller.id,
          ops_type: 'reorder',
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
          sns_active: p.sns_active ?? false,
        }))

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('tracking_ops')
          .insert(newItems)

        if (insertError) throw insertError
        setToast({ message: `Synced ${newItems.length} new products with history links!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        // ✅ ADD THIS:
        logActivity({
          action: 'submit',
          marketplace: 'flipkart',
          page: 'reorder',
          table_name: 'tracking_ops',
          asin: `${newItems.length} ASINs synced`,
          details: { seller: activeSeller.name, ops_type: 'reorder' }
        });
        fetchReorderData()
      } else {
        setToast({ message: 'All listed products are already in Reorder.', type: 'success' })
      }

    } catch (err: any) {
      console.error('Sync error:', err)
      setToast({ message: `Failed to sync: ${err.message}`, type: 'error' })
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
  //               .from(`flipkart_reorder_${activeSeller.table_suffix}`)
  //               .update({ current_qty: updates[pAsin] })
  //               .eq('id', p.id)
  //           })

  //         if (matchCount === 0) {
  //           setToast({ message: `No matches found in ${rows.length} rows`, type: 'error' })
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
  //         setToast({ message: `Error processing file: ${err.message}`, type: 'error' })
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
          setToast({ message: `Failed to parse CSV file: ${error.message}`, type: 'error' })
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // 📊 Handle Excel File (NEW)
      const reader = new FileReader()

      reader.onload = async (evt) => {
        try {
          const XLSX = await import('xlsx');
          const data = evt.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })

          // ✅ Read ALL sheets and merge data
          let allRows: any[] = []

          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName]
            const sheetData = XLSX.utils.sheet_to_json(worksheet, { raw: false })
            allRows = allRows.concat(sheetData)
          })


          await processInventoryData(allRows)

        } catch (error: any) {
          console.error('Excel Parse Error:', error)
          setToast({ message: `Failed to parse Excel file: ${error.message}`, type: 'error' })
          setProcessing(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      }

      reader.onerror = (error) => {
        console.error('File Read Error:', error)
        setToast({ message: 'Failed to read file', type: 'error' })
        setProcessing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }

      reader.readAsBinaryString(file)

    } else {
      setToast({ message: 'Unsupported file format. Please upload CSV, XLSX, or XLS files.', type: 'error' })
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
            .from('tracking_ops')
            .update({ current_qty: updates[pAsin] })
            .eq('id', p.id)
        })

      if (matchCount === 0) {
        setToast({ message: `No matches found in ${rows.length} rows`, type: 'error' })
        setProcessing(false)
        return
      }

      // Execute Updates
      await Promise.all(promises)
      await fetchReorderData(); // Refresh UI immediately
      // ✅ ADD THIS:
      logActivity({
        action: 'submit',
        marketplace: 'flipkart',
        page: 'reorder',
        table_name: 'tracking_ops',
        asin: `${matchCount} ASINs updated`,
        details: { type: 'inventory_upload', seller: activeSeller.name, ops_type: 'reorder' }
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
      setToast({ message: `Error processing file: ${err.message}`, type: 'error' })
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
        .from('tracking_ops')
        .select('*')
        .eq('marketplace', 'flipkart')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')

      if (!currentReorderData || currentReorderData.length === 0) {
        setToast({ message: 'No products in reorder table.', type: 'error' })
        return
      }


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

      // --- Table 1: flipkart_inbound_tracking (shared) ---
      {
        const { data, error } = await supabase
          .from('flipkart_inbound_tracking')
          .select('asin, buying_quantity, seller_tag')
          .like('seller_tag', `%${sellerTag}%`)

        if (error) console.warn('⚠️ Error querying flipkart_inbound_tracking:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'inbound')
          })
        }
      }

      // --- Table 2: flipkart_inbound_boxes (shared) ---
      {
        const { data, error } = await supabase
          .from('flipkart_inbound_boxes')
          .select('asin, buying_quantity, seller_tag')
          .like('seller_tag', `%${sellerTag}%`)

        if (error) console.warn('⚠️ Error querying flipkart_inbound_boxes:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'boxes')
          })
        }
      }

      // --- Table 3: flipkart_box_checking (shared) ---
      {
        const { data, error } = await supabase
          .from('flipkart_box_checking')
          .select('asin, buying_quantity, seller_tag, action_status')
          .like('seller_tag', `%${sellerTag}%`)
          .is('action_status', null)

        if (error) console.warn('⚠️ Error querying flipkart_box_checking:', error.message)
        else {
          data?.forEach(row => {
            const share = getSellerShare(row.seller_tag || '', row.buying_quantity || 0)
            addToMap(row.asin, share)
            addToSourceMap(row.asin, share, 'checking')
          })
        }
      }

      // --- Table 4: tracking_ops restock rows (per-seller, no split needed) ---
      {
        const { data, error } = await supabase
          .from('tracking_ops')
          .select('asin, buying_quantity')
          .eq('marketplace', 'flipkart')
          .eq('seller_id', activeSeller.id)
          .eq('ops_type', 'restock')
          .eq('status', 'pending')

        if (error) console.warn('⚠️ Error querying tracking_ops restock:', error.message)
        else {
          data?.forEach(row => {
            addToMap(row.asin, row.buying_quantity || 0)
            addToSourceMap(row.asin, row.buying_quantity || 0, 'restock')
          })
        }
      }


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
          .from('tracking_ops')
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

      setToast({ message: `Calculation complete! Tracked ${Object.keys(trackingMap).length} ASINs across pipeline.`, type: 'success' }); setTimeout(() => setToast(null), 4000);
      logActivity({
        action: 'submit',
        marketplace: 'flipkart',
        page: 'reorder',
        table_name: 'tracking_ops',
        asin: `${updates.length} ASINs recalculated`,
        details: { type: 'recalculate', seller: activeSeller.name, ops_type: 'reorder' }
      });

    } catch (err: any) {
      setToast({ message: `Calculation failed: ${err.message}`, type: 'error' })
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
      .from('tracking_ops')
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
      const { error } = await supabase.from('tracking_ops').update({ remark: newRemark }).eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, remark: newRemark } : p));
    } catch (err: any) { console.error('Failed to update remark:', err); }
  };

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

          // --- Copy check: skip validation if copy exists ---
          try {
            const { data: copyData } = await supabase
              .from('flipkart_purchase_copies')
              .select('*')
              .eq('asin', product.asin)
              .maybeSingle();

            if (copyData) {
              // ALWAYS create new independent row — never merge with existing
              // Rule 10: check BOTH flipkart_asin_history AND flipkart_purchases for true max
              const [{ data: maxHistJ }, { data: maxPurchJ }] = await Promise.all([
                supabase
                  .from('flipkart_asin_history')
                  .select('journey_number')
                  .eq('asin', product.asin)
                  .order('journey_number', { ascending: false })
                  .limit(1),
                supabase
                  .from('flipkart_purchases')
                  .select('journey_number')
                  .eq('asin', product.asin)
                  .order('journey_number', { ascending: false })
                  .limit(1),
              ]);
              const maxHistNum = maxHistJ?.[0]?.journey_number || 0;
              const maxPurchNum = maxPurchJ?.[0]?.journey_number || 0;
              const nextJN = Math.max(maxHistNum, maxPurchNum) + 1;
              const newJID = generateUUID();

              const { error: insertErr } = await supabase.from('flipkart_purchases').insert({
                asin: product.asin,
                product_name: copyData.product_name || product.product_name,
                brand: copyData.brand || (product as any).brand || null,
                seller_tag: activeSeller.tag,
                funnel: copyData.funnel || product.funnel,
                sku: copyData.sku || product.sku,
                remark: copyData.remark || product.remark,
                buying_quantities: { [activeSeller.tag]: copyData.buying_quantities?.[activeSeller.tag] ?? copyData.buying_quantity ?? 0 },
                product_link: copyData.flipkart_link || product.seller_link || null,
                inr_purchase_link: copyData.inr_purchase_link || null,
                seller_link: copyData.seller_link || null,
                origin: copyData.origin || 'India',
                origin_india: copyData.origin_india ?? true,
                origin_china: copyData.origin_china ?? false,
                origin_us: copyData.origin_us ?? false,
                buying_price: copyData.buying_price || 0,
                buying_quantity: copyData.buying_quantities?.[activeSeller.tag] ?? copyData.buying_quantity ?? 0,
                product_weight: copyData.product_weight || null,
                usd_price: copyData.usd_price || null,
                inr_purchase: copyData.inr_purchase || null,
                target_price: copyData.target_price || null,
                profit: copyData.profit || null,
                journey_id: newJID,
                journey_number: nextJN,
                source: 'reorder',
                sns_active: product.sns_active ?? false,
              });
              if (insertErr) throw new Error(`Failed to create purchase from copy: ${insertErr.message}`);

              // Delete from reorder
              await supabase.from('tracking_ops').delete().eq('id', product.id);
              setProducts(prev => prev.filter(p => p.id !== product.id));
              setToast({ message: `ASIN ${product.asin} sent directly to Purchases (validated copy found)!`, type: 'success' });
              setTimeout(() => setToast(null), 3000);
              logActivity({
                action: 'approve_via_copy',
                marketplace: 'flipkart',
                page: 'reorder',
                table_name: 'tracking_ops',
                asin: product.asin,
                details: { from: 'reorder', to: 'flipkart_purchases_direct', ops_type: 'reorder', journey_number: nextJN }
              });
              return;
            }
          } catch (copyErr) {
            console.error('Copy check failed, falling back to normal flow:', copyErr);
          }

          // 🔍 STEP 1: Fetch the ACTUAL max journey_number
          // Rule 10: check BOTH flipkart_asin_history AND flipkart_purchases for true max
          const [
            { data: historyData, error: historyError },
            { data: purchaseData, error: purchaseError }
          ] = await Promise.all([
            supabase
              .from('flipkart_asin_history')
              .select('journey_number')
              .eq('asin', product.asin)
              .order('journey_number', { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from('flipkart_purchases')
              .select('journey_number')
              .eq('asin', product.asin)
              .order('journey_number', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])

          if (historyError && historyError.code !== 'PGRST116') throw historyError
          if (purchaseError && purchaseError.code !== 'PGRST116') throw purchaseError

          // Calculate ACTUAL next journey number across both tables
          const maxHistoryJ = historyData?.journey_number || 0
          const maxPurchaseJ = purchaseData?.journey_number || 0
          const nextJourneyNum = Math.max(maxHistoryJ, maxPurchaseJ) + 1


          // 🔍 STEP 2: Fetch "Master Data" from the Validation Table itself
          const { data: masterData, error: fetchError } = await supabase
            .from('flipkart_validation_main_file')
            .select('brand, seller_tag, funnel, origin, product_name, flipkart_link, sku')
            .eq('asin', product.asin)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError
          }

          // 3. Generate NEW Journey ID
          const newJourneyId = generateUUID();

          // 4. Insert or Update Validation Main File — MERGE seller_tag
          const { data: existingValidation } = await supabase
            .from('flipkart_validation_main_file')
            .select('id, seller_tag')
            .eq('asin', product.asin)
            .maybeSingle();

          if (existingValidation) {
            // ASIN exists — merge seller_tag and update journey
            const existingTags = (existingValidation.seller_tag || '').split(',').map((t: string) => t.trim()).filter(Boolean);
            let mergedTag = existingTags;
            if (!existingTags.includes(activeSeller.tag)) {
              mergedTag = [...existingTags, activeSeller.tag];
            }

            const { error: updateError } = await supabase
              .from('flipkart_validation_main_file')
              .update({
                seller_tag: mergedTag.join(', '),
                no_of_seller: mergedTag.length,
                current_journey_id: newJourneyId,
                journey_number: nextJourneyNum,
                // Only update these if they're currently empty
                product_name: masterData?.product_name || undefined,
                brand: masterData?.brand || undefined,
                funnel: masterData?.funnel || undefined,
                flipkart_link: masterData?.flipkart_link || product.seller_link || undefined,
                remark: product.remark ?? undefined,
                sku: masterData?.sku || product.sku || undefined,
                // Mark as needing re-validation
                is_new: true,
                sent_to_purchases: false,
              })
              .eq('id', existingValidation.id);

            if (updateError) throw updateError;
          } else {
            // ASIN doesn't exist — insert fresh
            const { error: insertError } = await supabase
              .from('flipkart_validation_main_file')
              .insert({
                asin: product.asin,
                product_name: masterData?.product_name || product.product_name,
                current_journey_id: newJourneyId,
                journey_number: nextJourneyNum,
                status: 'pending',
                brand: masterData?.brand || null,
                seller_tag: activeSeller.tag,
                funnel: masterData?.funnel || null,
                origin: masterData?.origin || 'India',
                flipkart_link: masterData?.flipkart_link || product.seller_link,
                remark: product.remark ?? null,
                sku: masterData?.sku || product.sku || null,
                no_of_seller: 1,
                sent_to_purchases: false,
                admin_status: 'pending',
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
              });

            if (insertError) throw insertError;
          }

          // 5. 🗑️ REMOVE from Reorder Page (It has moved on)
          const { error: deleteError } = await supabase
            .from('tracking_ops')
            .delete()
            .eq('id', product.id)

          if (deleteError) throw deleteError

          // 6. Update UI instantly
          setProducts(prev => prev.filter(p => p.id !== product.id))
          setToast({ message: `ASIN ${product.asin} sent to Validation! Journey #${nextJourneyNum}`, type: 'success' }); setTimeout(() => setToast(null), 3000);
          // ✅ ADD THIS:
          logActivity({
            action: 'move',
            marketplace: 'flipkart',
            page: 'reorder',
            table_name: 'tracking_ops',
            asin: product.asin,
            details: { from: 'reorder', to: 'validation', journey: nextJourneyNum, ops_type: 'reorder' }
          });

        } catch (err: any) {
          console.error(err)
          setToast({ message: `Failed to send: ${err.message}`, type: 'error' })
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
    <div className="h-screen flex flex-col bg-[#111111] text-gray-100 relative overflow-hidden">

      {/* HEADER */}
      <div className="flex-none px-4 sm:px-6 lg:px-6 pt-4 sm:pt-6 pb-4 border-b border-white/[0.1]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-white">Replenishment Manager</h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-1">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>

          {/* SELLER TABS */}
          <div className="flex bg-[#111111] p-1.5 rounded-xl border border-white/[0.1] shadow-xl overflow-x-auto scrollbar-none">
            {SELLERS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSeller(s)}
                className={`relative px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap ${activeSeller.id === s.id
                  ? `${s.activeColor} text-white ${s.activeShadow} shadow-lg scale-105 z-10`
                  : 'text-gray-500 hover:text-gray-100 hover:bg-[#111111]'
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
              ? 'bg-[#111111] text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
              : 'text-gray-500 hover:text-gray-200 hover:bg-[#111111] border border-white/[0.1]'
              }`}
          >
            Main Workspace ({products.filter(p => p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined).length})
          </button>

          <button
            onClick={() => setActiveTab('final')}
            className={`px-3 sm:px-6 py-2 sm:py-3 font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all duration-300 whitespace-nowrap ${activeTab === 'final'
              ? 'bg-[#111111] text-rose-400 shadow-[0_0_20px_-5px_rgba(244,63,94,0.5)]'
              : 'text-gray-500 hover:text-gray-200 hover:bg-[#111111] border border-white/[0.1]'
              }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Final Reorder ({products.filter(p => p.status === 'Reorder' && p.is_in_final_reorder === true).length})
          </button>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex gap-4 items-center flex-wrap mb-4 sm:mb-6 px-4 sm:px-6 lg:px-6 pt-4">
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by ASIN, Name, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 text-gray-100 placeholder:text-gray-500"
          />
        </div>

        {/* Funnel Filter Pills - RS / DP */}
        <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
          {(['ALL', 'RS', 'DP'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFunnelFilter(opt)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === opt
                ? opt === 'RS' ? 'bg-emerald-600 text-white shadow-lg'
                  : opt === 'DP' ? 'bg-amber-500 text-black shadow-lg'
                    : 'bg-orange-500 text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-200'
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
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border ${originFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
              : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
            {(originFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <span className="w-5 h-5 bg-[#111111]/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                {[originFilter !== 'ALL', statusFilter !== 'ALL'].filter(Boolean).length}
              </span>
            )}
          </button>

          {isFilterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
              <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-4 z-20 w-72">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-100 text-sm">Filters</h3>
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
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Origin</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'India', 'China', 'US'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setOriginFilter(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${originFilter === opt
                          ? opt === 'India' ? 'bg-orange-500 text-white'
                            : opt === 'China' ? 'bg-rose-500 text-white'
                              : opt === 'US' ? 'bg-sky-500 text-white'
                                : 'bg-orange-500 text-white'
                          : 'bg-[#111111] text-gray-400 hover:bg-[#1a1a1a] border border-white/[0.1]'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'Safe', 'Covered', 'Reorder'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setStatusFilter(opt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === opt
                          ? opt === 'Safe' ? 'bg-emerald-500 text-white'
                            : opt === 'Covered' ? 'bg-amber-500 text-black'
                              : opt === 'Reorder' ? 'bg-rose-500 text-white'
                                : 'bg-orange-500 text-white'
                          : 'bg-[#111111] text-gray-400 hover:bg-[#1a1a1a] border border-white/[0.1]'
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
            <button onClick={handleSyncListings} disabled={processing} className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-xs sm:text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 shrink-0 ${processing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Listed</span><span className="sm:hidden">Sync</span>
            </button>
            <div className="relative">
              <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-xs sm:text-sm font-medium transition-colors">
                <Upload className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Upload Inventory</span><span className="sm:hidden">Upload</span>
              </button>
            </div>
            <button onClick={handleRecalculate} disabled={processing} className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-400 shadow-lg text-xs sm:text-sm font-medium transition-colors">
              <Save className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Run Calculation</span><span className="sm:hidden">Calculate</span>
            </button>
          </div>
        )}
      </div>

      {/* MAIN TABLE */}
      <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-6 pb-4 sm:pb-6">
        <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-white/[0.06]">
              <thead className="bg-[#111111] sticky top-0 z-10 border-b border-white/[0.1]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">ASIN</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1] w-1/4">Product Name</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">History</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Remark</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-orange-500 uppercase bg-orange-500/15/60 border-r border-white/[0.1]">Target Qty</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-orange-400 uppercase bg-orange-500/15 border-r border-white/[0.1]">Current</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Deficit</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-blue-400 uppercase bg-blue-900/20 border-r border-white/[0.1]">Tracking</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Status</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-rose-400 uppercase bg-rose-500/10 border-r border-white/[0.1]">Final Order</th>
                  {activeTab === 'final' && <th className="px-6 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {loading ? (
                  <tr><td colSpan={10} className="p-12 text-center text-gray-300"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-orange-500" />Loading data...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={10} className="p-12 text-center text-gray-300">No products found.</td></tr>
                ) : (
                  filteredProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="transition-colors group hover:bg-white/[0.05]">
                        <td className="px-6 py-4 text-sm font-mono text-gray-300 font-medium border-r border-white/[0.1]">
                          {product.asin}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-300 border-r border-white/[0.1]">{product.sku || '-'}</td>
                        <td className="px-6 py-4 border-r border-white/[0.1]">
                          <span className="text-sm text-gray-100 font-medium block truncate max-w-xs" title={product.product_name || ''}>{product.product_name || '-'}{product.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium inline-block">S&S</span>}</span>
                          {product.seller_link && <a href={ensureAbsoluteUrl(product.seller_link || '')} target="_blank" className="text-xs text-orange-500 hover:text-orange-400 mt-1 inline-block">View Link</a>}
                        </td>

                        {/* ✅ HISTORY BUTTON */}
                        <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                          <button
                            onClick={() => setSelectedHistoryAsin(product.asin)}
                            className="p-2 rounded-full hover:bg-white/[0.08] text-gray-400 hover:text-orange-500 transition-colors"
                            title="View Journey History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </td>

                        {/* ✅ REMARK BUTTON */}
                        <td className="px-6 py-4 text-center">
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
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                          ) : (
                            <button onClick={() => { setSelectedRemark({ id: product.id, asin: product.asin, remark: null }); setEditingRemarkText(''); setEditingRemarkProductId(product.id); setRemarkModalOpen(true); }} className="text-gray-300 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center bg-orange-500/10 border-r border-white/[0.1]">
                          <input
                            type="number"
                            value={product.admin_target_qty}
                            onChange={(e) => updateTargetQty(product.id, parseInt(e.target.value) || 0)}
                            className="w-24 text-center py-1.5 px-2 bg-[#111111] border border-orange-500/30 rounded-md text-sm text-white font-medium focus:ring-1 focus:ring-orange-500 outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-center bg-orange-900/10 text-orange-300 font-medium text-sm border-r border-white/[0.1]">{product.current_qty}</td>
                        <td className={`px-6 py-4 text-center font-bold text-sm border-r border-white/[0.1] ${deficit > 0 ? 'text-rose-400' : 'text-gray-300'}`}>{deficit}</td>
                        <td className="px-6 py-4 text-center bg-blue-900/10 border-r border-white/[0.1] group/track relative">
                          <span className="text-blue-300 font-medium text-sm cursor-help inline-flex items-center gap-1">
                            {product.tracking_qty}
                            {product.tracking_sources && product.tracking_qty > 0 && (
                              <Info className="w-3.5 h-3.5 text-gray-500" />
                            )}
                          </span>
                          {product.tracking_sources && product.tracking_qty > 0 && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/track:block z-50 w-44 bg-[#111111] border border-white/[0.1] rounded-lg shadow-xl p-2.5 text-xs pointer-events-none">
                              <div className="text-gray-400 font-semibold mb-1.5 text-center">Source Breakdown</div>
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
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-transparent border-b-gray-200" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${product.status === 'Reorder'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/20'
                            : product.status === 'Covered'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                            }`}>
                            {product.status || 'Safe'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center bg-rose-500/5 border-r border-white/[0.1]">
                          {product.final_reorder_qty > 0 ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm font-bold bg-rose-500/20 text-rose-300">{product.final_reorder_qty}</span> : <span className="text-gray-300">-</span>}
                        </td>

                        {/* ✅ RESTART LOOP BUTTON */}
                        {activeTab === 'final' && (
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => sendToValidation(product)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-400 hover:bg-white/[0.05]/100 hover:text-white rounded-lg border border-orange-500/30 transition-all text-xs font-medium"
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

      <AnimatePresence>
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
              className="absolute inset-0 bg-[#111111]/60 z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-[#111111] border-l border-white/[0.1] shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 pb-0 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Remark</h2>
                  <p className="text-sm text-gray-300 font-mono mt-1">{selectedRemark.asin}</p>
                </div>
                <button
                  onClick={() => {
                    setRemarkModalOpen(false);
                    setSelectedRemark(null);
                    setEditingRemarkText('');
                    setEditingRemarkProductId(null);
                  }}
                  className="p-2 hover:bg-[#111111] rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-[#1a1a1a]/50 rounded-xl p-5 border border-white/[0.1]">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.1]">
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Validation Remark</span>
                    </div>
                    <textarea
                      value={editingRemarkText}
                      onChange={(e) => setEditingRemarkText(e.target.value)}
                      className="w-full bg-transparent text-gray-100 text-sm leading-relaxed resize-none focus:outline-none min-h-[100px] placeholder:text-gray-500"
                      placeholder="Enter remark..."
                      rows={4}
                    />
                    <div className="mt-4 pt-3 border-t border-white/[0.1] flex items-center justify-between text-xs text-gray-300">
                      <span>{editingRemarkText.length} characters</span>
                      <span>{editingRemarkText.split('\n').length} lines</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-[#1a1a1a]/50 border-t border-white/[0.1] flex items-center justify-between mt-auto">
                  <div className="text-xs text-gray-300">
                    Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded text-gray-500">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (() => { try { navigator.clipboard?.writeText(editingRemarkText); } catch { const t = document.createElement('textarea'); t.value = editingRemarkText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } })()}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-200 text-gray-100 rounded-lg font-medium transition-colors text-sm"
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
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
          <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-semibold flex-1 text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/70 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}

      <PurchaseHistoryDialog
        asin={selectedHistoryAsin}
        marketplace="flipkart"
        onClose={() => setSelectedHistoryAsin(null)}
      />
    </div>
  )
}