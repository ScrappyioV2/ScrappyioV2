'use client'

import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import PageTransition from '@/components/layout/PageTransition'
import { supabase } from '@/lib/supabaseClient'
import Toast from '@/components/Toast'
import { calculateProductValues, getDefaultConstants, CalculationConstants } from '@/lib/blackboxCalculations'

const formatUSD = (value: number | null) =>
  value !== null ? `$${value.toFixed(2)}` : ''

const formatINR = (value: number | null) =>
  value !== null
    ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : ''

const parseCurrency = (value: string) =>
  Number(value.replace(/[^0-9.]/g, '')) || null

// 1. UPDATE the ValidationProduct interface (around line 30)
interface ValidationProduct {
    id: string;
    asin: string;
    product_name: string | null;  // Changed from productname
    brand: string | null;
    seller_tag: string | null;    // Changed from sellertag
    funnel: string | null;
    no_of_seller: number | null;  // Changed from noofseller
    usa_link: string | null;      // Changed from usalink
    india_price: number | null;   // Changed from indiaprice
    product_weight: number | null; // Changed from productweight
    judgement: string | null;
    usd_price: number | null;     // Changed from usdprice
    inr_sold: number | null;      // Changed from inrsold
    inr_purchase: number | null;  // Changed from inrpurchase
    cargo_charge: number | null;  // Changed from cargocharge
    final_purchase_rate: number | null; // Changed from finalpurchaserate
    purchase_rate_inr: number | null;   // Changed from purchaserateinr
    status: string | null;
    origin_india: boolean | null;
    origin_china: boolean | null;
    check_brand: boolean | null;
    check_item_expire: boolean | null;
    check_small_size: boolean | null;
    check_multi_seller: boolean | null;
    sent_to_purchases?: boolean;
    sent_to_purchases_at?: string;
}

interface Stats {
    total: number
    passed: number
    failed: number
    pending: number
}

interface Filters {
  brand: string[]
  seller: string[]
  funnel: string[]
}

type FileTab = 'main_file' | 'pass_file' | 'fail_file' | 'pending'

export default function ValidationPage() {
    const [editingValue, setEditingValue] = useState<{
        id: string
        field: string
        value: string
    } | null>(null)
    const [activeTab, setActiveTab] = useState<FileTab>('main_file')
    const [products, setProducts] = useState<ValidationProduct[]>([])
    const [filteredProducts, setFilteredProducts] = useState<ValidationProduct[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
    const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, pending: 0 })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [filters, setFilters] = useState<Filters>({ seller_tag: '', brand: '', funnel: '' })
    const fileInputRef = useRef<HTMLInputElement>(null)
    const usaPriceCSVInputRef = useRef<HTMLInputElement>(null)


    // Constants Modal
    const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false)
    const [constants, setConstants] = useState<CalculationConstants>(getDefaultConstants())
    const [isSavingConstants, setIsSavingConstants] = useState(false)

    const [visibleColumns, setVisibleColumns] = useState({
        asin: true,
        product_name: true,
        brand: true,
        seller_tag: true,
        funnel: true,
        no_of_seller: true,
        usa_link: true,
        product_weight: true,
        usd_price: true,
        inr_sold: true,
        inr_purchase: true,
        india_price: true,
        judgement: true,
    })

    useEffect(() => {
        fetchProducts()
        fetchStats()
        fetchConstants()

        const channel = supabase
            .channel('validation-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_main_file' }, () => {
                fetchStats()
                fetchProducts()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_pass_file' }, () => fetchStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_fail_file' }, () => fetchStats())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [activeTab])

    useEffect(() => {
        applyFilters()
    }, [products, filters])

    const fetchConstants = async () => {
        try {
            const { data, error } = await supabase
                .from('usa_validation_constants')
                .select('*')
                .limit(1)
                .single()

            if (!error && data) {
                setConstants({
                    dollar_rate: data.dollar_rate,
                    card_conversion_rate: data.card_conversion_rate,
                    cargo_rate_per_kg: data.cargo_rate_per_kg,
                    commission_rate: data.commission_rate,
                    packing_cost: data.packing_cost
                })
            }
        } catch (err) {
            console.error('Error fetching constants:', err)
        }
    }

    const applyFilters = () => {
        let filtered = [...products]

        if (filters.seller_tag) {
            filtered = filtered.filter(p => p.seller_tag?.toLowerCase().includes(filters.seller_tag.toLowerCase()))
        }
        if (filters.brand) {
            filtered = filtered.filter(p => p.brand?.toLowerCase().includes(filters.brand.toLowerCase()))
        }
        if (filters.funnel) {
            filtered = filtered.filter(p => p.funnel?.toLowerCase().includes(filters.funnel.toLowerCase()))
        }

        setFilteredProducts(filtered)
    }

    const fetchStats = async () => {
        try {
            // Get all products from main file
            const { data: mainData, error } = await supabase
                .from('usa_validation_main_file')
                .select('judgement')

            if (error) {
                console.error('Stats fetch error:', error)
                return
            }

            const products = mainData || []

            // Count by judgement status
            const passed = products.filter(p => p.judgement === 'PASS').length
            const failed = products.filter(p => p.judgement === 'FAIL').length
            const pending = products.filter(p => !p.judgement || p.judgement === 'PENDING').length

            setStats({
                total: products.length, // Total in main file
                passed: passed,
                failed: failed,
                pending: pending
            })
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }


  const fetchProducts = async () => {
    setLoading(true)
    try {
      let tableName = ''
      if (activeTab === 'main_file') tableName = 'usa_validation_main_file'
      else if (activeTab === 'pass_file') tableName = 'usa_validation_pass_file'
      else if (activeTab === 'fail_file') tableName = 'usa_validation_fail_file'
      else if (activeTab === 'pending') {
        tableName = 'usa_validation_main_file'
      }

      let query = supabase.from(tableName).select('*')

      if (activeTab === 'pending') {
        query = query.is('judgement', null)
      }

      const { data, error } = await query

      if (error) throw error
      setProducts(data || [])

      // Extract unique values for filters
      const brands = [...new Set(data?.map((p) => p.brand).filter(Boolean))]
      const sellers = [...new Set(data?.map((p) => p.seller_tag).filter(Boolean))]
      const funnels = [...new Set(data?.map((p) => p.funnel).filter(Boolean))]

      setAvailableFilters({
        brand: brands as string[],
        seller: sellers as string[],
        funnel: funnels as string[]
      })
    } catch (error) {
      console.error('Error fetching products:', error)
      showToastMessage('Failed to load products', 'error')
    } finally {
      setLoading(false)
    }
  }


    const handleCellEdit = async (id: string, field: string, value: any) => {
        try {
            const tableName = `usa_validation_${activeTab}`

            // Update the field first
            const { error } = await supabase
                .from(tableName)
                .update({ [field]: value })
                .eq('id', id)

            if (error) {
                setToast({ message: 'Failed to update', type: 'error' })
                return
            }

            // Build latest product snapshot manually ✅
            const existingProduct = products.find(p => p.id === id)

            if (existingProduct && activeTab === 'main_file') {
                const latestProduct: ValidationProduct = {
                    ...existingProduct,
                    [field]: value, // 👈 force latest value
                }

                await autoCalculateAndUpdate(id, latestProduct)
            }


            setProducts(prev =>
                prev.map(p => p.id === id ? { ...p, [field]: value } : p)
            )

            setToast({ message: 'Updated successfully', type: 'success' })
        } catch (err) {
            console.error('Update error:', err)
            setToast({ message: 'Update failed', type: 'error' })
        }
    }

    const autoCalculateAndUpdate = async (id: string, product: ValidationProduct) => {
        // Calculate values
        const result = calculateProductValues({
            usd_price: product.usd_price,
            product_weight: product.product_weight,
            inr_sold: product.inr_sold,
            inr_purchase: product.inr_purchase
        }, constants)

        // Update product with calculated values
        const { error: updateError } = await supabase
            .from('usa_validation_main_file')
            .update({
                purchase_rate_inr: result.purchase_rate_inr,
                cargo_charge: result.cargo_charge,
                final_purchase_rate: result.final_purchase_rate,
                india_price: result.india_price,
                judgement: result.judgement
            })
            .eq('id', id)

        if (updateError) {
            console.error('Auto-calc error:', updateError)
            return
        }

        // If judgement is PASS or FAIL, copy to respective file
        if (result.judgement === 'PASS' || result.judgement === 'FAIL') {
            const { id: _, ...productWithoutId } = product

            const productData = {
                ...productWithoutId,
                purchase_rate_inr: result.purchase_rate_inr,
                cargo_charge: result.cargo_charge,
                final_purchase_rate: result.final_purchase_rate,
                india_price: result.india_price,
                judgement: result.judgement
            }

            const targetTable = result.judgement === 'PASS' ? 'usa_validation_pass_file' : 'usa_validation_fail_file'

            // Check if product already exists in target table
            const { data: existingData } = await supabase
                .from(targetTable)
                .select('id')
                .eq('asin', product.asin)
                .single()

            if (!existingData) {
                // Insert into target table
                await supabase.from(targetTable).insert([productData])
            } else {
                // Update existing record
                await supabase
                    .from(targetTable)
                    .update(productData)
                    .eq('asin', product.asin)
            }

            fetchStats()
        }
        setProducts(prev =>
            prev.map(p =>
                p.id === id
                    ? {
                        ...p,
                        purchase_rate_inr: result.purchase_rate_inr,
                        cargo_charge: result.cargo_charge,
                        final_purchase_rate: result.final_purchase_rate,
                        india_price: result.india_price,
                        judgement: result.judgement,
                    }
                    : p
            )
        )

    }

    const handleUploadCSV = () => {
        fileInputRef.current?.click()
    }

    const processCSVFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            const tableName = `usa_validation_${activeTab}`

            const { error } = await supabase
                .from(tableName)
                .insert(jsonData)

            if (error) {
                setToast({ message: `Upload failed: ${error.message}`, type: 'error' })
                return
            }

            setToast({ message: `Successfully uploaded ${jsonData.length} products!`, type: 'success' })
            fetchProducts()
            fetchStats()
        } catch (err) {
            console.error('CSV processing error:', err)
            setToast({ message: 'Failed to process CSV file', type: 'error' })
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleUSAPriceCSVUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0]
        if (!file) return

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rows = results.data as {
                        asin?: string
                        usd_price?: string
                    }[]

                    const updates = rows
                        .filter(r => r.asin && r.usd_price)
                        .map(r => ({
                            asin: r.asin!.trim(),
                            usd_price: Number(r.usd_price)
                        }))

                    if (updates.length === 0) {
                        setToast({ message: 'CSV has no valid ASIN / usd_price', type: 'warning' })
                        return
                    }

                    for (const row of updates) {
                        const { data } = await supabase
                            .from('usa_validation_main_file')
                            .select('*')
                            .eq('asin', row.asin)
                            .single()

                        if (data) {
                            await handleCellEdit(data.id, 'usd_price', row.usd_price)
                        }
                    }

                    setToast({ message: 'USA prices updated via CSV', type: 'success' })
                    fetchProducts()
                    fetchStats()
                } catch (err) {
                    console.error(err)
                    setToast({ message: 'USA price CSV update failed', type: 'error' })
                } finally {
                    e.target.value = ''
                }
            }
        })
    }


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)))
        } else {
            setSelectedIds(new Set())
        }
    }

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds)
        if (checked) {
            newSelected.add(id)
        } else {
            newSelected.delete(id)
        }
        setSelectedIds(newSelected)
    }
  }

  const handleOriginReset = async (productId: string) => {
    try {
      const tableName =
        activeTab === 'pass_file'
          ? 'usa_validation_pass_file'
          : activeTab === 'fail_file'
          ? 'usa_validation_fail_file'
          : 'usa_validation_main_file'

      const { error } = await supabase
        .from(tableName)
        .update({ origin_india: false, origin_china: false })
        .eq('id', productId)

      if (error) throw error
      await fetchProducts()
    } catch (error) {
      console.error('Error resetting origin:', error)
    }
  }

  const handleChecklistChange = async (
    productId: string,
    field: string,
    checked: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('usa_validation_pass_file')
        .update({ [field]: checked })
        .eq('id', productId)

      if (error) throw error
      await fetchProducts()
    } catch (error) {
      console.error('Error updating checklist:', error)
      showToastMessage('Failed to update checklist', 'error')
    }
  }

  const handleSendToPurchase = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      const { error: insertError } = await supabase.from('usa_purchases').insert({
        asin: product.asin,
        product_name: product.product_name,
        brand: product.brand,
        seller_tag: product.seller_tag,
        funnel: product.funnel,
        no_of_seller: product.no_of_seller,
        usa_link: product.usa_link,
        india_price: product.india_price,
        product_weight: product.product_weight,
        usd_price: product.usd_price,
        inr_sold: product.inr_sold,
        inr_purchase: product.inr_purchase,
        origin_india: product.origin_india,
        origin_china: product.origin_china
      })

      if (insertError) throw insertError

      const { error: deleteError } = await supabase
        .from('usa_validation_pass_file')
        .delete()
        .eq('id', productId)

      if (deleteError) throw deleteError

      showToastMessage('Sent to Purchase Department!', 'success')
      await fetchProducts()
      await fetchCounts()
    } catch (error) {
      console.error('Error sending to purchase:', error)
      showToastMessage('Failed to send to purchase', 'error')
    }
  }

  // ============================================
  // CSV UPLOAD
  // ============================================

  const handleUSAPriceCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const data = results.data as any[]
        let updatedCount = 0

        for (const row of data) {
          const asin = row.ASIN || row.asin
          const usdPrice = parseFloat(row['USD Price'] || row.usd_price)

          if (!asin || isNaN(usdPrice)) continue

          try {
            const { error } = await supabase
              .from('usa_validation_main_file')
              .update({ usd_price: usdPrice })
              .eq('asin', asin)

            if (!error) updatedCount++
          } catch (error) {
            console.error(`Error updating ${asin}:`, error)
          }
        }

        showToastMessage(
          `Updated ${updatedCount} products with USA prices`,
          'success'
        )
        await fetchProducts()
      },
      error: (error) => {
        console.error('CSV parse error:', error)
        showToastMessage('Failed to parse CSV file', 'error')
      }
    })

    e.target.value = ''
  }

  // ============================================
  // HELPERS
  // ============================================

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  // ✅ ADDED: Search, Pagination and Helper Functions
  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.asin?.toLowerCase().includes(query) ||
      p.product_name?.toLowerCase().includes(query) ||
      p.brand?.toLowerCase().includes(query) ||
      p.seller_tag?.toLowerCase().includes(query)
    )
  })

  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + rowsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const getSellerTagColor = (tag: string | null) => {
    if (!tag) return 'bg-gray-100 text-gray-800'
    if (tag.includes('Golden Aura')) return 'bg-yellow-100 text-yellow-800'
    if (tag.includes('Rudra Retail')) return 'bg-blue-100 text-blue-800'
    if (tag.includes('UBeauty')) return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-[1800px] mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              USA Selling - Validation
            </h1>
            <p className="text-gray-600 mt-1">
              Manage validation files and product status
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700 text-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium opacity-90">Total Products</div>
              <div className="text-4xl font-bold mt-2">{counts.total}</div>
            </div>
            <div className="bg-green-600 text-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium opacity-90">✓ Passed</div>
              <div className="text-4xl font-bold mt-2">{counts.passed}</div>
            </div>
            <div className="bg-red-600 text-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium opacity-90">✗ Failed</div>
              <div className="text-4xl font-bold mt-2">{counts.failed}</div>
            </div>
            <div className="bg-orange-500 text-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium opacity-90">⚠ Pending</div>
              <div className="text-4xl font-bold mt-2">{counts.pending}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('main_file')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === 'main_file'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Main File
            </button>
            <button
              onClick={() => setActiveTab('pass_file')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === 'pass_file'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Pass File
            </button>
            <button
              onClick={() => setActiveTab('fail_file')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === 'fail_file'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Failed File
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === 'pending'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Pending
            </button>
          </div>

          {/* Action Buttons and Search */}
          <div className="bg-white p-4 rounded-lg shadow mb-6 flex justify-between items-center gap-4">
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2">
                <span>▼</span> Add Filter
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <span>↓</span> Download CSV
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <span>↑</span> Upload CSV
              </button>
              <button
                onClick={() => usaPriceCSVInputRef.current?.click()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Bulk USA Price Update
              </button>
              <button
                onClick={() => setShowConstantsModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <span>⚙</span> Configure Constants
              </button>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            accept=".csv"
            ref={usaPriceCSVInputRef}
            onChange={handleUSAPriceCSVUpload}
            className="hidden"
          />

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow-lg flex-1 flex flex-col min-h-0">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                                    <p className="mt-2 text-gray-600">Loading products...</p>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <p className="text-lg">No products found in {
                                        activeTab === 'main_file' ? 'Main File' :
                                            activeTab === 'pass_file' ? 'Pass File' :
                                                activeTab === 'fail_file' ? 'Failed File' :
                                                    'Pending'
                                    }</p>
                                    <p className="text-sm mt-2">
                                        {activeTab === 'pending'
                                            ? 'Products with incomplete data will appear here'
                                            : activeTab === 'pass_file'
                                                ? 'Products with PASS judgement will appear here'

                                                : activeTab === 'fail_file'
                                                    ? 'Products with FAIL judgement will appear here'
                                                    : 'All products will appear here'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                    <div className="overflow-auto max-w-full">
                                        <table className="min-w-[1400px] w-full">
                                            <thead className="bg-gray-100 border-b-2 border-gray-30 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-3 text-left">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                selectedIds.size === filteredProducts.length &&
                                                                filteredProducts.length > 0
                                                            }
                                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                                            className="rounded"
                                                        />
                                                    </th>

                                                    {visibleColumns.asin && <th className="p-3">ASIN</th>}
                                                    {visibleColumns.product_name && <th className="p-3">Product Name</th>}
                                                    {visibleColumns.brand && <th className="p-3">Brand</th>}
                                                    {visibleColumns.seller_tag && <th className="p-3">Seller Tag</th>}
                                                    {visibleColumns.funnel && <th className="p-3">Funnel</th>}
                                                    {visibleColumns.no_of_seller && <th className="p-3">No. OF seller</th>}
                                                    {visibleColumns.usa_link && <th className="p-3">USA Link</th>}

                                                    {/* ORIGIN — after USA Link */}
                                                    {activeTab === 'pass_file' && (
                                                        <th className="p-3">Origin</th>
                                                    )}

                                                    {visibleColumns.product_weight && <th className="p-3">Weight (g)</th>}
                                                    {visibleColumns.usd_price && <th className="p-3">USD Price</th>}
                                                    {visibleColumns.inr_sold && <th className="p-3">INR Sold</th>}
                                                    {visibleColumns.inr_purchase && <th className="p-3">INR Purchase</th>}
                                                    {visibleColumns.india_price && <th className="p-3">India Price</th>}

                                                    {/* CHECKLIST — before Judgement */}
                                                    {activeTab === 'pass_file' && (
                                                        <th className="p-3">Checklist</th>
                                                    )}

                                                    {visibleColumns.judgement && <th className="p-3">Judgement</th>}
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {filteredProducts.map((product, index) => (
                                                    <tr
                                                        key={product.id}
                                                        className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                                            }`}
                                                    >
                                                        {/* Select */}
                                                        <td className="p-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(product.id)}
                                                                onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                                className="rounded"
                                                            />
                                                        </td>

                          {visibleColumns.asin && (
                            <td className="px-4 py-3 font-mono text-sm">
                              {product.asin}
                            </td>
                          )}

                          {visibleColumns.product_name && (
                            <td className="px-4 py-3 max-w-xs truncate">
                              {product.product_name || '-'}
                            </td>
                          )}

                          {visibleColumns.brand && (
                            <td className="px-4 py-3">{product.brand || '-'}</td>
                          )}

                          {visibleColumns.seller_tag && (
                            <td className="px-4 py-3">
                              {product.seller_tag ? (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${getSellerTagColor(
                                    product.seller_tag
                                  )}`}
                                >
                                  {product.seller_tag}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          )}

                          {visibleColumns.funnel && (
                            <td className="px-4 py-3">{product.funnel || '-'}</td>
                          )}

                          {visibleColumns.no_of_seller && (
                            <td className="px-4 py-3 text-center">
                              {product.no_of_seller || '-'}
                            </td>
                          )}

                          {visibleColumns.usa_link && (
                            <td className="px-4 py-3">
                              {product.usa_link ? (
                                <a
                                  href={product.usa_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                          )}

                          {/* Origin Column (NOT in Main File) */}
                          {activeTab !== 'main_file' && (
                            <td className="px-4 py-3">
                              {product.origin_india ? (
                                <button
                                  onClick={() => handleOriginReset(product.id)}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-semibold hover:bg-yellow-600"
                                >
                                  IND
                                </button>
                              ) : product.origin_china ? (
                                <button
                                  onClick={() => handleOriginReset(product.id)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs font-semibold hover:bg-blue-600"
                                >
                                  CH
                                </button>
                              ) : (
                                <div className="flex gap-1">
                                  <input
                                    type="checkbox"
                                    id={`india-${product.id}`}
                                    onChange={() =>
                                      handleOriginChange(product.id, 'india')
                                    }
                                    className="rounded"
                                  />
                                  <label
                                    htmlFor={`india-${product.id}`}
                                    className="text-xs mr-2"
                                  >
                                    India
                                  </label>
                                  <input
                                    type="checkbox"
                                    id={`china-${product.id}`}
                                    onChange={() =>
                                      handleOriginChange(product.id, 'china')
                                    }
                                    className="rounded"
                                  />
                                  <label
                                    htmlFor={`china-${product.id}`}
                                    className="text-xs"
                                  >
                                    China
                                  </label>
                                </div>
                              )}
                            </td>
                          )}

                          {/* Weight - Editable in Main/Failed/Pending */}
                          {visibleColumns.product_weight && (
                            <td className="px-4 py-3">
                              {activeTab === 'main_file' ||
                              activeTab === 'fail_file' ||
                              activeTab === 'pending' ? (
                                <input
                                  type="number"
                                  value={product.product_weight ?? ''}
                                  onChange={(e) =>
                                    handleCellEdit(
                                      product.id,
                                      'product_weight',
                                      Number(e.target.value) || null
                                    )
                                  }
                                  className="w-20 px-2 py-1 border rounded"
                                />
                              ) : (
                                product.product_weight ?? '-'
                              )}
                            </td>
                          )}

                                                        {visibleColumns.usd_price && (
                                                            <td className="p-3">
                                                                {activeTab === 'main_file' ? (
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editingValue?.id === product.id &&
                                                                                editingValue.field === 'usd_price'
                                                                                ? editingValue.value
                                                                                : formatUSD(product.usd_price)
                                                                        }
                                                                        onFocus={() =>
                                                                            setEditingValue({
                                                                                id: product.id,
                                                                                field: 'usd_price',
                                                                                value: product.usd_price?.toString() || ''
                                                                            })
                                                                        }
                                                                        onChange={(e) =>
                                                                            setEditingValue({
                                                                                id: product.id,
                                                                                field: 'usd_price',
                                                                                value: e.target.value
                                                                            })
                                                                        }
                                                                        onBlur={() => {
                                                                            const parsed = parseCurrency(editingValue?.value || '')
                                                                            handleCellEdit(product.id, 'usd_price', parsed)
                                                                            setEditingValue(null)
                                                                        }}
                                                                        className="w-28 px-2 py-1 border rounded"
                                                                    />
                                                                ) : (
                                                                    formatUSD(product.usd_price)
                                                                )}
                                                            </td>
                                                        )}

                                                        {visibleColumns.inr_sold && (
                                                            <td className="p-3">
                                                                {activeTab === 'main_file' ? (
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editingValue?.id === product.id &&
                                                                                editingValue.field === 'inr_sold'
                                                                                ? editingValue.value
                                                                                : formatINR(product.inr_sold)
                                                                        }
                                                                        onFocus={() =>
                                                                            setEditingValue({
                                                                                id: product.id,
                                                                                field: 'inr_sold',
                                                                                value: product.inr_sold?.toString() || ''
                                                                            })
                                                                        }
                                                                        onChange={(e) =>
                                                                            setEditingValue({
                                                                                id: product.id,
                                                                                field: 'inr_sold',
                                                                                value: e.target.value
                                                                            })
                                                                        }
                                                                        onBlur={() => {
                                                                            const parsed = parseCurrency(editingValue?.value || '')
                                                                            handleCellEdit(product.id, 'inr_sold', parsed)
                                                                            setEditingValue(null)
                                                                        }}
                                                                        className="w-32 px-2 py-1 border rounded"
                                                                    />
                                                                ) : (
                                                                    formatINR(product.inr_sold)
                                                                )}
                                                            </td>
                                                        )}

                          {/* INR Purchase - Editable in Main/Failed/Pending */}
                          {visibleColumns.inr_purchase && (
                            <td className="px-4 py-3">
                              {activeTab === 'main_file' ||
                              activeTab === 'fail_file' ||
                              activeTab === 'pending' ? (
                                <input
                                  type="text"
                                  value={
                                    editingValue?.id === product.id &&
                                    editingValue?.field === 'inr_purchase'
                                      ? editingValue.value
                                      : product.inr_purchase?.toString() || ''
                                  }
                                  onFocus={() =>
                                    setEditingValue({
                                      id: product.id,
                                      field: 'inr_purchase',
                                      value: product.inr_purchase?.toString() || ''
                                    })
                                  }
                                  onChange={(e) =>
                                    setEditingValue({
                                      id: product.id,
                                      field: 'inr_purchase',
                                      value: e.target.value
                                    })
                                  }
                                  onBlur={() => {
                                    const parsed = parseCurrency(
                                      editingValue?.value || ''
                                    )
                                    handleCellEdit(product.id, 'inr_purchase', parsed)
                                    setEditingValue(null)
                                  }}
                                  className="w-32 px-2 py-1 border rounded"
                                />
                              ) : (
                                formatINR(product.inr_purchase)
                              )}
                            </td>
                          )}

                                                        {visibleColumns.india_price && (
                                                            <td className="p-3 font-semibold">
                                                                {formatINR(product.india_price)}
                                                            </td>
                                                        )}

                                                        {/* CHECKLIST */}
                                                        {activeTab === 'pass_file' && (
                                                            <td className="p-3">
                                                                {product.check_brand &&
                                                                    product.check_item_expire &&
                                                                    product.check_small_size &&
                                                                    product.check_multi_seller ? (
                                                                    <button
                                                                        onClick={() => handleChecklistOk(product.id)}
                                                                        className="px-4 py-1.5 bg-green-600 text-white rounded-lg"
                                                                    >
                                                                        OK
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1 text-sm">
                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!product.check_brand}
                                                                                onChange={(e) =>
                                                                                    handleChecklistToggle(product.id, 'check_brand', e.target.checked)
                                                                                }
                                                                            /> Brand
                                                                        </label>
                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!product.check_item_expire}
                                                                                onChange={(e) =>
                                                                                    handleChecklistToggle(product.id, 'check_item_expire', e.target.checked)
                                                                                }
                                                                            /> Expire
                                                                        </label>
                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!product.check_small_size}
                                                                                onChange={(e) =>
                                                                                    handleChecklistToggle(product.id, 'check_small_size', e.target.checked)
                                                                                }
                                                                            /> Size
                                                                        </label>
                                                                        <label>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!product.check_multi_seller}
                                                                                onChange={(e) =>
                                                                                    handleChecklistToggle(product.id, 'check_multi_seller', e.target.checked)
                                                                                }
                                                                            /> Sellers
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}

                                                        {visibleColumns.judgement && (
                                                            <td className="p-3">
                                                                {product.judgement ? (
                                                                    <span
                                                                        className={`px-3 py-1 rounded-full text-xs font-bold ${product.judgement === 'PASS'
                                                                            ? 'bg-green-500 text-white'
                                                                            : product.judgement === 'FAIL'
                                                                                ? 'bg-red-500 text-white'
                                                                                : 'bg-gray-400 text-white'
                                                                            }`}
                                                                    >
                                                                        {product.judgement}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-400 text-sm">Auto-calculating...</span>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <span className="px-4 py-2 text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

                                {/* Constants Form */}
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Dollar Rate (₹)</label>
                                            <input
                                                type="number"
                                                value={constants.dollar_rate}
                                                onChange={(e) => setConstants({ ...constants, dollar_rate: parseFloat(e.target.value) || 82 })}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                step="0.01"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Card Conversion Rate (%)</label>
                                            <input
                                                type="number"
                                                value={constants.card_conversion_rate * 100}
                                                onChange={(e) => setConstants({ ...constants, card_conversion_rate: (parseFloat(e.target.value) || 2) / 100 })}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                step="0.01"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Cargo Rate per KG (₹)</label>
                                            <input
                                                type="number"
                                                value={constants.cargo_rate_per_kg}
                                                onChange={(e) => setConstants({ ...constants, cargo_rate_per_kg: parseFloat(e.target.value) || 950 })}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                step="0.01"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Commission Rate (%)</label>
                                            <input
                                                type="number"
                                                value={constants.commission_rate * 100}
                                                onChange={(e) => setConstants({ ...constants, commission_rate: (parseFloat(e.target.value) || 25) / 100 })}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Packing Cost (₹)</label>
                                            <input
                                                type="number"
                                                value={constants.packing_cost}
                                                onChange={(e) => setConstants({ ...constants, packing_cost: parseFloat(e.target.value) || 10 })}
                                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-sm text-blue-800">
                                            <strong>Note:</strong> After saving, all products in Main File with complete data will be automatically recalculated.
                                        </p>
                                    </div>
                                </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConstantsModal(false)}
                  className="flex-1 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveConstants}
                  className="flex-1 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-gray-100 font-semibold flex items-center justify-center gap-2"
                >
                  <span>✓</span> Save & Recalculate
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Toast */}
        {toast.show && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast({ ...toast, show: false })}
          />
        )}
      </div>
    </PageTransition>
  )
}
