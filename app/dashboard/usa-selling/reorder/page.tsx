'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Papa from 'papaparse'
import { ensureAbsoluteUrl } from '@/lib/utils'
import { ITEMS_PER_PAGE } from '@/lib/constants'
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
  Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ConfirmDialog from '@/components/ConfirmDialog'
import PurchaseHistoryDialog from '@/components/shared/PurchaseHistoryDialog'

// ✅ Safe UUID generator (works in all browsers)
const generateUUID = (): string => {
  if (typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
  journey_id?: string // ✅ The Bag Link
  journey_number?: number
  is_in_final_reorder?: boolean
  remark: string | null;
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
  { id: 4, name: 'Velvet Vista', table_suffix: 'seller_4', tag: 'VV', emoji: '💜', activeColor: 'bg-violet-600', activeShadow: 'shadow-violet-500/40' },
  { id: 1, name: 'Golden Aura', table_suffix: 'seller_1', tag: 'GA', emoji: '✨', activeColor: 'bg-amber-500', activeShadow: 'shadow-amber-500/40' },
  { id: 2, name: 'Rudra Retail', table_suffix: 'seller_2', tag: 'RR', emoji: '🔴', activeColor: 'bg-red-600', activeShadow: 'shadow-red-500/40' },
  { id: 3, name: 'UBeauty', table_suffix: 'seller_3', tag: 'UB', emoji: '💄', activeColor: 'bg-pink-500', activeShadow: 'shadow-pink-500/40' },
]

export default function ReorderPage() {
  // State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeSeller, setActiveSeller] = useState<Seller>(SELLERS[0])
  const [activeTab, setActiveTab] = useState<'main' | 'final'>('main')
  const [products, setProducts] = useState<ReorderProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, activeSeller]);

  const fileInputRef = useRef<HTMLInputElement>(null)

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    type: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);  // ✅ ADD THIS
  const [selectedRemark, setSelectedRemark] = useState<{ id: string; asin: string; remark: string | null } | null>(null);

  // --- 1. Fetch Data ---
  const fetchReorderData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tracking_ops')
        .select('*')
        .eq('marketplace', 'usa')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')
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

      // ✅ Fetch journey_id from unified listing_errors
      const { data: listedItems, error: listError } = await supabase
        .from('listing_errors')
        .select('asin, product_name, seller_link, journey_id, journey_number, remark, sku')
        .eq('marketplace', 'usa')
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
        .eq('marketplace', 'usa')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')

      const existingAsins = new Set(existingItems?.map(p => p.asin))

      const newItems = listedItems
        .filter(p => !existingAsins.has(p.asin))
        .map(p => ({
          marketplace: 'usa',
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
        }))

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from('tracking_ops')
          .insert(newItems)

        if (insertError) throw insertError
        setToast({ message: `Synced ${newItems.length} new products with history links!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        fetchReorderData()
      } else {
        setToast({ message: 'All listed products are already in Reorder.', type: 'error' })
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
  //               .from(`usa_reorder_${activeSeller.table_suffix}`)
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
        setToast({ message: `No matches found! We checked ${rows.length} rows against your listed products, but none matched. Example File ASIN: ${rows[0]?.ASIN || rows[0]?.asin || rows[0]?.Asin || 'N/A'} | Example Screen ASIN: ${products[0]?.asin || 'N/A'}`, type: 'error' })
        setProcessing(false)
        return
      }

      // Execute Updates
      await Promise.all(promises)
      await fetchReorderData() // Refresh UI immediately

      // Offer Recalculation
      setConfirmDialog({
        title: 'Run Reorder Calculation?',
        message: `Success! Updated ${matchCount} products.\n\nDo you want to run the Reorder Calculation now?`,
        confirmText: 'Yes, Recalculate',
        type: 'warning',
        onConfirm: async () => {
          setConfirmDialog(null);
          await handleRecalculate();
        }
      });

    } catch (err: any) {
      console.error(err)
      setToast({ message: `Error processing file: ${err.message}`, type: 'error' })
    } finally {
      setProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }


  // --- 4. Recalculate Logic ---
  // const handleRecalculate = async () => {
  //   try {
  //     setProcessing(true)

  //     const { data: trackingData, error: trackError } = await supabase
  //       .from('usa_traking')
  //       .select('asin, buying_quantity')

  //     if (trackError) throw trackError

  //     const incomingMap: Record<string, number> = {}
  //     trackingData?.forEach(t => {
  //       const qty = t.buying_quantity || 0
  //       if (!incomingMap[t.asin]) incomingMap[t.asin] = 0
  //       incomingMap[t.asin] += qty
  //     })

  //     const { data: currentReorderData } = await supabase
  //       .from(`usa_reorder_${activeSeller.table_suffix}`)
  //       .select('*')

  //     if (!currentReorderData) return

  //     const updates = currentReorderData.map(p => {
  //       const target = p.admin_target_qty || 0
  //       const current = p.current_qty || 0
  //       const incoming = incomingMap[p.asin] || 0

  //       const deficit = target - current
  //       let finalReorder = 0
  //       let status: 'Safe' | 'Covered' | 'Reorder' = 'Safe'
  //       let isInFinalReorder = false

  //       if (deficit > 0) {
  //         finalReorder = Math.max(0, deficit - incoming)
  //         if (finalReorder > 0) {
  //           status = 'Reorder'
  //           isInFinalReorder = true
  //         } else {
  //           status = 'Covered'
  //           isInFinalReorder = false
  //         }
  //       } else {
  //         status = 'Safe'
  //         isInFinalReorder = false
  //       }

  //       return {
  //         id: p.id,
  //         tracking_qty: incoming,
  //         final_reorder_qty: finalReorder,
  //         status: status,
  //         is_in_final_reorder: isInFinalReorder
  //       }
  //     })

  //     const updatePromises = updates.map(u =>
  //       supabase
  //         .from(`usa_reorder_${activeSeller.table_suffix}`)
  //         .update({
  //           tracking_qty: u.tracking_qty,
  //           final_reorder_qty: u.final_reorder_qty,
  //           status: u.status,
  //           is_in_final_reorder: u.is_in_final_reorder
  //         })
  //         .eq('id', u.id)
  //     )

  //     await Promise.all(updatePromises)
  //     fetchReorderData()

  //   } catch (err: any) {
  //     alert('Calculation failed: ' + err.message)
  //   } finally {
  //     setProcessing(false)
  //   }
  // }
  // --- 4. Recalculate Logic (✅ UPDATED: Checks ALL 5 Tracking Tables) ---
  const handleRecalculate = async () => {
    try {
      setProcessing(true)

      // ✅ Helper function to get tracking quantity across tracking_ops stages
      const getTrackingQuantityForAsin = async (asin: string, sellerTag: string): Promise<number> => {
        // 🔴 LOGIC: Check stages in reverse priority - count from HIGHEST stage only

        const sellerIdMap: Record<string, number> = {
          'GA': 1, 'GR': 1,
          'RR': 2,
          'UB': 3,
          'VV': 4
        }

        const sellerId = sellerIdMap[sellerTag] || activeSeller.id

        // ✅ PRIORITY ORDER: Check from final stage backward (unified tracking_ops)
        const stagesToCheck: Array<{ opsType: string; priority: number }> = [
          { opsType: 'shipment', priority: 4 },
          { opsType: 'checking', priority: 3 },
          { opsType: 'invoice', priority: 2 },
          { opsType: 'tracking', priority: 1 }, // MAIN
        ]

        // ✅ Find the HIGHEST stage where this ASIN exists
        let totalQty = 0

        for (const stage of stagesToCheck) {
          try {
            const { data, error } = await supabase
              .from('tracking_ops')
              .select('buying_quantity')
              .eq('marketplace', 'usa')
              .eq('seller_id', sellerId)
              .eq('ops_type', stage.opsType)
              .eq('asin', asin)

            if (error) {
              console.warn(`⚠️ Error querying tracking_ops[${stage.opsType}]:`, error.message)
              continue
            }

            if (data && data.length > 0) {
              const stageQty = data.reduce((sum: number, row: any) => {
                const qty = row.buying_quantity || 0
                return sum + qty
              }, 0)

              if (stageQty > 0) {
                // ✅ Found in this stage - use ONLY this quantity
                totalQty = stageQty
                break  // 🔴 STOP - Don't check lower stages
              }
            }
          } catch (err) {
            console.warn(`⚠️ Failed to query tracking_ops[${stage.opsType}]:`, err)
          }
        }

        return totalQty
      }

      // Fetch current reorder data
      const { data: currentReorderData } = await supabase
        .from('tracking_ops')
        .select('*')
        .eq('marketplace', 'usa')
        .eq('seller_id', activeSeller.id)
        .eq('ops_type', 'reorder')

      if (!currentReorderData) return

      // ✅ Build incoming map by checking tracking_ops stages
      const incomingMap: Record<string, number> = {}

      // Get unique ASINs with their seller tags
      const asinSellerMap = new Map<string, string>()

      // First, we need to get seller_tag for each ASIN from the unified tracking table
      const { data: mainFileData } = await supabase
        .from('tracking_ops')
        .select('asin, seller_tag')
        .eq('marketplace', 'usa')
        .eq('ops_type', 'tracking')

      mainFileData?.forEach(item => {
        if (item.asin && item.seller_tag) {
          asinSellerMap.set(item.asin, item.seller_tag)
        }
      })

      // Calculate tracking quantity for each product
      for (const product of currentReorderData) {
        const sellerTag = asinSellerMap.get(product.asin) || activeSeller.tag
        const qty = await getTrackingQuantityForAsin(product.asin, sellerTag)
        incomingMap[product.asin] = qty
      }


      // Calculate reorder quantities
      const updates = currentReorderData.map(p => {
        const target = p.admin_target_qty || 0
        const current = p.current_qty || 0
        const incoming = incomingMap[p.asin] || 0

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
          final_reorder_qty: finalReorder,
          status: status,
          is_in_final_reorder: isInFinalReorder
        }
      })

      // Update database
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
      fetchReorderData()

      setToast({ message: 'Calculation complete! Tracking data aggregated across stages.', type: 'success' }); setTimeout(() => setToast(null), 3000);

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

  // --- 7. Send Back to Validation (Restart Loop) ---
  const sendToValidation = (product: ReorderProduct) => {
    setConfirmDialog({
      title: 'Send Back to Validation',
      message: `Send ASIN ${product.asin} back to Validation for re-evaluation?`,
      confirmText: 'Yes, Send Back',
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);

        try {
          setProcessing(true)

          // 🔍 STEP 1: Fetch the ACTUAL max journey_number from history
          const { data: historyData, error: historyError } = await supabase
            .from('usa_asin_history')
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


          // 🔍 STEP 2: Fetch "Master Data" from the Validation Table itself
          const { data: masterData, error: fetchError } = await supabase
            .from('usa_validation_main_file')
            .select('brand, seller_tag, funnel, origin, product_name, usa_link')
            .eq('asin', product.asin)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError
          }

          // 3. Generate NEW Journey ID
          const newJourneyId = generateUUID()

          // 4. Insert into Validation Main File with RESTORED DATA
          const { error: insertError } = await supabase
            .from('usa_validation_main_file')
            .insert({
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
              usa_link: masterData?.usa_link || product.seller_link,
              remark: product.remark ?? null,
              // Reset operational fields
              no_of_seller: 1,
              sent_to_purchases: false,
              admin_status: 'pending'
            })

          if (insertError) throw insertError

          // 5. 🗑️ REMOVE from Reorder Page (It has moved on)
          const { error: deleteError } = await supabase
            .from('tracking_ops')
            .delete()
            .eq('id', product.id)

          if (deleteError) throw deleteError

          // 6. Update UI instantly
          setProducts(prev => prev.filter(p => p.id !== product.id))
          setToast({ message: `ASIN ${product.asin} sent to Validation! (Journey #${nextJourneyNum})`, type: 'success' }); setTimeout(() => setToast(null), 3000);

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
    const matchesSearch = p.asin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase())

    if (activeTab === 'final') {
      // ✅ Final Reorder Tab: Show only Reorder status products
      return matchesSearch && p.status === 'Reorder'
    } else {
      // ✅ Main Workspace: Show only products NOT in final reorder
      return matchesSearch && (p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined)
    }
  })

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="h-screen flex flex-col bg-[#111111] text-gray-100 relative overflow-hidden">

      {/* HEADER */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-white/[0.1]">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Replenishment Manager</h1>
            <p className="text-gray-400 mt-1">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>

          {/* SELLER TABS */}
          <div className="flex bg-[#111111] p-1.5 rounded-xl border border-white/[0.1] shadow-xl">
            {SELLERS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSeller(s)}
                className={`relative px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 ${activeSeller.id === s.id
                  ? `${s.activeColor} text-white ${s.activeShadow} shadow-lg scale-105 z-10`
                  : 'text-gray-500 hover:text-gray-100 hover:bg-[#111111]'
                  }`}
              >
                <span className="text-base">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* WORKSPACE TABS */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'main'
              ? 'bg-[#111111] text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
              : 'text-gray-500 hover:text-gray-200 hover:bg-[#111111] border border-white/[0.1]'
              }`}
          >
            Main Workspace ({products.filter(p => p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined).length})
          </button>

          <button
            onClick={() => setActiveTab('final')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl flex items-center gap-2 transition-all duration-300 ${activeTab === 'final'
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
      <div className="flex gap-3 items-center mb-6 px-6 pt-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by ASIN or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 text-gray-100 placeholder:text-gray-500"
          />
        </div>

        {activeTab === 'main' && (
          <div className="flex gap-2">
            <button onClick={handleSyncListings} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
              Sync Listed
            </button>
            <div className="relative">
              <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" />
                Upload Inventory
              </button>
            </div>
            <button onClick={handleRecalculate} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-400 shadow-lg text-sm font-medium transition-colors">
              <Save className="w-4 h-4" />
              Run Calculation
            </button>
          </div>
        )}
      </div>

      {/* MAIN TABLE */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-white/[0.06]">
              <thead className="bg-[#111111] sticky top-0 z-10 border-b border-white/[0.1]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">ASIN</th>
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
                  <tr><td colSpan={9} className="p-12 text-center text-gray-300"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-orange-500" />Loading data...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={9} className="p-12 text-center text-gray-300">No products found.</td></tr>
                ) : (
                  paginatedProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="hover:bg-white/[0.05] transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-gray-300 font-medium border-r border-white/[0.1]">{product.asin}</td>
                        <td className="px-6 py-4 border-r border-white/[0.1]">
                          <span className="text-sm text-gray-100 font-medium block truncate max-w-xs" title={product.product_name || ''}>{product.product_name || '-'}</span>
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
                                setRemarkModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-xs text-gray-300 italic">-</span>
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
                        <td className="px-6 py-4 text-center bg-blue-900/10 text-blue-300 font-medium text-sm border-r border-white/[0.1]">{product.tracking_qty}</td>
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
                          {product.final_reorder_qty > 0 ? <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm font-bold bg-rose-500/20 text-rose-300">{product.final_reorder_qty}</span> : <span className="text-gray-500">-</span>}
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

          {/* Stats Footer - FIXED AT BOTTOM */}
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 flex items-center justify-between text-sm text-gray-300">
            <div>
              Showing <span className="font-bold text-white">{filteredProducts.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
              {' - '}
              <span className="font-bold text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}</span>
              {' of '}
              <span className="font-bold text-white">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium border border-white/[0.1]"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400 px-2">
                Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium border border-white/[0.1]"
              >
                Next
              </button>
            </div>
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
              }}
              className="absolute inset-0 bg-[#111111]/60 z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[400px] bg-[#111111] border-l border-white/[0.1] shadow-2xl z-50 p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white">Remark</h2>
                  <p className="text-sm text-gray-300 font-mono mt-1">{selectedRemark.asin}</p>
                </div>
                <button
                  onClick={() => {
                    setRemarkModalOpen(false);
                    setSelectedRemark(null);
                  }}
                  className="p-2 hover:bg-[#111111] rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <textarea
                  value={selectedRemark.remark || ''}
                  onChange={(e) =>
                    setSelectedRemark({
                      ...selectedRemark,
                      remark: e.target.value,
                    })
                  }
                  placeholder="Enter remark..."
                  rows={10}
                  className="flex-1 bg-[#111111] border border-white/[0.1] rounded-lg px-4 py-3 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none"
                />

                {/* Save Button */}
                <button
                  onClick={async () => {
                    try {
                      const { error } = await supabase
                        .from('tracking_ops')
                        .update({ remark: selectedRemark.remark })
                        .eq('id', selectedRemark.id);

                      if (error) throw error;

                      // Update local state
                      setProducts((prev) =>
                        prev.map((item) =>
                          item.id === selectedRemark.id
                            ? { ...item, remark: selectedRemark.remark }
                            : item
                        )
                      );

                      setToast({ message: 'Remark saved successfully!', type: 'success' }); setTimeout(() => setToast(null), 3000);
                      setRemarkModalOpen(false);
                      setSelectedRemark(null);
                    } catch (error: any) {
                      setToast({ message: `Error: ${error.message}`, type: 'error' });
                    }
                  }}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-400 text-white rounded-lg font-semibold transition-all shadow-lg"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save Remark
                </button>
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
        marketplace="usa"
        onClose={() => setSelectedHistoryAsin(null)}
      />
    </div>
  )
}