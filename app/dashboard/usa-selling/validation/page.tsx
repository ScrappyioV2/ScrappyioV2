'use client'

import { useState, useEffect, useRef } from 'react'
import PageTransition from '@/components/layout/PageTransition'
import { supabase } from '@/lib/supabaseClient'
import Toast from '@/components/Toast'
import * as XLSX from 'xlsx'
import { calculateProductValues, getDefaultConstants, CalculationConstants } from '@/lib/blackboxCalculations'

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
}

interface Stats {
    total: number
    passed: number
    failed: number
    pending: number
}

interface Filters {
    seller_tag: string
    brand: string
    funnel: string
}

type FileTab = 'main_file' | 'pass_file' | 'faild_file' | 'pending'

export default function ValidationPage() {
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_failed_file' }, () => fetchStats())
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
            // Always fetch from main_file, but filter based on activeTab
            const { data, error } = await supabase
                .from('usa_validation_main_file')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching products:', error)
                setProducts([])
            } else {
                // Filter based on active tab
                let filteredData = data || []

                if (activeTab === 'pass_file') {
                    // Show only PASS judgement products
                    filteredData = filteredData.filter(p => p.judgement === 'PASS')
                } else if (activeTab === 'faild_file') {
                    // Show only FAIL judgement products
                    filteredData = filteredData.filter(p => p.judgement === 'FAIL')
                } else if (activeTab === 'pending') {
                    // Show only PENDING/NULL judgement products
                    filteredData = filteredData.filter(p => !p.judgement || p.judgement === 'PENDING')
                }
                // else main_file shows all products

                setProducts(filteredData)
            }
        } catch (err) {
            console.error('Fetch error:', err)
            setProducts([])
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

            // Get updated product
            const updatedProduct = products.find(p => p.id === id)
            if (updatedProduct) {
                const updatedProductData = { ...updatedProduct, [field]: value }

                // Auto-calculate if all required fields are present
                if (activeTab === 'main_file') {
                    await autoCalculateAndUpdate(id, updatedProductData)
                }
            }

            setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
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

            const targetTable = result.judgement === 'PASS' ? 'usa_validation_pass_file' : 'usa_validation_failed_file'

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

    const downloadCSV = () => {
        if (filteredProducts.length === 0) {
            setToast({ message: 'No data to download', type: 'warning' })
            return
        }

        const headers = Object.keys(visibleColumns).filter(col => visibleColumns[col as keyof typeof visibleColumns])
        const csvContent = [
            headers.join(','),
            ...filteredProducts.map(product =>
                headers.map(header => {
                    const value = product[header as keyof ValidationProduct]
                    return value ? `"${value}"` : ''
                }).join(',')
            )
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `validation_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)

        setToast({ message: 'CSV downloaded successfully!', type: 'success' })
    }

    const bulkUSAPriceUpdate = async () => {
        setToast({ message: 'Bulk USA Price Update feature coming soon with Keepa API!', type: 'info' })
    }

    const openConstantsModal = () => {
        setIsConstantsModalOpen(true)
    }

    const saveConstants = async () => {
        setIsSavingConstants(true)
        try {
            // Update constants in database
            const { data: existingData } = await supabase
                .from('usa_validation_constants')
                .select('id')
                .limit(1)
                .single()

            if (existingData) {
                await supabase
                    .from('usa_validation_constants')
                    .update(constants)
                    .eq('id', existingData.id)
            } else {
                await supabase
                    .from('usa_validation_constants')
                    .insert([constants])
            }

            setToast({ message: 'Constants saved successfully!', type: 'success' })
            setIsConstantsModalOpen(false)

            // Recalculate all products in main file
            await recalculateAllProducts()
        } catch (err) {
            console.error('Save constants error:', err)
            setToast({ message: 'Failed to save constants', type: 'error' })
        } finally {
            setIsSavingConstants(false)
        }
    }

    const recalculateAllProducts = async () => {
        if (activeTab !== 'main_file') return

        const productsToRecalc = products.filter(p =>
            p.usd_price && p.product_weight && p.inr_sold && p.inr_purchase
        )

        for (const product of productsToRecalc) {
            await autoCalculateAndUpdate(product.id, product)
        }

        setToast({ message: `Recalculated ${productsToRecalc.length} products`, type: 'info' })
        fetchProducts()
        fetchStats()
    }

    return (
        <PageTransition>
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-full mx-auto">
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">USA Selling - Validation</h1>
                        <p className="text-gray-600 mt-1">Manage validation files and product status</p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90">Total Products</div>
                            <div className="text-4xl font-bold mt-2">{stats.total}</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90">✓ Passed</div>
                            <div className="text-4xl font-bold mt-2">{stats.passed}</div>
                        </div>
                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90">✗ Failed</div>
                            <div className="text-4xl font-bold mt-2">{stats.failed}</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm font-medium opacity-90">⏳ Pending</div>
                            <div className="text-4xl font-bold mt-2">{stats.pending}</div>
                        </div>
                    </div>


                    {/* File Tabs */}
                    <div className="flex gap-3 mb-6">
                        <button
                            onClick={() => setActiveTab('main_file')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'main_file'
                                ? 'bg-slate-600 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Main File
                        </button>
                        <button
                            onClick={() => setActiveTab('pass_file')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'pass_file'
                                ? 'bg-green-500 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Pass File
                        </button>
                        <button
                            onClick={() => setActiveTab('faild_file')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'faild_file'
                                ? 'bg-red-500 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Failed File
                        </button>
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'pending'
                                ? 'bg-orange-500 text-white shadow-lg'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            Pending
                        </button>
                    </div>


                    {/* Action Buttons */}
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-3">
                                {/* Filter Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                        Add Filter
                                    </button>
                                    {isFilterOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsFilterOpen(false)}
                                            />
                                            <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-xl p-4 z-20 w-72">
                                                <h3 className="font-semibold text-gray-900 mb-3">Filter Products</h3>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Seller Tag</label>
                                                        <input
                                                            type="text"
                                                            value={filters.seller_tag}
                                                            onChange={(e) => setFilters({ ...filters, seller_tag: e.target.value })}
                                                            className="w-full px-3 py-2 border rounded-lg"
                                                            placeholder="Enter seller name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                                                        <input
                                                            type="text"
                                                            value={filters.brand}
                                                            onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                                                            className="w-full px-3 py-2 border rounded-lg"
                                                            placeholder="Enter brand"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Funnel</label>
                                                        <input
                                                            type="text"
                                                            value={filters.funnel}
                                                            onChange={(e) => setFilters({ ...filters, funnel: e.target.value })}
                                                            className="w-full px-3 py-2 border rounded-lg"
                                                            placeholder="Enter funnel"
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => setFilters({ seller_tag: '', brand: '', funnel: '' })}
                                                        className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                                                    >
                                                        Clear Filters
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={downloadCSV}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download CSV
                                </button>

                                <button
                                    onClick={handleUploadCSV}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    Upload CSV
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={processCSVFile}
                                    className="hidden"
                                />

                                <button
                                    onClick={bulkUSAPriceUpdate}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                >
                                    Bulk USA Price Update
                                </button>

                                {/* Hidden Button - Constants Configuration */}
                                <button
                                    onClick={openConstantsModal}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Configure Constants
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
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
                                            activeTab === 'faild_file' ? 'Failed File' :
                                                'Pending'
                                }</p>
                                <p className="text-sm mt-2">
                                    {activeTab === 'pending'
                                        ? 'Products with incomplete data will appear here'
                                        : activeTab === 'pass_file'
                                            ? 'Products with PASS judgement will appear here'
                                            : activeTab === 'faild_file'
                                                ? 'Products with FAIL judgement will appear here'
                                                : 'All products will appear here'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                                        <tr>
                                            <th className="p-3 text-left">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    className="rounded"
                                                />
                                            </th>
                                            {visibleColumns.asin && <th className="p-3 text-left font-semibold text-gray-700">ASIN</th>}
                                            {visibleColumns.product_name && <th className="p-3 text-left font-semibold text-gray-700">Product Name</th>}
                                            {visibleColumns.brand && <th className="p-3 text-left font-semibold text-gray-700">Brand</th>}
                                            {visibleColumns.seller_tag && <th className="p-3 text-left font-semibold text-gray-700">Seller Tag</th>}
                                            {visibleColumns.funnel && <th className="p-3 text-left font-semibold text-gray-700">Funnel</th>}
                                            {visibleColumns.no_of_seller && <th className="p-3 text-left font-semibold text-gray-700">No. OF seller</th>}
                                            {visibleColumns.usa_link && <th className="p-3 text-left font-semibold text-gray-700">USA Link</th>}
                                            {visibleColumns.product_weight && <th className="p-3 text-left font-semibold text-gray-700">Weight (g)</th>}
                                            {visibleColumns.usd_price && <th className="p-3 text-left font-semibold text-gray-700">USD Price</th>}
                                            {visibleColumns.inr_sold && <th className="p-3 text-left font-semibold text-gray-700">INR Sold</th>}
                                            {visibleColumns.inr_purchase && <th className="p-3 text-left font-semibold text-gray-700">INR Purchase</th>}
                                            {visibleColumns.india_price && <th className="p-3 text-left font-semibold text-gray-700">India Price</th>}
                                            {visibleColumns.judgement && <th className="p-3 text-left font-semibold text-gray-700">Judgement</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.map((product, index) => (
                                            <tr key={product.id} className={`border-b hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                        className="rounded"
                                                    />
                                                </td>
                                                {visibleColumns.asin && <td className="p-3 font-mono text-sm">{product.asin}</td>}
                                                {visibleColumns.product_name && <td className="p-3">{product.product_name || '-'}</td>}
                                                {visibleColumns.brand && <td className="p-3">{product.brand || '-'}</td>}
                                                {visibleColumns.seller_tag && <td className="p-3">{product.seller_tag || '-'}</td>}
                                                {visibleColumns.funnel && <td className="p-3">{product.funnel || '-'}</td>}
                                                {visibleColumns.no_of_seller && <td className="p-3">{product.no_of_seller || '-'}</td>}
                                                {visibleColumns.usa_link && (
                                                    <td className="p-3">
                                                        {product.usa_link ? (
                                                            <a href={product.usa_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                                                        ) : '-'}
                                                    </td>
                                                )}
                                                {visibleColumns.product_weight && (
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            value={product.product_weight || ''}
                                                            onChange={(e) => handleCellEdit(product.id, 'product_weight', parseFloat(e.target.value) || null)}
                                                            className="w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                                            placeholder="0"
                                                            disabled={activeTab !== 'main_file'}
                                                        />
                                                    </td>
                                                )}
                                                {visibleColumns.usd_price && (
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            value={product.usd_price || ''}
                                                            onChange={(e) => handleCellEdit(product.id, 'usd_price', parseFloat(e.target.value) || null)}
                                                            className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            disabled={activeTab !== 'main_file'}
                                                        />
                                                    </td>
                                                )}
                                                {visibleColumns.inr_sold && (
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            value={product.inr_sold || ''}
                                                            onChange={(e) => handleCellEdit(product.id, 'inr_sold', parseFloat(e.target.value) || null)}
                                                            className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-green-500"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            disabled={activeTab !== 'main_file'}
                                                        />
                                                    </td>
                                                )}
                                                {visibleColumns.inr_purchase && (
                                                    <td className="p-3">
                                                        <input
                                                            type="number"
                                                            value={product.inr_purchase || ''}
                                                            onChange={(e) => handleCellEdit(product.id, 'inr_purchase', parseFloat(e.target.value) || null)}
                                                            className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-purple-500"
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            disabled={activeTab !== 'main_file'}
                                                        />
                                                    </td>
                                                )}
                                                {visibleColumns.india_price && <td className="p-3">{product.india_price || '-'}</td>}
                                                {visibleColumns.judgement && (
                                                    <td className="p-3">
                                                        {product.judgement ? (
                                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${product.judgement === 'PASS' ? 'bg-green-500 text-white' :
                                                                product.judgement === 'FAIL' ? 'bg-red-500 text-white' :
                                                                    'bg-gray-400 text-white'
                                                                }`}>
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
                        )}
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <p>Showing {filteredProducts.length} of {products.length} products | {selectedIds.size} selected</p>
                    </div>
                </div>

                {/* Constants Configuration Modal */}
                {isConstantsModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsConstantsModalOpen(false)} />
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
                                    <h2 className="text-2xl font-bold">Calculation Constants Configuration</h2>
                                    <p className="text-purple-100 mt-1">Update global constants for automatic calculations</p>
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

                                {/* Footer */}
                                <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
                                    <button
                                        onClick={() => setIsConstantsModalOpen(false)}
                                        className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveConstants}
                                        disabled={isSavingConstants}
                                        className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSavingConstants ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Save & Recalculate
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Toast Notification */}
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </div>
        </PageTransition>
    )
}
