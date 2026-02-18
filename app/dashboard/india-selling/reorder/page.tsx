'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Papa from 'papaparse'
import { getIndiaTrackingTableName } from '@/lib/utils';
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
  Send
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  { id: 1, name: "Golden Aura", table_suffix: "seller_1", tag: "GA", emoji: "✨", activeColor: "bg-amber-500", activeShadow: "shadow-amber-500/40" },
  { id: 2, name: "Rudra Retail", table_suffix: "seller_2", tag: "RR", emoji: "🔴", activeColor: "bg-red-600", activeShadow: "shadow-red-500/40" },
  { id: 3, name: "UBeauty", table_suffix: "seller_3", tag: "UB", emoji: "💅", activeColor: "bg-pink-500", activeShadow: "shadow-pink-500/40" },
  { id: 4, name: "Velvet Vista", table_suffix: "seller_4", tag: "VV", emoji: "💜", activeColor: "bg-violet-600", activeShadow: "shadow-violet-500/40" },
  { id: 5, name: "Dropy Ecom", table_suffix: "seller_5", tag: "DC", emoji: "🟠", activeColor: "bg-orange-500", activeShadow: "shadow-orange-500/40" },  // ✅ NEW
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);  // ✅ ADD THIS
  const [selectedRemark, setSelectedRemark] = useState<{ id: string; asin: string; remark: string | null } | null>(null);

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
        .select('asin, product_name, seller_link, journey_id, journey_number,remark')

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
        }))

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from(reorderTable)
          .insert(newItems)

        if (insertError) throw insertError
        alert(`Synced ${newItems.length} new products with history links!`)
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
      await fetchReorderData() // Refresh UI immediately

      // Offer Recalculation
      const autoRecalc = window.confirm(`Success! Updated ${matchCount} products.\n\nDo you want to run the Reorder Calculation now?`)
      if (autoRecalc) {
        await handleRecalculate()
      }

    } catch (err: any) {
      console.error(err)
      alert('Error processing file: ' + err.message)
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
  //       .from('india_traking')
  //       .select('asin, buying_quantity')

  //     if (trackError) throw trackError

  //     const incomingMap: Record<string, number> = {}
  //     trackingData?.forEach(t => {
  //       const qty = t.buying_quantity || 0
  //       if (!incomingMap[t.asin]) incomingMap[t.asin] = 0
  //       incomingMap[t.asin] += qty
  //     })

  //     const { data: currentReorderData } = await supabase
  //       .from(`india_reorder_${activeSeller.table_suffix}`)
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
  //         .from(`india_reorder_${activeSeller.table_suffix}`)
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

      // ✅ NEW: Helper function to get tracking quantity across ALL tables
      // ✅ NEW: Helper function to get tracking quantity across ALL tables
      const getTrackingQuantityForAsin = async (asin: string, sellerTag: string): Promise<number> => {
        // 🔴 NEW LOGIC: Check tables in reverse priority - count from HIGHEST stage only

        const sellerIdMap: Record<string, number> = {
          'GA': 1, 'GR': 1,
          'RR': 2,
          'UB': 3,
          'VV': 4,
          'DE': 5,
          'CV': 6,
        }

        const sellerId = sellerIdMap[sellerTag] || activeSeller.id

        // ✅ PRIORITY ORDER: Check from final stage backward
        const tablesToCheck = [
          // { name: getIndiaTrackingTableName('VYAPAR', sellerId), priority: 5 },      // ✅ CHANGED
          { name: getIndiaTrackingTableName('SHIPMENT', sellerId), priority: 4 },    // ✅ CHANGED
          { name: getIndiaTrackingTableName('CHECKING', sellerId), priority: 3 },    // ✅ CHANGED
          { name: getIndiaTrackingTableName('INVOICE', sellerId), priority: 2 },     // ✅ CHANGED
          { name: getIndiaTrackingTableName('MAIN', sellerId), priority: 1 }                   // ✅ Already correct
        ];

        console.log(`🔍 Checking ASIN ${asin} (Seller: ${sellerTag})...`)

        // ✅ Find the HIGHEST stage where this ASIN exists
        let foundInTable = null
        let totalQty = 0

        for (const table of tablesToCheck) {
          try {
            const { data, error } = await supabase
              .from(table.name)
              .select('buying_quantity')
              .eq('asin', asin)

            if (error) {
              console.warn(`⚠️ Error querying ${table.name}:`, error.message)
              continue
            }

            if (data && data.length > 0) {
              const tableQty = data.reduce((sum: number, row: any) => {
                const qty = row.buying_quantity || 0
                return sum + qty
              }, 0)

              if (tableQty > 0) {
                // ✅ Found in this stage - use ONLY this quantity
                totalQty = tableQty
                foundInTable = table.name
                console.log(`  ✅ Found in ${table.name}: ${tableQty} units (Priority ${table.priority})`)
                break  // 🔴 STOP - Don't check lower stages
              }
            }
          } catch (err) {
            console.warn(`⚠️ Failed to query ${table.name}:`, err)
          }
        }

        if (foundInTable) {
          console.log(`📊 FINAL tracking for ${asin}: ${totalQty} units from ${foundInTable}\n`)
        } else {
          console.log(`📊 No tracking found for ${asin}\n`)
        }

        return totalQty
      }

      // Fetch current reorder data
      const { data: currentReorderData } = await supabase
        .from(`india_reorder_${activeSeller.table_suffix}`)
        .select('*')

      if (!currentReorderData) return

      // ✅ NEW: Build incoming map by checking ALL tracking tables
      console.log('🚀 Starting tracking calculation for all products...\n')

      const incomingMap: Record<string, number> = {}

      // Get unique ASINs with their seller tags
      const asinSellerMap = new Map<string, string>()

      // First, we need to get seller_tag for each ASIN from the tracking main table
      const { data: mainFileData } = await supabase
        .from('india_traking')
        .select('asin, sellertag')

      mainFileData?.forEach(item => {
        if (item.asin && item.sellertag) {
          asinSellerMap.set(item.asin, item.sellertag)
        }
      })

      // Calculate tracking quantity for each product
      for (const product of currentReorderData) {
        const sellerTag = asinSellerMap.get(product.asin) || activeSeller.tag
        const qty = await getTrackingQuantityForAsin(product.asin, sellerTag)
        incomingMap[product.asin] = qty
      }

      console.log('✅ Tracking calculation complete!\n')

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
      fetchReorderData()

      alert('✅ Calculation complete! Tracking data aggregated from all 5 tables.')

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
  const sendToValidation = async (product: ReorderProduct) => {
    const confirm = window.confirm(`Send ASIN ${product.asin} back to Validation for re-evaluation?`)
    if (!confirm) return

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
        .select('brand, seller_tag, funnel, origin, product_name, india_link')
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
          india_link: masterData?.india_link || product.seller_link,
          remark: product.remark ?? null,
          // Reset operational fields
          no_of_seller: 1,
          sent_to_purchases: false,
          admin_status: 'pending'
        })

      if (insertError) throw insertError

      // 5. 🗑️ REMOVE from Reorder Page (It has moved on)
      const { error: deleteError } = await supabase
        .from(`india_reorder_${activeSeller.table_suffix}`)
        .delete()
        .eq('id', product.id)

      if (deleteError) throw deleteError

      // 6. Update UI instantly
      setProducts(prev => prev.filter(p => p.id !== product.id))
      alert(`✅ ASIN ${product.asin} sent to Validation! (Journey #${nextJourneyNum})`)

    } catch (err: any) {
      console.error(err)
      alert('Failed to send: ' + err.message)
    } finally {
      setProcessing(false)
    }
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

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 relative overflow-hidden">

      {/* HEADER */}
      <div className="flex-none px-6 pt-6 pb-4 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Replenishment Manager</h1>
            <p className="text-slate-400 mt-1">Calculate reorder quantities based on sales velocity and inventory</p>
          </div>

          {/* SELLER TABS */}
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

        {/* WORKSPACE TABS */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('main')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-300 ${activeTab === 'main'
              ? 'bg-slate-800 text-white shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-slate-800'
              }`}
          >
            Main Workspace ({products.filter(p => p.is_in_final_reorder === false || p.is_in_final_reorder === null || p.is_in_final_reorder === undefined).length})
          </button>

          <button
            onClick={() => setActiveTab('final')}
            className={`px-6 py-3 font-semibold text-sm rounded-xl flex items-center gap-2 transition-all duration-300 ${activeTab === 'final'
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
            <button onClick={handleSyncListings} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium transition-colors">
              <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
              Sync Listed
            </button>
            <div className="relative">
              <input type="file" accept=".csv,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" />
                Upload Inventory
              </button>
            </div>
            <button onClick={handleRecalculate} disabled={processing} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 shadow-lg text-sm font-medium transition-colors">
              <Save className="w-4 h-4" />
              Run Calculation
            </button>
          </div>
        )}
      </div>

      {/* MAIN TABLE */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-slate-800">
              <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">ASIN</th>
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
                  <tr><td colSpan={9} className="p-12 text-center text-slate-500"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-indigo-500" />Loading data...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={9} className="p-12 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  filteredProducts.map(product => {
                    const deficit = product.admin_target_qty - product.current_qty
                    return (
                      <tr key={product.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-slate-300 font-medium border-r border-slate-800/50">{product.asin}</td>
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
                                setRemarkModalOpen(true);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                          ) : (
                            <span className="text-xs text-slate-600 italic">-</span>
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
                        <td className="px-6 py-4 text-center bg-blue-900/10 text-blue-300 font-medium text-sm border-r border-slate-800/50">{product.tracking_qty}</td>
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
              className="absolute top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 flex flex-col"
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
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-white">Remark</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedRemark.asin}</p>
                </div>
                <button
                  onClick={() => {
                    setRemarkModalOpen(false);
                    setSelectedRemark(null);
                  }}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
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
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                />

                {/* Save Button */}
                <button
                  onClick={async () => {
                    try {
                      const tableName = `india_reorder_${activeSeller.table_suffix}`;
                      const { error } = await supabase
                        .from(tableName)
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

                      alert('Remark saved successfully!');
                      setRemarkModalOpen(false);
                      setSelectedRemark(null);
                    } catch (error: any) {
                      alert('Error: ' + error.message);
                    }
                  }}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-all shadow-lg"
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save Remark
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}