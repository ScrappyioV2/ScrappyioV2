'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { History, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type PassFileProduct = {
  id: string
  asin: string
  product_name: string | null  // ✅ Underscore
  brand: string | null
  seller_tag: string | null  // ✅ Underscore
  funnel: string | null
  origin_india: boolean | null  // ✅ Underscore
  origin_china: boolean | null  // ✅ Underscore
  usd_price: number | null  // ✅ Underscore
  inr_purchase: number | null  // ✅ Underscore
  usa_link: string | null  // ✅ Underscore
  product_link: string | null  // ✅ Underscore
  target_price: number | null  // ✅ Underscore
  admin_target_price: number | null  // ✅ Underscore
  target_quantity: number | null  // ✅ Underscore
  funnel_quantity?: number | null  // ✅ Underscore
  funnel_seller?: string | null  // ✅ Underscore
  inr_purchase_link?: string | null  // ✅ Underscore
  buying_price: number | null  // ✅ Underscore
  buying_quantity: number | null  // ✅ Underscore
  seller_link: string | null  // ✅ Underscore
  seller_phone: string | null  // ✅ Underscore
  payment_method: string | null  // ✅ Underscore
  tracking_details: string | null  // ✅ Underscore
  delivery_date: string | null  // ✅ Underscore
  status: string | null
  move_to: string | null  // ✅ Underscore
  sent_to_admin: boolean | null  // ✅ Underscore
  sent_to_admin_at: string | null  // ✅ Underscore
  admin_confirmed: boolean | null  // ✅ Underscore
  admin_confirmed_at: string | null  // ✅ Underscore
  check_brand: boolean | null  // ✅ Underscore
  check_item_expire: boolean | null  // ✅ Underscore
  check_small_size: boolean | null  // ✅ Underscore
  check_multi_seller: boolean | null  // ✅ Underscore
  created_at: string | null  // ✅ Underscore
  validation_funnel_seller?: string | null  // ✅ Underscore
  validation_funnel_quantity?: number | null  // ✅ Underscore
  validation_seller_tag?: string | null  // ✅ Underscore
  validation_funnel?: string | null  // ✅ Underscore
  productweight?: number | null    // ✅ NEW
  product_weight?: number | null
  target_price_validation?: number | null
  target_price_link_validation?: string | null
  profit?: number | null
  origin?: string | null
  admin_target_quantity?: number | null
  journey_id?: string | null
  journey_number?: number | null
  total_cost?: number | null
  total_revenue?: number | null
  inr_purchase_from_validation?: number | null
}

// ADD THIS TYPE
type HistorySnapshot = {
  id: string
  stage: string
  createdat: string
  snapshotdata: any
  journeynumber: number
  profit?: number
  totalcost?: number
  status?: string
}


type TabType = 'main_file' | 'price_wait' | 'order_confirmed' | 'china' | 'india' | 'pending' | 'not_found' | 'reject';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('main_file');
  const [products, setProducts] = useState<PassFileProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [movementHistory, setMovementHistory] = useState<Record<string, {
    product: PassFileProduct
    fromStatus: string | null
    toStatus: string
  } | null>>({})
  const [showAllJourneys, setShowAllJourneys] = useState(false);

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)


  // Column visibility state - ALL columns visible by default
  const [visibleColumns, setVisibleColumns] = useState({
    checkbox: true,
    asin: true,
    productlink: true,
    productname: true,
    targetprice: true,
    targetquantity: true,
    funnelquantity: true,
    funnelseller: true,
    inrpurchaselink: true,
    origin: true,
    buyingprice: true,
    buyingquantity: true,
    sellerlink: true,
    sellerphno: true,
    paymentmethod: true,
    trackingdetails: true,
    deliverydate: true,
    moveto: true,
    admintargetprice: true,
  });

  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true)

      // 1. Fetch all purchases (Batch 1)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('usa_purchases')
        .select('*') // Select all columns
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      if (!purchasesData || purchasesData.length === 0) {
        setProducts([])
        return
      }

      // 2. Extract all ASINs for bulk querying
      const allAsins = purchasesData.map((p) => p.asin)

      // 3. Fetch ALL validation data in ONE query (Batch 2)
      // This replaces the loop that was causing the lag
      const { data: validationDataArray, error: valError } = await supabase
        .from('usa_validation_main_file')
        .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase, profit, total_cost, total_revenue')
        .in('asin', allAsins)

      if (valError) console.error('Validation fetch error:', valError)

      // 4. Create a Map for instant lookup (O(1) complexity)
      const validationMap = new Map(
        (validationDataArray || []).map((v) => [v.asin, v])
      )

      // 5. Merge data in memory
      const enrichedData = purchasesData.map((product) => {
        const validationData = validationMap.get(product.asin)

        return {
          ...product,
          product_name: product.product_name ?? null,
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,

          // Validation Fields
          validation_funnel: validationData?.funnel ?? null,
          validation_seller_tag: validationData?.seller_tag ?? null,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase_from_validation: validationData?.inr_purchase ?? null,
          total_cost: validationData?.total_cost ?? null,        // <--- Added
          total_revenue: validationData?.total_revenue ?? null,

          // Ensure these are passed for other calculations
          profit: validationData?.profit ?? null,
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        enrichedData.forEach((product: any) => {
          const existing = latestByAsin.get(product.asin);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByAsin.set(product.asin, product);
          }
        });
        processedData = Array.from(latestByAsin.values());
      }

      setProducts(processedData);
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Silent refresh - updates data WITHOUT loading screen (OPTIMIZED)
  const refreshProductsSilently = async () => {
    try {
      // Fetch purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('usa_purchases')
        .select('*')
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      // Fetch ALL validation data in ONE query (much faster)
      const allAsins = purchasesData.map((p: any) => p.asin)
      const { data: validationDataArray } = await supabase
        .from('usa_validation_main_file')
        .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase')
        .in('asin', allAsins)

      // Create lookup map for fast access
      const validationMap = new Map(
        (validationDataArray || []).map((v: any) => [v.asin, v])
      )

      // Enrich data
      const enrichedData = purchasesData.map((product: any) => {
        const validationData = validationMap.get(product.asin)

        return {
          ...product,
          product_name: product.product_name ?? null,
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          validation_funnel: validationData?.funnel ?? null,
          validation_seller_tag: validationData?.seller_tag ?? null,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase_from_validation: validationData?.inr_purchase ?? null,
          profit: validationData?.profit ?? null,
          total_cost: validationData?.total_cost ?? null,        // <--- Added
          total_revenue: validationData?.total_revenue ?? null,
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        enrichedData.forEach((product: any) => {
          const existing = latestByAsin.get(product.asin);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByAsin.set(product.asin, product);
          }
        });
        processedData = Array.from(latestByAsin.values());
      }

      setProducts(processedData);
    } catch (error) {
      console.error('Error refreshing products:', error)
    }
  }

  // ✅ Ctrl+Z keyboard shortcut for Roll Back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        handleRollBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [movementHistory, activeTab])

  // ✅ FIXED: Proper async handling in useEffect
  useEffect(() => {
    fetchProducts()

    const channel = supabase
      .channel('purchases-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_purchases' }, () => {
        refreshProductsSilently()
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [showAllJourneys]);

  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    checkbox: 50,
    asin: 120,
    history: 180,
    productlink: 80,
    productname: 120,
    targetprice: 100,
    targetquantity: 100,
    admintargetprice: 120,
    funnelquantity: 70,
    funnelseller: 70,
    inrpurchaselink: 100,
    origin: 70,  // ✅ ADD THIS LINE
    buyingprice: 100,
    buyingquantity: 120,
    sellerlink: 100,
    sellerphno: 120,
    paymentmethod: 120,
    trackingdetails: 150,
    deliverydate: 150,
    moveto: 100,
  });

  const [resizing, setResizing] = useState<{ column: string, startX: number, startWidth: number } | null>(null);

  // Handle sending to admin validation
  const handleSendToAdmin = async (product: PassFileProduct) => {
    try {
      // SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.move_to,
          toStatus: 'sent_to_admin',
        },
      }))

      // 🆕 Fetch profit matching BOTH asin AND journey_id
      let validationData = null;

      if (product.journey_id) {
        // Try to match by journey_id first (most accurate)
        const { data } = await supabase
          .from('usa_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price')
          .eq('asin', product.asin)
          .eq('current_journey_id', product.journey_id)
          .maybeSingle();
        validationData = data;
      }

      // Fallback: If no journey match, get latest by asin
      if (!validationData) {
        const { data } = await supabase
          .from('usa_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price')
          .eq('asin', product.asin)
          .order('journey_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        validationData = data;
      }

      // Build origin text based on checkboxes for trigger
      const originParts = []
      if (product.origin_india) originParts.push('India')
      if (product.origin_china) originParts.push('China')
      const originText = originParts.length > 0 ? originParts.join(', ') : 'India'

      // Insert into admin validation - ONLY fields that exist in schema
      const { error: insertError } = await supabase
        .from('usa_admin_validation')
        .insert({
          // Core product info
          asin: product.asin,
          product_name: product.product_name,
          product_link: product.usa_link || product.product_link,

          // Target pricing from validation
          target_price: validationData?.inr_purchase || null,
          target_quantity: 1,
          target_price_validation: validationData?.inr_purchase || null,
          target_price_link_validation: product.inr_purchase_link || null,

          // Funnel & Seller
          funnel: product.validation_funnel ? Number(product.validation_funnel) : null,
          seller_tag: product.validation_seller_tag || null,

          // Buying info (manual entry fields - set to null initially)
          buying_price: null,
          buying_quantity: null,
          seller_link: null,
          seller_phone: '',
          payment_method: '',

          // Origin fields
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          origin: originText,  // Text field for trigger

          // INR Purchase Link
          inr_purchase_link: product.inr_purchase_link || null,

          // Calculation fields from validation
          profit: validationData?.profit || 0,
          total_cost: validationData?.total_cost || 0,
          total_revenue: validationData?.total_revenue || 0,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase: validationData?.inr_purchase ?? null,

          // Admin fields
          admin_status: 'pending',
          admin_target_price: null,  // Admin will fill this
          admin_target_quantity: null,  // Admin will fill this

          // Status
          status: 'pending',
        })

      if (insertError) throw insertError

      // Update usa_purchases
      const { error: updateError } = await supabase
        .from('usa_purchases')
        .update({
          sent_to_admin: true,
          sent_to_admin_at: new Date().toISOString(),
        })
        .eq('id', product.id)

      if (updateError) throw updateError

      alert('Sent to Admin Validation successfully!')
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  // Fetch History for Sidebar
  const fetchHistory = async (asin: string) => {
    setSelectedHistoryAsin(asin)
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('usa_asin_history')
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



  // Handle Price Wait
  const handlePriceWait = async (product: PassFileProduct) => {
    try {
      // ✅ SAVE TO HISTORY FIRST!
      // SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.move_to,
          toStatus: 'price_wait',
        },
      }))

      const { error } = await supabase
        .from('usa_purchases')  // ✅ Underscore
        .update({ move_to: 'pricewait' })  // ✅ Underscore
        .eq('id', product.id)

      if (error) throw error

      alert('Moved to Price Wait successfully!')
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // Handle Not Found
  const handleNotFound = async (product: PassFileProduct) => {
    try {
      // ✅ SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.move_to ?? null,
          toStatus: 'not_found',
        },
      }))

      const { error } = await supabase
        .from('usa_purchases')  // ✅ Underscore
        .update({ move_to: 'notfound' })  // ✅ Underscore
        .eq('id', product.id)

      if (error) throw error

      alert('Marked as Not Found successfully!')
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // Roll Back last movement
  const handleRollBack = async () => {
    const lastMovement = movementHistory[activeTab]

    if (!lastMovement) {
      alert('No recent movement to roll back from this tab')
      return
    }

    // ✅ REMOVED setLoading(true) - no loading screen
    try {
      const { product, fromStatus, toStatus } = lastMovement
      const updateData: any = {}

      if (toStatus === 'sent_to_admin') {
        updateData['sent_to_admin'] = false
        updateData['sent_to_admin_at'] = null

        const { error: deleteError } = await supabase
          .from('usa_admin_validation')
          .delete()
          .eq('asin', product.asin)

        if (deleteError) {
          console.error('Error deleting from admin validation:', deleteError)
        }
      } else if (toStatus === 'price_wait' || toStatus === 'not_found') {
        updateData['move_to'] = fromStatus
      }

      const { error: updateError } = await supabase
        .from('usa_purchases')
        .update(updateData)
        .eq('asin', product.asin)

      if (updateError) throw updateError

      // ✅ Clear history
      setMovementHistory(prev => {
        const newHistory = { ...prev }
        delete newHistory[activeTab]
        return newHistory
      })

      alert(`Rolled back ${product.product_name}`)
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error) {
      console.error('Error rolling back:', error)
      alert('Rollback failed')
    }
    // ✅ NO finally block - no setLoading(false)
  }
  const handleMoveToTracking = async (product: PassFileProduct) => {
  if (!product.admin_confirmed) {
    alert('Only Order Confirmed items can be moved');
    return;
  }

  try {
    console.log('🚀 Moving to tracking:', product.asin);

    // STEP 1: FETCH FRESH DATA (Returns snake_case column names from database)
    const { data: freshProduct, error: fetchError } = await supabase
      .from('usa_purchases')
      .select('*')
      .eq('id', product.id)
      .single();

    if (fetchError || !freshProduct) {
      throw new Error('Could not fetch latest data. Please refresh and try again.');
    }

    console.log('📦 Fresh data fetched:', {
      asin: freshProduct.asin,
      buying_price: freshProduct.buying_price,
      buying_quantity: freshProduct.buying_quantity,
      seller_link: freshProduct.seller_link,
    });

    // STEP 2: Extract ALL unique seller tags
    let sellerTags: string[] = [];
    const rawSellerTag = freshProduct.seller_tag || product.seller_tag || product.validation_seller_tag;
    
    if (rawSellerTag) {
      // Split by comma and clean
      sellerTags = rawSellerTag
        .split(',')
        .map((tag: string) => tag.trim().toUpperCase())
        .filter((tag: string) => tag.length > 0);
      
      // Remove duplicates
      sellerTags = [...new Set(sellerTags)];
    }

    // Fallback to GR if no tags
    if (sellerTags.length === 0) {
      sellerTags = ['GR'];
    }

    console.log('🏷️ Seller tags to process:', sellerTags);

    // Map seller tag to seller ID
    const sellerTagMapping: Record<string, number> = {
      'GR': 1,  // Golden Aura
      'RR': 2,  // Rudra Retail
      'UB': 3,  // UBeauty
      'VV': 4,  // Velvet Vista
    };

    // STEP 3: INSERT into MULTIPLE tracking tables (one per unique seller tag)
    const insertPromises = sellerTags.map(async (tag) => {
      const sellerId = sellerTagMapping[tag] || 1;
      const trackingTableName = `usa_tracking_seller_${sellerId}`;

      console.log(`📊 Inserting into: ${trackingTableName} (Seller: ${tag})`);

      // ✅ ALL column names match usa_purchases schema exactly (snake_case)
      return supabase
        .from(trackingTableName)
        .insert({
          // ========================================
          // 1. CORE IDENTITY (from usa_purchases)
          // ========================================
          asin: freshProduct.asin,                              // ✅ text
          journey_id: freshProduct.journey_id,                  // ✅ uuid
          journey_number: freshProduct.journey_number ?? 1,     // ✅ integer
          
          // ========================================
          // 2. PRODUCT INFORMATION (from usa_purchases)
          // ========================================
          product_link: freshProduct.product_link,              // ✅ text
          product_name: freshProduct.product_name,              // ✅ text
          brand: freshProduct.brand,                            // ✅ text
          
          // ========================================
          // 3. PRICING FIELDS (from usa_purchases)
          // ========================================
          target_price: freshProduct.target_price,              // ✅ numeric
          target_quantity: freshProduct.target_quantity ?? 1,   // ✅ numeric
          admin_target_price: freshProduct.admin_target_price,  // ✅ numeric
          admin_target_quantity: freshProduct.admin_target_quantity, // ✅ integer
          target_price_validation: freshProduct.target_price_validation,    // ✅ numeric
          target_price_link_validation: freshProduct.target_price_link_validation, // ✅ text
          
          // ========================================
          // 4. FUNNEL & SELLER (from usa_purchases)
          // ========================================
          funnel: freshProduct.funnel,                          // ✅ text
          seller_tag: tag,                                      // ✅ text (specific tag for this insert)
          funnel_quantity: freshProduct.funnel_quantity ?? 1,   // ✅ integer
          funnel_seller: freshProduct.funnel_seller,            // ✅ text
          
          // ========================================
          // 5. PURCHASE LINKS (from usa_purchases)
          // ========================================
          inr_purchase_link: freshProduct.inr_purchase_link,    // ✅ text - FIXED!
          
          // ========================================
          // 6. ORIGIN (from usa_purchases)
          // ========================================
          origin: freshProduct.origin,                          // ✅ text
          origin_india: freshProduct.origin_india ?? false,     // ✅ boolean - FIXED!
          origin_china: freshProduct.origin_china ?? false,     // ✅ boolean - FIXED!
          
          // ========================================
          // 7. BUYING DETAILS (from usa_purchases) - USER EDITABLE
          // ========================================
          buying_price: freshProduct.buying_price,              // ✅ numeric - FIXED!
          buying_quantity: freshProduct.buying_quantity,        // ✅ numeric - FIXED!
          seller_link: freshProduct.seller_link,                // ✅ text - FIXED!
          seller_phone: freshProduct.seller_phone,              // ✅ text - FIXED!
          payment_method: freshProduct.payment_method,          // ✅ text - FIXED!
          
          // ========================================
          // 8. TRACKING & DELIVERY (from usa_purchases) - USER EDITABLE
          // ========================================
          tracking_details: freshProduct.tracking_details,      // ✅ text - FIXED!
          delivery_date: freshProduct.delivery_date,            // ✅ date - FIXED!
          
          // ========================================
          // 9. FINANCIAL DATA (from usa_purchases)
          // ========================================
          profit: freshProduct.profit,                          // ✅ numeric
          product_weight: freshProduct.product_weight,          // ✅ numeric
          usd_price: freshProduct.usd_price,                    // ✅ numeric
          inr_purchase: freshProduct.inr_purchase,              // ✅ numeric
          
          // ========================================
          // 10. STATUS FIELDS
          // ========================================
          admin_status: 'confirmed',
          status: 'tracking',
          moved_at: new Date().toISOString(),
        });
    });

    // Wait for all insertions to complete
    const results = await Promise.all(insertPromises);

    // Check for errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('❌ Insert errors:', errors);
      throw new Error(`Failed to insert into ${errors.length} table(s)`);
    }

    console.log(`✅ Successfully inserted into ${sellerTags.length} tracking table(s): ${sellerTags.join(', ')}`);

    // STEP 4: DELETE from purchases (only after ALL inserts succeed)
    const { error: deleteError } = await supabase
      .from('usa_purchases')
      .delete()
      .eq('id', product.id);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      throw deleteError;
    }

    console.log('✅ Delete successful');

    alert(`✅ Moved to ${sellerTags.length} tracking table(s): ${sellerTags.join(', ')}`);
    await refreshProductsSilently();
  } catch (error: any) {
    console.error('❌ Move error:', error);
    alert('Failed to move: ' + error.message);
  }
};

  // Handle column resize
  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    setResizing({
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    });
  };

  // Handle column resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const diff = e.clientX - resizing.startX;
        const newWidth = Math.max(50, resizing.startWidth + diff);
        setColumnWidths(prev => ({
          ...prev,
          [resizing.column]: newWidth,
        }));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, columnWidths]);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||  // ✅ Underscore
      p.funnel?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    switch (activeTab) {
      case 'main_file':  // ✅ Underscore
        return !p.sent_to_admin && !p.move_to  // ✅ Underscores
      case 'price_wait':
        return p.move_to === 'pricewait'  // ✅ Underscore
      case 'order_confirmed':  // ✅ Underscore
        return p.admin_confirmed === true  // ✅ Underscore
      case 'china':
        return p.origin_china  // ✅ Underscore
      case 'india':
        return p.origin_india  // ✅ Underscore
      case 'pending':
        return p.status === 'pending'
      case 'not_found':
        return p.move_to === 'notfound'  // ✅ Underscore
      default:
        return true
    }
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("usa_purchases")  // CORRECT!
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert('Error updating: ' + error.message);
    }
  };

  const tabs = [
    { key: 'mainfile', label: 'Main File', count: products.filter(p => !p.sent_to_admin && !p.move_to).length },
    { key: 'orderconfirmed', label: 'Order Confirmed', count: products.filter(p => p.admin_confirmed === true).length },
    { key: 'india', label: 'India', count: products.filter(p => p.origin_india).length },
    { key: 'china', label: 'China', count: products.filter(p => p.origin_china).length },
    { key: 'pending', label: 'Pending', count: products.filter(p => p.status === 'pending').length },
    { key: 'pricewait', label: 'Price Wait', count: products.filter(p => p.move_to === 'pricewait').length },
    { key: 'notfound', label: 'Not Found', count: products.filter(p => p.move_to === 'notfound').length },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 p-6 text-slate-200 font-sans selection:bg-indigo-500/30">

      {/* Header Section */}
      <div className="flex-none mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Purchases</h1>
            <p className="text-slate-400 mt-1">Manage purchase orders and track confirmations</p>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            TOTAL: <span className="text-white font-bold">{products.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs - Midnight Theme Pills */}
      <div className="flex-none flex gap-2 mb-6 flex-wrap p-1.5 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit backdrop-blur-sm overflow-x-auto">
        {/* 1. Main File */}
        <button
          onClick={() => setActiveTab('main_file')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'main_file'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-blue-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Main File ({products.filter(p => !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'main_file' && <div className="absolute inset-0 opacity-10 bg-blue-500" />}
        </button>

        {/* 2. Order Confirmed */}
        <button
          onClick={() => setActiveTab('order_confirmed')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'order_confirmed'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-emerald-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Confirmed ({products.filter(p => p.admin_confirmed === true).length})</span>
          {activeTab === 'order_confirmed' && <div className="absolute inset-0 opacity-10 bg-emerald-500" />}
        </button>

        {/* 3. India */}
        <button
          onClick={() => setActiveTab('india')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'india'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-orange-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">India ({products.filter(p => p.origin_india).length})</span>
          {activeTab === 'india' && <div className="absolute inset-0 opacity-10 bg-orange-500" />}
        </button>

        {/* 4. China */}
        <button
          onClick={() => setActiveTab('china')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'china'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-rose-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">China ({products.filter(p => p.origin_china).length})</span>
          {activeTab === 'china' && <div className="absolute inset-0 opacity-10 bg-rose-500" />}
        </button>

        {/* 5. Pending */}
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'pending'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-purple-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Pending ({products.filter(p => p.status === 'pending').length})</span>
          {activeTab === 'pending' && <div className="absolute inset-0 opacity-10 bg-purple-500" />}
        </button>

        {/* 6. Price Wait */}
        <button
          onClick={() => setActiveTab('price_wait')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'price_wait'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-amber-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Price Wait ({products.filter(p => p.move_to === 'pricewait').length})</span>
          {activeTab === 'price_wait' && <div className="absolute inset-0 opacity-10 bg-amber-500" />}
        </button>

        {/* 7. Not Found */}
        <button
          onClick={() => setActiveTab('not_found')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'not_found'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-slate-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Not Found ({products.filter(p => p.move_to === 'notfound').length})</span>
          {activeTab === 'not_found' && <div className="absolute inset-0 opacity-10 bg-slate-500" />}
        </button>
      </div>

      {/* Search & Controls */}
      <div className="flex-none mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-md group">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ASIN, Product Name, or Funnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-200 placeholder-slate-600 transition-all shadow-sm text-sm"
          />
        </div>

        {/* Buttons Group */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRollBack}
            disabled={!movementHistory[activeTab]}
            className="px-4 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-lg shadow-orange-900/20 transition-all border border-orange-500/50"
            title="Roll Back last action from this tab (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Roll Back
          </button>

          {/* 🆕 Journey Toggle Button */}
          <button
            onClick={() => setShowAllJourneys(!showAllJourneys)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border shadow-lg ${showAllJourneys
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500/50 shadow-indigo-900/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
            title={`Currently showing ${showAllJourneys ? 'ALL journey cycles' : 'latest journey only'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {showAllJourneys ? 'Show Latest Only' : 'Show All Journeys'}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Hide Columns
            </button>

            {isColumnMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-64 animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="font-semibold text-slate-200 mb-3 text-sm">Toggle Columns</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {Object.keys(visibleColumns).map((col) => {
                      const columnDisplayNames: { [key: string]: string } = {
                        'checkbox': 'Checkbox',
                        'asin': 'ASIN',
                        'productlink': 'Product Link',
                        'productname': 'Product Name',
                        'targetprice': 'Validation Target Price',
                        'targetquantity': 'Target Quantity',
                        'admintargetprice': 'Admin Target Price',
                        'funnelquantity': 'Funnel',
                        'funnelseller': 'Seller Tag',
                        'inrpurchaselink': 'INR Purchase Link',
                        'origin': 'Origin',
                        'buyingprice': 'Buying Price',
                        'buyingquantity': 'Buying Quantity',
                        'sellerlink': 'Seller Link',
                        'sellerphno': 'Seller Ph No.',
                        'paymentmethod': 'Payment Method',
                        'trackingdetails': 'Tracking Details',
                        'deliverydate': 'Delivery Date',
                        'moveto': 'Move To',
                      };
                      return (
                        <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-2 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                            className="w-4 h-4 text-indigo-500 rounded border-slate-600 bg-slate-800 focus:ring-indigo-500/50"
                          />
                          <span className="text-sm text-slate-300">{columnDisplayNames[col] || col}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded hover:bg-indigo-500 hover:text-white text-xs font-medium transition-colors"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-xs font-medium transition-colors border border-slate-700"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-slate-800">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          <table className="w-full divide-y divide-slate-800 table-fixed" style={{ minWidth: '2500px' }}>
            <thead className="bg-slate-950 sticky top-0 z-10 shadow-md">
              <tr>
                {visibleColumns.checkbox && (
                  <th className="px-4 py-3 text-center bg-slate-950" style={{ width: `${columnWidths.checkbox}px` }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                    />
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('checkbox', e)} />
                  </th>
                )}

                {visibleColumns.asin && (
                  <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.asin}px` }}>
                    ASIN
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('asin', e)} />
                  </th>
                )}

                {/* ✅ HISTORY COLUMN */}
                <th
                  className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950"
                  style={{ width: `${columnWidths.history}px` }}
                >
                  HISTORY
                  <div
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                    onMouseDown={(e) => handleMouseDown('history', e)}
                  />
                </th>


                {visibleColumns.productlink && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.productlink}px` }}>PRODUCT LINK<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('productlink', e)} /></th>}
                {visibleColumns.productname && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.productname}px` }}>PRODUCT NAME<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('productname', e)} /></th>}

                {visibleColumns.targetprice && <th className="px-3 py-3 text-center text-xs font-bold text-emerald-400 uppercase relative group bg-emerald-900/10" style={{ width: `${columnWidths.targetprice}px` }}>Validation Target Price<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('targetprice', e)} /></th>}

                {visibleColumns.targetquantity && <th className="px-3 py-3 text-center text-xs font-bold text-emerald-400 uppercase relative group bg-emerald-900/10" style={{ width: `${columnWidths.targetquantity}px` }}>Target Quantity<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('targetquantity', e)} /></th>}

                {visibleColumns.admintargetprice && <th className="px-3 py-3 text-center text-xs font-bold text-purple-400 uppercase relative group bg-purple-900/10" style={{ width: `${columnWidths.admintargetprice}px` }}>Admin Target Price<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('admintargetprice', e)} /></th>}

                {visibleColumns.funnelquantity && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.funnelquantity}px` }}>Funnel<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('funnelquantity', e)} /></th>}

                {visibleColumns.funnelseller && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.funnelseller}px` }}>Seller Tag<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('funnelseller', e)} /></th>}

                {visibleColumns.inrpurchaselink && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.inrpurchaselink}px` }}>INR Purchase Link<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('inrpurchaselink', e)} /></th>}

                {visibleColumns.origin && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.origin}px` }}>Origin<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('origin', e)} /></th>}

                {visibleColumns.buyingprice && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.buyingprice}px` }}>Buying Price<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('buyingprice', e)} /></th>}

                {visibleColumns.buyingquantity && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.buyingquantity}px` }}>Buying Quantity<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('buyingquantity', e)} /></th>}

                {visibleColumns.sellerlink && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.sellerlink}px` }}>Seller Link<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('sellerlink', e)} /></th>}

                {visibleColumns.sellerphno && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.sellerphno}px` }}>Seller Ph No.<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('sellerphno', e)} /></th>}

                {visibleColumns.paymentmethod && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.paymentmethod}px` }}>Payment Method<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('paymentmethod', e)} /></th>}

                {visibleColumns.trackingdetails && <th className="px-3 py-3 text-center text-xs font-bold text-emerald-400 uppercase relative group bg-emerald-900/10" style={{ width: `${columnWidths.trackingdetails}px` }}>Tracking Details<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('trackingdetails', e)} /></th>}

                {visibleColumns.deliverydate && <th className="px-3 py-3 text-center text-xs font-bold text-emerald-400 uppercase relative group bg-emerald-900/10" style={{ width: `${columnWidths.deliverydate}px` }}>Delivery Date<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('deliverydate', e)} /></th>}

                {visibleColumns.moveto && <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase relative group bg-slate-950" style={{ width: `${columnWidths.moveto}px` }}>Move TO<div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('moveto', e)} /></th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                      <span className="text-lg font-semibold text-slate-400">No products available in {activeTab.replace('_', ' ')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  return (
                    <tr key={product.id} className="hover:bg-slate-800/60 transition-colors border-b border-slate-800 group">

                      {/* ✅ Checkbox */}
                      {visibleColumns.checkbox && (
                        <td className="px-4 py-2 text-center" style={{ width: `${columnWidths.checkbox}px` }}>
                          <input type="checkbox" checked={selectedIds.has(product.id)} onChange={(e) => handleSelectRow(product.id, e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer" />
                        </td>
                      )}

                      {/* ✅ ASIN COLUMN - Only ASIN text */}
                      {visibleColumns.asin && (
                        <td className="px-3 py-2 font-mono text-sm text-slate-300" style={{ width: `${columnWidths.asin}px` }}>
                          <div className="truncate">{product.asin}</div>
                        </td>
                      )}

                      {/* ✅ HISTORY COLUMN - Only Clock Icon (Working) */}
                      <td className="px-3 py-2 text-center" style={{ width: `${columnWidths.history}px` }}>
                        <button
                          onClick={() => fetchHistory(product.asin)}
                          className="p-2 rounded-full hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="View Journey History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </td>

                      {/* Product Link */}
                      {visibleColumns.productlink && <td className="px-3 py-2 text-center overflow-hidden" style={{ width: `${columnWidths.productlink}px` }}>
                        {(product.usa_link || product.product_link) ? (
                          <a href={(product.usa_link || product.product_link) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline text-xs font-medium">View</a>
                        ) : <span className="text-xs text-slate-600">-</span>}
                      </td>}

                      {/* Product Name */}
                      {visibleColumns.productname && <td className="px-3 py-2 text-sm text-slate-200 overflow-hidden" style={{ width: `${columnWidths.productname}px` }}><div className="truncate" title={product.product_name || '-'}>{product.product_name || '-'}</div></td>}

                      {/* Target Price */}
                      {visibleColumns.targetprice && <td className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: `${columnWidths.targetprice}px` }}>
                        {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                          <div className="px-2 py-1 text-sm font-medium text-emerald-300">{product.target_price ?? product.usd_price ?? '-'}</div>
                        ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
                      </td>}

                      {/* Target Qty */}
                      {visibleColumns.targetquantity && <td className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: `${columnWidths.targetquantity}px` }}>
                        {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                          <div className="px-2 py-1 text-sm font-medium text-emerald-300">{product.target_quantity ?? 1}</div>
                        ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
                      </td>}

                      {/* Admin Target Price */}
                      {visibleColumns.admintargetprice && <td className="px-3 py-2 bg-purple-900/10 overflow-hidden" style={{ width: `${columnWidths.admintargetprice}px` }}>
                        {activeTab === 'order_confirmed' ? (
                          <div className="px-2 py-1 text-sm font-medium text-purple-300">₹{product.admin_target_price ?? '-'}</div>
                        ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
                      </td>}

                      {/* Funnel Qty */}
                      {visibleColumns.funnelquantity && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelquantity}px` }}>
                        {product.validation_funnel ? (
                          <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-xs ${product.validation_funnel === 'HD' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            product.validation_funnel === 'LD' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                              product.validation_funnel === 'DP' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                'bg-slate-700 text-slate-300'
                            }`}>{product.validation_funnel}</span>
                        ) : <span className="text-xs text-slate-600">-</span>}
                      </td>}

                      {/* Seller Tag */}
                      {visibleColumns.funnelseller && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelseller}px` }}>
                        {product.validation_seller_tag ? (
                          <div className="flex flex-wrap gap-1">
                            {product.validation_seller_tag.split(',').map(tag => {
                              const cleanTag = tag.trim();
                              let badgeColor = 'bg-slate-700 text-white';
                              if (cleanTag === 'GR') badgeColor = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
                              else if (cleanTag === 'RR') badgeColor = 'bg-slate-600 text-slate-200 border border-slate-500';
                              else if (cleanTag === 'UB') badgeColor = 'bg-pink-500/20 text-pink-300 border border-pink-500/30';
                              else if (cleanTag === 'VV') badgeColor = 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
                              return <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${badgeColor}`}>{cleanTag}</span>
                            })}
                          </div>
                        ) : <span className="text-xs text-slate-600">-</span>}
                      </td>}

                      {/* INR Link */}
                      {visibleColumns.inrpurchaselink && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.inrpurchaselink}px` }}>
                        {product.inr_purchase_link ? (
                          <a href={product.inr_purchase_link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline text-xs truncate block">View</a>
                        ) : <span className="text-xs text-slate-600">-</span>}
                      </td>}

                      {/* Origin */}
                      {visibleColumns.origin && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.origin}px` }}>
                        <div className="flex gap-1">
                          {product.origin_india && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs">India</span>}
                          {product.origin_china && <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs">China</span>}
                          {!product.origin_india && !product.origin_china && <span className="text-xs text-slate-600">-</span>}
                        </div>
                      </td>}

                      {/* Buying Price - Input */}
                      {visibleColumns.buyingprice && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingprice}px` }}>
                        <input type="number" defaultValue={product.buying_price || ''} onBlur={(e) => handleCellEdit(product.id, 'buying_price', parseFloat(e.target.value))} className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Price" />
                      </td>}

                      {/* Buying Qty - Input */}
                      {visibleColumns.buyingquantity && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingquantity}px` }}>
                        <input type="number" defaultValue={product.buying_quantity || ''} onBlur={(e) => handleCellEdit(product.id, 'buying_quantity', parseInt(e.target.value))} className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Qty" />
                      </td>}

                      {/* Seller Link - Input */}
                      {visibleColumns.sellerlink && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerlink}px` }}>
                        <input type="text" defaultValue={product.seller_link || ''} onBlur={(e) => handleCellEdit(product.id, 'seller_link', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Link" />
                      </td>}

                      {/* Seller Phone - Input */}
                      {visibleColumns.sellerphno && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerphno}px` }}>
                        <input type="text" defaultValue={product.seller_phone || ""} onBlur={(e) => handleCellEdit(product.id, 'seller_phone', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Phone" />
                      </td>}

                      {/* Payment Method - Input */}
                      {visibleColumns.paymentmethod && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.paymentmethod}px` }}>
                        <input type="text" defaultValue={product.payment_method || ""} onBlur={(e) => handleCellEdit(product.id, 'payment_method', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="Method" />
                      </td>}

                      {/* Tracking Details - Input */}
                      {visibleColumns.trackingdetails && <td className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: `${columnWidths.trackingdetails}px` }}>
                        {activeTab === 'order_confirmed' ? (
                          <input type="text" defaultValue={product.tracking_details || ""} onBlur={(e) => handleCellEdit(product.id, 'tracking_details', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Tracking #" />
                        ) : (
                          <span className="text-xs text-slate-500 italic">After confirmation</span>
                        )}
                      </td>}

                      {/* Delivery Date - Input */}
                      {visibleColumns.deliverydate && <td className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: `${columnWidths.deliverydate}px` }}>
                        {activeTab === 'order_confirmed' ? (
                          <input type="date" defaultValue={product.delivery_date || ""} onBlur={(e) => handleCellEdit(product.id, 'delivery_date', e.target.value)} className="w-full px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                        ) : (
                          <span className="text-xs text-slate-500 italic">After confirmation</span>
                        )}
                      </td>}

                      {/* Move To Actions */}
                      {visibleColumns.moveto && <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.moveto}px` }}>
                        <div className="flex gap-1 justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (activeTab === 'order_confirmed') {
                                handleMoveToTracking(product);
                              } else {
                                handleSendToAdmin(product);
                              }
                            }}
                            className="w-8 h-8 bg-blue-600 text-white text-xs font-bold rounded"
                            title="Done"
                          >
                            D
                          </button>
                          <button type="button" onClick={() => handlePriceWait(product)} className="w-8 h-8 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500 hover:text-black flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold" title="Price Wait">PW</button>
                          <button type="button" onClick={() => handleNotFound(product)} className="w-8 h-8 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold" title="Not Found">NF</button>
                        </div>
                      </td>}
                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>
        {/* Footer Stats */}
        <div className="flex-none border-t border-slate-800 bg-slate-900 px-4 py-3">
          <div className="text-sm text-slate-400">
            Showing <span className="font-bold text-white">{filteredProducts.length}</span> of <span className="font-bold text-white">{products.length}</span> products
            {selectedIds.size > 0 && <span className="ml-2 text-indigo-400 font-semibold">| {selectedIds.size} selected</span>}
          </div>
        </div>
      </div>
      {/* ✅ HISTORY SIDEBAR SLIDE-OVER */}
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
              className="absolute top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Journey History</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedHistoryAsin}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryAsin(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center text-slate-500 py-10">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No history found for this item.</p>
                  </div>
                ) : (
                  historyData.map((snapshot, idx) => (
                    <div key={snapshot.id} className="relative pl-6 border-l-2 border-indigo-500/30 last:border-0 pb-6">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500" />

                      {/* Card */}
                      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                        {/* Journey Info */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Journey #{snapshot.journeynumber}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(snapshot.createdat).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Stage Name */}
                        <h3 className="text-sm font-semibold text-white mb-3 capitalize">
                          {snapshot.stage.replace(/_/g, ' → ')}
                        </h3>

                        {/* Snapshot Details */}
                        <div className="space-y-1.5 text-xs">
                          {snapshot.profit !== null && snapshot.profit !== undefined && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Profit:</span>
                              <span className={snapshot.profit > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                ₹{snapshot.profit.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {snapshot.totalcost && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Total Cost:</span>
                              <span className="text-slate-200">₹{snapshot.totalcost.toFixed(2)}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.productweight && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Weight:</span>
                              <span className="text-slate-200">{snapshot.snapshotdata.productweight}g</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.usdprice && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">USD Price:</span>
                              <span className="text-slate-200">${snapshot.snapshotdata.usdprice}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.inrpurchase && (
                            <div className="flex justify-between items-center py-1">
                              <span className="text-slate-400">INR Purchase:</span>
                              <span className="text-slate-200">₹{snapshot.snapshotdata.inrpurchase}</span>
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
      </AnimatePresence>
    </div>
  );
}
