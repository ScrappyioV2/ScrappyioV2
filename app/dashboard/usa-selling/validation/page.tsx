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
    seller_tag: string
    brand: string
    funnel: string
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
            // Always fetch from main_file, but filter based on activeTab
            const { data, error } = await supabase
                .from('usa_validation_main_file')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching products:', error)
                setProducts([])
            } else {

                // Filter based on active tab (v2: status-driven)
                let filteredData = data || []

                if (activeTab === 'pass_file') {
                    filteredData = filteredData.filter(p => p.status === 'pass')
                } else if (activeTab === 'fail_file') {
                    // keep legacy FAIL tab for now
                    filteredData = filteredData.filter(p => p.judgement === 'FAIL')
                } else if (activeTab === 'pending') {
                    // keep legacy pending for now
                    filteredData = filteredData.filter(p => !p.judgement || p.judgement === 'PENDING')
                }

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

    const handleOriginToggle = async (
        id: string,
        field: 'origin_india' | 'origin_china',
        value: boolean
    ) => {
        // optimistic UI
        setProducts(prev =>
            prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
        )

        const { error } = await supabase
            .from('usa_validation_main_file')
            .update({ [field]: value })
            .eq('id', id)

        if (error) {
            // rollback on failure
            setProducts(prev =>
                prev.map(p => (p.id === id ? { ...p, [field]: !value } : p))
            )
            setToast({ message: 'Failed to update origin', type: 'error' })
        }
    }

    const handleChecklistToggle = async (
        id: string,
        field:
            | 'check_brand'
            | 'check_item_expire'
            | 'check_small_size'
            | 'check_multi_seller',
        value: boolean
    ) => {
        // optimistic UI
        setProducts(prev =>
            prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
        )

        const { error } = await supabase
            .from('usa_validation_main_file')
            .update({ [field]: value })
            .eq('id', id)

        if (error) {
            // rollback
            setProducts(prev =>
                prev.map(p => (p.id === id ? { ...p, [field]: !value } : p))
            )
            setToast({ message: 'Failed to update checklist', type: 'error' })
        }
    }

    const handleChecklistOk = async (id: string) => {
        const confirmed = window.confirm("Send this item to Purchases?");
        if (!confirmed) return;

        const product = products.find((p) => p.id === id);
        if (!product) return;

        // INSERT into usa_purchases table
        const { error: insertError } = await supabase
            .from("usa_purchases")
            .insert({
                asin: product.asin,
                product_name: product.product_name,        // ✅ Fixed
                brand: product.brand,
                seller_tag: product.seller_tag,            // ✅ Fixed
                funnel: product.funnel,
                origin_india: product.origin_india || false,
                origin_china: product.origin_china || false,
                product_link: product.usa_link,            // ✅ Fixed
                target_price: product.usd_price,           // ✅ Fixed
                target_quantity: 1,
                funnel_quantity: 1,
                funnel_seller: product.funnel,
                buying_price: product.inr_purchase,        // ✅ Fixed
                buying_quantity: 1,
                seller_link: "",
                seller_phone: "",
                payment_method: "",
                tracking_details: "",
                delivery_date: null,
                status: "pending",
                admin_confirmed: false,
            });

        if (insertError) {
            console.error("Insert error:", insertError);
            setToast({ message: `Failed: ${insertError.message}`, type: "error" });
            return;
        }

        // Mark as sent in main file
        const { error } = await supabase
            .from("usa_validation_main_file")
            .update({
                sent_to_purchases: true,
                sent_to_purchases_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (error) {
            console.error("Update error:", error);
        }

        setProducts((prev) => prev.filter((p) => p.id !== id));
        setToast({ message: "Sent to Purchases!", type: "success" });
    };

    const handleMoveToMainClick = () => {
        setToast({
            message: `Move to Main clicked for ${selectedIds.size} item(s)`,
            type: 'info',
        })
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
            <div className="h-screen flex flex-col overflow-hidden bg-gray-50 p-6">
                <div className="max-w-full mx-auto flex flex-col flex-1 overflow-hidden">
                    <div className="flex-none"></div>
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">USA Selling - Validation</h1>
                        <p className="text-gray-600 mt-1">Manage validation files and product status</p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm opacity-90">Total Products</div>
                            <div className="text-4xl font-bold mt-2">{stats.total}</div>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm opacity-90">✓ Passed</div>
                            <div className="text-4xl font-bold mt-2">{stats.passed}</div>
                        </div>

                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm opacity-90">✗ Failed</div>
                            <div className="text-4xl font-bold mt-2">{stats.failed}</div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-5 text-white shadow-lg">
                            <div className="text-sm opacity-90">⏳ Pending</div>
                            <div className="text-4xl font-bold mt-2">{stats.pending}</div>
                        </div>
                    </div>

                    {/* File Tabs */}
                    <div className="flex gap-2 mb-3">
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
                            onClick={() => setActiveTab('fail_file')}
                            className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${activeTab === 'fail_file'
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

                                <div className="flex gap-3">

                                    {activeTab === 'pass_file' && (
                                        <button
                                            onClick={handleMoveToMainClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition
                                              ${selectedIds.size === 0
                                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                    : 'bg-slate-800 text-white hover:bg-slate-900'
                                                }`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 5l7 7-7 7"
                                                />
                                            </svg>
                                            Move to Main
                                        </button>
                                    )}

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
                                        onClick={() => usaPriceCSVInputRef.current?.click()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                                    >
                                        Bulk USA Price Update
                                    </button>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        ref={usaPriceCSVInputRef}
                                        onChange={handleUSAPriceCSVUpload}
                                        className="hidden"
                                    />

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
                                                            <td className="p-3 font-mono text-sm">{product.asin}</td>
                                                        )}
                                                        {visibleColumns.product_name && (
                                                            <td className="p-3">{product.product_name || '-'}</td>
                                                        )}
                                                        {visibleColumns.brand && (
                                                            <td className="p-3">{product.brand || '-'}</td>
                                                        )}
                                                        {visibleColumns.seller_tag && (
                                                            <td className="p-3">{product.seller_tag || '-'}</td>
                                                        )}
                                                        {visibleColumns.funnel && (
                                                            <td className="p-3">{product.funnel || '-'}</td>
                                                        )}
                                                        {visibleColumns.no_of_seller && (
                                                            <td className="p-3">{product.no_of_seller || '-'}</td>
                                                        )}

                                                        {visibleColumns.usa_link && (
                                                            <td className="p-3">
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

                                                        {/* ORIGIN */}
                                                        {activeTab === 'pass_file' && (
                                                            <td className="p-3">
                                                                <div className="flex flex-col gap-1 text-sm">
                                                                    <label className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.origin_india}
                                                                            onChange={(e) =>
                                                                                handleOriginToggle(product.id, 'origin_india', e.target.checked)
                                                                            }
                                                                        />
                                                                        India
                                                                    </label>
                                                                    <label className="flex items-center gap-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.origin_china}
                                                                            onChange={(e) =>
                                                                                handleOriginToggle(product.id, 'origin_china', e.target.checked)
                                                                            }
                                                                        />
                                                                        China
                                                                    </label>
                                                                </div>
                                                            </td>
                                                        )}

                                                        {visibleColumns.product_weight && (
                                                            <td className="p-3">
                                                                {activeTab === 'main_file' ? (
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

                                                        {visibleColumns.inr_purchase && (
                                                            <td className="p-3">
                                                                {activeTab === 'main_file' ? (
                                                                    <input
                                                                        type="text"
                                                                        value={
                                                                            editingValue?.id === product.id &&
                                                                                editingValue.field === 'inr_purchase'
                                                                                ? editingValue.value
                                                                                : formatINR(product.inr_purchase)
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
                                                                            const parsed = parseCurrency(editingValue?.value || '')
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

                        <div className="mt-4 text-sm text-gray-600">
                            <p>Showing {filteredProducts.length} of {products.length} products | {selectedIds.size} selected</p>
                        </div>
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
