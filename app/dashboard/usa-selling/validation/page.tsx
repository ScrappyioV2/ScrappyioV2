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

interface ValidationProduct {
  id: string
  asin: string
  product_name: string | null
  brand: string | null
  seller_tag: string | null
  funnel: string | null
  no_of_seller: number | null
  usa_link: string | null
  india_price: number | null
  product_weight: number | null
  judgement: string | null
  usd_price: number | null
  inr_sold: number | null
  inr_purchase: number | null
  cargo_charge: number | null
  final_purchase_rate: number | null
  purchase_rate_inr: number | null
  status: string | null
  origin_india: boolean | null
  origin_china: boolean | null
  check_brand: boolean | null
  check_item_expire: boolean | null
  check_small_size: boolean | null
  check_multi_seller: boolean | null
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
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  
  // ✅ ADDED: Search and Pagination States
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 50

  // Toast
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: 'success' | 'error'
  }>({
    show: false,
    message: '',
    type: 'success'
  })

  // Stats
  const [counts, setCounts] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    pending: 0
  })

  // Modals
  const [showConstantsModal, setShowConstantsModal] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)

  // Calculation Constants
  const [constants, setConstants] = useState<CalculationConstants>(
    getDefaultConstants()
  )

  // Filters
  const [filters, setFilters] = useState<Filters>({
    brand: [],
    seller: [],
    funnel: []
  })
  const [availableFilters, setAvailableFilters] = useState<Filters>({
    brand: [],
    seller: [],
    funnel: []
  })

  // Column Visibility
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
    judgement: true
  })

  // CSV Upload
  const usaPriceCSVInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // FETCH DATA
  // ============================================

  useEffect(() => {
    fetchProducts()
    fetchCounts()
    loadConstants()
  }, [activeTab])

  const loadConstants = () => {
    const saved = localStorage.getItem('validationConstants')
    if (saved) {
      setConstants(JSON.parse(saved))
    }
  }

  const saveConstants = async () => {
    localStorage.setItem('validationConstants', JSON.stringify(constants))
    await recalculateAllProducts()
    setShowConstantsModal(false)
    showToastMessage('Constants updated and products recalculated!', 'success')
  }

  const fetchCounts = async () => {
    try {
      const [mainCount, passCount, failCount] = await Promise.all([
        supabase
          .from('usa_validation_main_file')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('usa_validation_pass_file')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('usa_validation_fail_file')
          .select('id', { count: 'exact', head: true })
      ])

      const pendingCount = await supabase
        .from('usa_validation_main_file')
        .select('id', { count: 'exact', head: true })
        .is('judgement', null)

      setCounts({
        total: mainCount.count || 0,
        passed: passCount.count || 0,
        failed: failCount.count || 0,
        pending: pendingCount.count || 0
      })
    } catch (error) {
      console.error('Error fetching counts:', error)
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

  // ============================================
  // CALCULATIONS
  // ============================================

  const calculateJudgement = (product: ValidationProduct): string | null => {
    const { usd_price, inr_sold, inr_purchase, product_weight } = product

    if (!usd_price || !inr_sold || !inr_purchase || !product_weight) {
      return null
    }

    const { dollar_rate, card_conversion_rate, cargo_rate_per_kg, commission_rate, packing_cost } = constants

    const usdWithCard = usd_price * (1 + card_conversion_rate)
const inrBuying = usdWithCard * dollar_rate
const cargoCharge = (cargo_rate_per_kg / 1000) * product_weight
const commission = commission_rate * inr_sold
const totalCost = inrBuying + cargoCharge + commission + packing_cost


    const profitMargin = ((inr_sold - totalCost) / inr_sold) * 100

    return profitMargin >= 15 ? 'pass' : 'fail'
  }

  const recalculateAllProducts = async () => {
    try {
      const { data: mainProducts, error } = await supabase
        .from('usa_validation_main_file')
        .select('*')

      if (error) throw error

      for (const product of mainProducts || []) {
        const newJudgement = calculateJudgement(product)

        if (newJudgement) {
          await supabase
            .from('usa_validation_main_file')
            .update({ judgement: newJudgement })
            .eq('id', product.id)

          if (newJudgement === 'pass') {
            await moveToPassFile(product)
          } else if (newJudgement === 'fail') {
            await moveToFailFile(product)
          }
        }
      }

      await fetchProducts()
      await fetchCounts()
    } catch (error) {
      console.error('Error recalculating:', error)
    }
  }

  // ============================================
  // MOVE PRODUCTS
  // ============================================

  const moveToPassFile = async (product: ValidationProduct) => {
    try {
      const { error: insertError } = await supabase
        .from('usa_validation_pass_file')
        .insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          seller_tag: product.seller_tag,
          funnel: product.funnel,
          no_of_seller: product.no_of_seller,
          usa_link: product.usa_link,
          india_price: product.india_price,
          product_weight: product.product_weight,
          judgement: product.judgement,
          usd_price: product.usd_price,
          inr_sold: product.inr_sold,
          inr_purchase: product.inr_purchase,
          origin_india: product.origin_india || false,
          origin_china: product.origin_china || false
        })

      if (insertError) throw insertError

      const tableName = activeTab === 'main_file' ? 'usa_validation_main_file' : 'usa_validation_fail_file'

      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', product.id)

      if (deleteError) throw deleteError
    } catch (error) {
      console.error('Error moving to pass file:', error)
      throw error
    }
  }

  const moveToFailFile = async (product: ValidationProduct) => {
    try {
      const { error: insertError } = await supabase
        .from('usa_validation_fail_file')
        .insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          seller_tag: product.seller_tag,
          funnel: product.funnel,
          no_of_seller: product.no_of_seller,
          usa_link: product.usa_link,
          india_price: product.india_price,
          product_weight: product.product_weight,
          judgement: product.judgement,
          usd_price: product.usd_price,
          inr_sold: product.inr_sold,
          inr_purchase: product.inr_purchase,
          origin_india: product.origin_india || false,
          origin_china: product.origin_china || false
        })

      if (insertError) throw insertError

      const { error: deleteError } = await supabase
        .from('usa_validation_main_file')
        .delete()
        .eq('id', product.id)

      if (deleteError) throw deleteError
    } catch (error) {
      console.error('Error moving to fail file:', error)
      throw error
    }
  }

  // ============================================
  // EDIT HANDLERS
  // ============================================

  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      const tableName =
        activeTab === 'main_file'
          ? 'usa_validation_main_file'
          : activeTab === 'fail_file'
          ? 'usa_validation_fail_file'
          : 'usa_validation_main_file'

      const { error } = await supabase
        .from(tableName)
        .update({ [field]: value })
        .eq('id', id)

      if (error) throw error

      const product = products.find((p) => p.id === id)
      if (product) {
        const updatedProduct = { ...product, [field]: value }
        const newJudgement = calculateJudgement(updatedProduct)

        if (newJudgement) {
          await supabase
            .from(tableName)
            .update({ judgement: newJudgement })
            .eq('id', id)

          if (activeTab === 'fail_file' && newJudgement === 'pass') {
            await moveToPassFile({ ...updatedProduct, judgement: newJudgement })
            showToastMessage('Product moved to Pass File!', 'success')
            await fetchProducts()
            await fetchCounts()
            return
          }
        }
      }

      await fetchProducts()
      showToastMessage('Updated successfully!', 'success')
    } catch (error) {
      console.error('Error updating cell:', error)
      showToastMessage('Failed to update', 'error')
    }
  }

  // ✅ ADDED: Origin Handlers
  const handleOriginChange = async (productId: string, origin: 'india' | 'china') => {
    try {
      const tableName =
        activeTab === 'pass_file'
          ? 'usa_validation_pass_file'
          : activeTab === 'fail_file'
          ? 'usa_validation_fail_file'
          : 'usa_validation_main_file'

      const updates = {
        origin_india: origin === 'india',
        origin_china: origin === 'china'
      }

      const { error } = await supabase.from(tableName).update(updates).eq('id', productId)

      if (error) throw error
      await fetchProducts()
    } catch (error) {
      console.error('Error updating origin:', error)
      showToastMessage('Failed to update origin', 'error')
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading products...</p>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 text-lg">
                  No products found in{' '}
                  {activeTab === 'main_file'
                    ? 'Main File'
                    : activeTab === 'pass_file'
                    ? 'Pass File'
                    : activeTab === 'fail_file'
                    ? 'Failed File'
                    : 'Pending'}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {activeTab === 'pending'
                    ? 'Products with incomplete data will appear here'
                    : activeTab === 'pass_file'
                    ? 'Products with PASS judgement will appear here'
                    : activeTab === 'fail_file'
                    ? 'Products with FAIL judgement will appear here'
                    : 'All products will appear here'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={
                              selectedIds.size === paginatedProducts.length &&
                              paginatedProducts.length > 0
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="rounded"
                          />
                        </th>
                        {visibleColumns.asin && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            ASIN
                          </th>
                        )}
                        {visibleColumns.product_name && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Product Name
                          </th>
                        )}
                        {visibleColumns.brand && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Brand
                          </th>
                        )}
                        {visibleColumns.seller_tag && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Seller Tag
                          </th>
                        )}
                        {visibleColumns.funnel && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Funnel
                          </th>
                        )}
                        {visibleColumns.no_of_seller && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            No. OF seller
                          </th>
                        )}
                        {visibleColumns.usa_link && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            USA Link
                          </th>
                        )}
                        {activeTab !== 'main_file' && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Origin
                          </th>
                        )}
                        {visibleColumns.product_weight && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Weight (g)
                          </th>
                        )}
                        {visibleColumns.usd_price && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            USD Price
                          </th>
                        )}
                        {visibleColumns.inr_sold && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            INR Sold
                          </th>
                        )}
                        {visibleColumns.inr_purchase && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            INR Purchase
                          </th>
                        )}
                        {visibleColumns.india_price && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            India Price
                          </th>
                        )}
                        {activeTab === 'pass_file' && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Checklist
                          </th>
                        )}
                        {visibleColumns.judgement && (
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">
                            Judgement
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((product) => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(product.id)}
                              onChange={(e) =>
                                handleSelectRow(product.id, e.target.checked)
                              }
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

                          {/* USD Price - Editable in Main/Failed/Pending */}
                          {visibleColumns.usd_price && (
                            <td className="px-4 py-3">
                              {activeTab === 'main_file' ||
                              activeTab === 'fail_file' ||
                              activeTab === 'pending' ? (
                                <input
                                  type="text"
                                  value={
                                    editingValue?.id === product.id &&
                                    editingValue?.field === 'usd_price'
                                      ? editingValue.value
                                      : product.usd_price?.toString() || ''
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
                                    const parsed = parseCurrency(
                                      editingValue?.value || ''
                                    )
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

                          {/* INR Sold - Editable in Main/Failed/Pending */}
                          {visibleColumns.inr_sold && (
                            <td className="px-4 py-3">
                              {activeTab === 'main_file' ||
                              activeTab === 'fail_file' ||
                              activeTab === 'pending' ? (
                                <input
                                  type="text"
                                  value={
                                    editingValue?.id === product.id &&
                                    editingValue?.field === 'inr_sold'
                                      ? editingValue.value
                                      : product.inr_sold?.toString() || ''
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
                                    const parsed = parseCurrency(
                                      editingValue?.value || ''
                                    )
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
                            <td className="px-4 py-3">
                              {formatINR(product.india_price)}
                            </td>
                          )}

                          {/* Checklist - Only in Pass File */}
                          {activeTab === 'pass_file' && (
                            <td className="px-4 py-3">
                              {product.check_brand &&
                              product.check_item_expire &&
                              product.check_small_size &&
                              product.check_multi_seller ? (
                                <button
                                  onClick={() => handleSendToPurchase(product.id)}
                                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold"
                                >
                                  OK
                                </button>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={product.check_brand || false}
                                      onChange={(e) =>
                                        handleChecklistChange(
                                          product.id,
                                          'check_brand',
                                          e.target.checked
                                        )
                                      }
                                      className="rounded"
                                    />
                                    Brand
                                  </label>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={product.check_item_expire || false}
                                      onChange={(e) =>
                                        handleChecklistChange(
                                          product.id,
                                          'check_item_expire',
                                          e.target.checked
                                        )
                                      }
                                      className="rounded"
                                    />
                                    Expire
                                  </label>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={product.check_small_size || false}
                                      onChange={(e) =>
                                        handleChecklistChange(
                                          product.id,
                                          'check_small_size',
                                          e.target.checked
                                        )
                                      }
                                      className="rounded"
                                    />
                                    Size
                                  </label>
                                  <label className="flex items-center gap-1 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={product.check_multi_seller || false}
                                      onChange={(e) =>
                                        handleChecklistChange(
                                          product.id,
                                          'check_multi_seller',
                                          e.target.checked
                                        )
                                      }
                                      className="rounded"
                                    />
                                    Sellers
                                  </label>
                                </div>
                              )}
                            </td>
                          )}

                          {visibleColumns.judgement && (
                            <td className="px-4 py-3">
                              {product.judgement ? (
                                <span
                                  className={`px-3 py-1 rounded text-xs font-semibold ${
                                    product.judgement === 'pass'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {product.judgement.toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs italic">
                                  Auto-calculating...
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {startIndex + 1}-
                    {Math.min(startIndex + rowsPerPage, filteredProducts.length)} of{' '}
                    {filteredProducts.length} products
                    {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
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

        {/* Configure Constants Modal */}
        {showConstantsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-purple-600 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-white mb-2">
                Calculation Constants Configuration
              </h2>
              <p className="text-purple-100 text-sm mb-6">
                Update global constants for automatic calculations
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1">
                      Dollar Rate (₹)
                    </label>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1">
                      Card Conversion Rate (%)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white text-sm font-medium mb-1">
                      Cargo Rate per KG (₹)
                    </label>
                  </div>

                  <div>
                    <label className="block text-white text-sm font-medium mb-1">
                      Commission Rate (%)
                    </label>
                  
                  </div>
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-1">
                    Packing Cost (₹)
                  </label>
                </div>

                <div className="bg-purple-700 rounded p-3">
                  <p className="text-purple-100 text-sm">
                    <strong>Note:</strong> After saving, all products in Main File
                    with complete data will be automatically recalculated.
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
