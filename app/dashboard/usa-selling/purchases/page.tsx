'use client';
import PageGuard from '../../../components/PageGuard'
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

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

      // Fetch purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('usa_purchases')  // ✅ Correct table name
        .select()
        .order('created_at', { ascending: false })  // ✅ Underscore

      if (purchasesError) throw purchasesError

      // Fetch validation data for sellertag and funnel badges
      const enrichedData = await Promise.all(
        purchasesData.map(async (product) => {
          // Fetch from validation main file table
          const { data: validationData } = await supabase
            .from('usa_validation_main_file')
            .select('seller_tag, funnel, product_weight, usd_price, inr_purchase')  // ✅ ADDED 3 fields
            .eq('asin', product.asin)
            .maybeSingle()

          return {
            ...product,
            productname: (product as any).product_name ?? null,
            originindia: (product as any).origin_india ?? false,
            originchina: (product as any).origin_china ?? false,
            validation_funnel: validationData?.funnel ?? null,
            validation_seller_tag: validationData?.seller_tag ?? null,
            // ✅ ADD THESE 3 NEW FIELDS
            product_weight: validationData?.product_weight ?? null,
            usd_price: validationData?.usd_price ?? null,
            inr_purchase_from_validation: validationData?.inr_purchase ?? null,
          }
        })
      )

      setProducts(enrichedData)
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
        }
      })

      setProducts(enrichedData)
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
  }, [])

  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    checkbox: 50,
    asin: 120,
    productlink: 80,
    productname: 140,
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

      // Fetch profit from validation
      const { data: validationData } = await supabase
        .from('usa_validation_main_file')
        .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price')
        .eq('asin', product.asin)
        .maybeSingle()

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
      case 'reject':
        return p.move_to === 'reject'  // ✅ Underscore
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading purchases...</div>
      </div>
    );
  }

  const tabs = [
    { key: 'main_file', label: 'Main File', count: products.filter(p => !p.sent_to_admin && !p.move_to).length },
    { key: 'price_wait', label: 'Price Wait', count: products.filter(p => p.move_to === 'price_wait').length },
    { key: 'order_confirmed', label: 'Order Confirmed', count: products.filter(p => p.admin_confirmed === true).length, },
    { key: 'china', label: 'China', count: products.filter(p => p.origin_china).length },
    { key: 'india', label: 'India', count: products.filter(p => p.origin_india).length },
    { key: 'pending', label: 'Pending', count: products.filter(p => p.status === 'pending').length },
    { key: 'not_found', label: 'Not Found', count: products.filter(p => p.move_to === 'not_found').length },
    { key: 'reject', label: 'Reject', count: products.filter(p => p.move_to === 'reject').length },
  ];



  return (
    <PageGuard>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header Section - FIXED */}
        <div className="flex-none px-6 pt-6 pb-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
            <p className="text-gray-600 mt-1">Manage purchase orders and track confirmations</p>
          </div>

          {/* Tabs - FIXED */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("main_file")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "main_file"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              Main File
            </button>
            <button
              onClick={() => setActiveTab("price_wait")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "price_wait"
                ? "border-yellow-600 text-yellow-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              Price Wait
            </button>
            <button
              onClick={() => setActiveTab("order_confirmed")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "order_confirmed"
                ? "border-green-600 text-green-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              Order Confirmed
            </button>
            <button
              onClick={() => setActiveTab("china")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "china"
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              China
            </button>
            <button
              onClick={() => setActiveTab("india")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "india"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              India
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "pending"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab("reject")}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "reject"
                ? "border-gray-600 text-gray-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
            >
              Reject
            </button>
            <button
              onClick={() => setActiveTab('not_found')}
              className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'not_found'
                ? 'border-gray-600 text-gray-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              Not Found
            </button>
          </div>
        </div>

        {/* Search - FIXED */}
        <div className="flex gap-3 items-center mb-6 px-6">
          <input
            type="text"
            placeholder="Search by ASIN, Product Name, or Funnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Roll Back Button */}
          <button
            onClick={handleRollBack}
            disabled={!movementHistory[activeTab]}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium whitespace-nowrap"
            title="Roll Back last action from this tab (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Roll Back
          </button>

          {/* NEW: Hide Columns Button */}
          <div className="relative">
            <button
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Hide Columns
            </button>

            {/* Dropdown Menu */}
            {isColumnMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsColumnMenuOpen(false)}
                />

                {/* Menu */}
                <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-xl p-4 z-20 w-64">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">Toggle Columns</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {Object.keys(visibleColumns).map((col) => {
                      // Custom display names for columns
                      const columnDisplayNames: { [key: string]: string } = {
                        'checkbox': 'Checkbox',
                        'asin': 'ASIN',
                        'productlink': 'Product Link',
                        'productname': 'Product Name',
                        'targetprice': 'Validation Target Price',
                        'targetquantity': 'Target Quantity',
                        'admintargetprice': 'Admin Target Price',
                        'funnelquantity': 'Funnel',  // ✅ Changed from "Funnel Quantity"
                        'funnelseller': 'Seller Tag',  // ✅ Changed from "Funnel Seller"
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
                        <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                            onChange={(e) =>
                              setVisibleColumns({
                                ...visibleColumns,
                                [col]: e.target.checked,
                              })
                            }
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {columnDisplayNames[col] || col}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-3 pt-3 border-t flex gap-2">
                    <button
                      onClick={() =>
                        setVisibleColumns(
                          Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns)
                        )
                      }
                      className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() =>
                        setVisibleColumns(
                          Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns)
                        )
                      }
                      className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs font-medium"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table Container - SCROLLABLE ONLY */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="bg-white rounded-lg shadow h-full flex flex-col">
            {/* Table Wrapper with Scroll */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full divide-y divide-gray-200" style={{ minWidth: '2500px' }}>
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    {visibleColumns.checkbox && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.checkbox}px` }}>
                        <input type="checkbox" checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} className="rounded" />
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('checkbox', e)} />
                      </th>
                    )}

                    {visibleColumns.asin && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.asin}px` }}>
                        ASIN
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('asin', e)} />
                      </th>
                    )}

                    {visibleColumns.productlink && (
                      <th
                        className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group"
                        style={{
                          width: `${columnWidths.productlink}px`,
                          maxWidth: `${columnWidths.productlink}px`,
                          minWidth: `${columnWidths.productlink}px`
                        }}
                      >
                        PRODUCT LINK
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleMouseDown('productlink', e)}
                        />
                      </th>
                    )}

                    {/* Product Name Header */}
                    {visibleColumns.productname && (
                      <th
                        className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group"
                        style={{
                          width: `${columnWidths.productname}px`,
                          maxWidth: `${columnWidths.productname}px`,  // ✅ ADD THIS LINE
                          minWidth: `${columnWidths.productname}px`   // ✅ ADD THIS LINE TOO
                        }}
                      >
                        PRODUCT NAME
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleMouseDown('productname', e)}
                        />
                      </th>
                    )}

                    {visibleColumns.targetprice && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.targetprice}px` }}>
                        Validation Target Price
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('targetprice', e)} />
                      </th>
                    )}

                    {visibleColumns.targetquantity && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.targetquantity}px` }}>
                        Target Quantity
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('targetquantity', e)} />
                      </th>
                    )}

                    {visibleColumns.admintargetprice && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-purple-50 relative group" style={{ width: `${columnWidths.admintargetprice}px` }}>
                        Admin Target Price
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('admintargetprice', e)} />
                      </th>
                    )}

                    {visibleColumns.funnelquantity && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.funnel_quantity}px` }}>
                        Funnel
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('funnel_quantity', e)} />
                      </th>
                    )}

                    {visibleColumns.funnelseller && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.funnel_seller}px` }}>
                        Seller Tag
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('funnel_seller', e)} />
                      </th>
                    )}

                    {visibleColumns.inrpurchaselink && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.inrpurchaselink}px` }}>
                        INR Purchase Link
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('inrpurchaselink', e)} />
                      </th>
                    )}

                    {visibleColumns.origin && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.origin}px` }}>
                        Origin
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('origin', e)} />
                      </th>
                    )}

                    {visibleColumns.buyingprice && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.buying_price}px` }}>
                        Buying Price
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('buying_price', e)} />
                      </th>
                    )}

                    {visibleColumns.buyingquantity && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.buying_quantity}px` }}>
                        Buying Quantity
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('buying_quantity', e)} />
                      </th>
                    )}

                    {visibleColumns.sellerlink && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.seller_link}px` }}>
                        Seller Link
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('seller_link', e)} />
                      </th>
                    )}

                    {visibleColumns.sellerphno && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.seller_ph_no}px` }}>
                        Seller Ph No.
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('seller_ph_no', e)} />
                      </th>
                    )}

                    {visibleColumns.paymentmethod && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.payment_method}px` }}>
                        Payment Method
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('payment_method', e)} />
                      </th>
                    )}

                    {visibleColumns.trackingdetails && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.tracking_details}px` }}>
                        Tracking Details
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('tracking_details', e)} />
                      </th>
                    )}

                    {visibleColumns.deliverydate && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.delivery_date}px` }}>
                        Delivery Date
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('delivery_date', e)} />
                      </th>
                    )}

                    {visibleColumns.moveto && (
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.move_to}px` }}>
                        Move TO
                        <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('move_to', e)} />
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-4 py-8...">
                        No products available in {activeTab.replace('_', ' ')}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => {
                      return (
                        <tr key={product.id} className="hover:bg-gray-50 group">
                          {/* Checkbox */}
                          {visibleColumns.checkbox && (
                            <td className="px-4 py-2 text-center overflow-hidden" style={{ width: `${columnWidths.checkbox}px` }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(product.id)}
                                onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                className="rounded"
                              />
                            </td>
                          )}

                          {/* ASIN */}
                          {visibleColumns.asin && (
                            <td className="px-3 py-2 font-mono text-sm overflow-hidden" style={{ width: `${columnWidths.asin}px` }}>
                              <div className="truncate">{product.asin}</div>
                            </td>
                          )}

                          {/* Product Link Cell */}
                          {visibleColumns.productlink && (
                            <td
                              className="px-3 py-2 overflow-hidden text-center"
                              style={{
                                width: `${columnWidths.productlink}px`,
                                maxWidth: `${columnWidths.productlink}px`,
                                minWidth: `${columnWidths.productlink}px`
                              }}
                            >
                              {(product.usa_link || product.product_link) ? (
                                <a
                                  href={(product.usa_link || product.product_link) ?? undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs font-medium"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          )}

                          {/* Product Name Cell */}
                          {visibleColumns.productname && (
                            <td
                              className="px-3 py-2 font-mono text-sm overflow-hidden"
                              style={{
                                width: `${columnWidths.productname}px`,
                                maxWidth: `${columnWidths.productname}px`,  // ✅ ADD THIS LINE
                                minWidth: `${columnWidths.productname}px`   // ✅ ADD THIS LINE TOO
                              }}
                            >
                              <div className="truncate" title={product.product_name || '-'}>
                                {product.product_name || '-'}
                              </div>
                            </td>
                          )}

                          {/* Target Price */}
                          {visibleColumns.targetprice && (
                            <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.targetprice}px` }}>
                              {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                                <div className="px-2 py-1 text-sm font-medium text-gray-900">
                                  {product.target_price ?? product.usd_price ?? '-'}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">After confirmation</span>
                              )}
                            </td>
                          )}

                          {/* Target Quantity */}
                          {visibleColumns.targetquantity && (
                            <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.targetquantity}px` }}>
                              {activeTab === 'main_file' || activeTab === 'order_confirmed' ? (
                                <div className="px-2 py-1 text-sm font-medium text-gray-900">
                                  {product.target_quantity ?? 1}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">After confirmation</span>
                              )}
                            </td>
                          )}

                          {/* Admin Target Price - Only visible in Order Confirmed tab */}
                          {visibleColumns.admintargetprice && (
                            <td className="px-3 py-2 bg-purple-50 overflow-hidden" style={{ width: `${columnWidths.admintargetprice}px` }}>
                              {activeTab === 'order_confirmed' ? (
                                <div className="px-2 py-1 text-sm font-medium text-purple-900">
                                  ₹{product.admin_target_price ?? '-'}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">After confirmation</span>
                              )}
                            </td>
                          )}

                          {/* Funnel Quantity - Shows Funnel Badge from Validation */}
                          {visibleColumns.funnelquantity && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelquantity}px` }}>
                              {product.validation_funnel ? (
                                <span className={`w-9 h-9 inline-flex items-center justify-center rounded-full font-bold text-sm ${product.validation_funnel === 'HD' ? 'bg-green-500 text-white' :
                                  product.validation_funnel === 'LD' ? 'bg-blue-500 text-white' :
                                    product.validation_funnel === 'DP' ? 'bg-yellow-400 text-black' :
                                      'bg-gray-400 text-white'
                                  }`}>
                                  {product.validation_funnel}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">-</span>
                              )}
                            </td>
                          )}

                          {/* Funnel Seller - Shows Seller Tags from Validation */}
                          {visibleColumns.funnelseller && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelseller}px` }}>
                              {product.validation_seller_tag ? (
                                <div className="flex flex-wrap gap-2">
                                  {product.validation_seller_tag.split(',').map((tag) => {
                                    const cleanTag = tag.trim();
                                    return (
                                      <span
                                        key={cleanTag}
                                        className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm ${cleanTag === 'GR' ? 'bg-yellow-400 text-black' :
                                          cleanTag === 'RR' ? 'bg-gray-400 text-black' :
                                            cleanTag === 'UB' ? 'bg-pink-500 text-white' :
                                              cleanTag === 'VV' ? 'bg-purple-600 text-white' :
                                                'bg-slate-700 text-white'
                                          }`}
                                      >
                                        {cleanTag}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">-</span>
                              )}
                            </td>
                          )}

                          {/* INR Purchase Link - Auto-fetched from Validation */}
                          {visibleColumns.inrpurchaselink && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.inrpurchaselink}px` }}>
                              {product.inr_purchase_link ? (
                                <a
                                  href={product.inr_purchase_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs truncate block"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400 italic">-</span>
                              )}
                            </td>
                          )}

                          {/* Origin - Auto-fetched from Validation (Badges) */}
                          {visibleColumns.origin && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.origin}px` }}>
                              <div className="flex flex-wrap gap-2">
                                {product.origin_india && (
                                  <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-semibold">
                                    India
                                  </span>
                                )}
                                {product.origin_china && (
                                  <span className="px-2 py-1 bg-red-500 text-white rounded text-xs font-semibold">
                                    China
                                  </span>
                                )}
                                {!product.origin_india && !product.origin_china && (
                                  <span className="text-xs text-gray-400 italic">-</span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Buying Price - Manual Entry Only */}
                          {visibleColumns.buyingprice && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingprice}px` }}>
                              <input
                                type="number"
                                defaultValue={product.buying_price || ''}
                                onBlur={(e) => handleCellEdit(product.id, 'buying_price', parseFloat(e.target.value))}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Enter price"
                              />
                            </td>
                          )}

                          {/* Buying Quantity - Manual Entry Only */}
                          {visibleColumns.buyingquantity && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingquantity}px` }}>
                              <input
                                type="number"
                                defaultValue={product.buying_quantity || ''}
                                onBlur={(e) => handleCellEdit(product.id, 'buying_quantity', parseInt(e.target.value))}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Enter qty"
                              />
                            </td>
                          )}

                          {/* Seller Link - Manual Entry Only */}
                          {visibleColumns.sellerlink && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerlink}px` }}>
                              <input
                                type="text"
                                defaultValue={product.seller_link || ''}
                                onBlur={(e) => handleCellEdit(product.id, 'seller_link', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Enter link"
                              />
                            </td>
                          )}

                          {/* Seller Phone */}
                          {visibleColumns.sellerphno && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerphno}px` }}>
                              <input
                                type="text"
                                defaultValue={product.seller_phone || ""}
                                onBlur={(e) => handleCellEdit(product.id, 'seller_phone', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Phone"
                              />
                            </td>
                          )}

                          {/* Payment Method */}
                          {visibleColumns.paymentmethod && (
                            <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.paymentmethod}px` }}>
                              <input
                                type="text"
                                defaultValue={product.payment_method || ""}
                                onBlur={(e) => handleCellEdit(product.id, 'payment_method', e.target.value)}
                                className="w-full px-2 py-1 border rounded text-xs"
                                placeholder="Method"
                              />
                            </td>
                          )}

                          {/* Tracking Details */}
                          {visibleColumns.trackingdetails && (
                            <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.trackingdetails}px` }}>
                              {activeTab === 'order_confirmed' ? (
                                <input
                                  type="text"
                                  defaultValue={product.tracking_details || ""}
                                  onBlur={(e) => handleCellEdit(product.id, 'tracking_details', e.target.value)}
                                  className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                                  placeholder="Tracking #"
                                />
                              ) : (
                                <span className="text-xs text-gray-400 italic">After confirmation</span>
                              )}
                            </td>
                          )}

                          {/* Delivery Date */}
                          {visibleColumns.deliverydate && (
                            <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.deliverydate}px` }}>
                              {activeTab === 'order_confirmed' ? (
                                <input
                                  type="date"
                                  defaultValue={product.delivery_date || ""}
                                  onBlur={(e) => handleCellEdit(product.id, 'delivery_date', e.target.value)}
                                  className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                                />
                              ) : (
                                <span className="text-xs text-gray-400 italic">After confirmation</span>
                              )}
                            </td>
                          )}

                          {/* Move TO Buttons */}
                          <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.moveto}px` }}>
                            <div className="flex gap-1 justify-center">
                              {/* ✅ Add type="button" to prevent form submission */}
                              <button
                                type="button"
                                onClick={() => handleSendToAdmin(product)}
                                className="w-8 h-8 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center justify-center flex-shrink-0"
                                title="Done"
                              >
                                D
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePriceWait(product)}
                                className="w-8 h-8 bg-yellow-600 text-white text-xs font-bold rounded hover:bg-yellow-700 flex items-center justify-center flex-shrink-0"
                                title="Price Wait"
                              >
                                PW
                              </button>
                              <button
                                type="button"
                                onClick={() => handleNotFound(product)}
                                className="w-8 h-8 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 flex items-center justify-center flex-shrink-0"
                                title="Not Found"
                              >
                                NF
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })

                  )}
                </tbody>
              </table>
            </div>
            {/* Footer Stats - FIXED */}
            <div className="flex-none border-t bg-gray-50 px-4 py-3">
              <div className="text-sm text-gray-600">
                Showing {filteredProducts.length} of {products.length} products
                {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
