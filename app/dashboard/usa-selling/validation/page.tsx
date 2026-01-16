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
    id: string
    asin: string
    product_name: string | null
    brand: string | null
    seller_tag: string | null
    funnel: string | null
    no_of_seller: number | null
    usa_link: string | null
    amz_link: string | null
    product_weight: number | null
    judgement: string | null
    usd_price: number | null
    inr_sold: number | null  // Keep for backward compatibility
    inr_purchase: number | null

    // ✅ NEW FIELDS - Match CalculationResult
    total_cost: number | null
    total_revenue: number | null
    profit: number | null

    status: string | null
    origin_india: boolean | null
    origin_china: boolean | null
    check_brand: boolean | null
    check_item_expire: boolean | null
    check_small_size: boolean | null
    check_multi_seller: boolean | null
    sent_to_purchases?: boolean
    sent_to_purchases_at?: string
}

interface Stats {
    total: number
    passed: number
    failed: number
    pending: number
}

interface Filters {
    seller_tag: string;  // Changed from 'sellertag' to 'seller_tag'
    brand: string;
    funnel: string;
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
    const [searchQuery, setSearchQuery] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null)
    const usaPriceCSVInputRef = useRef<HTMLInputElement>(null)


    // Constants Modal
    const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false)
    const [constants, setConstants] = useState<CalculationConstants>(getDefaultConstants())
    const [isSavingConstants, setIsSavingConstants] = useState(false)

    // 5. UPDATE visibleColumns state (around line 100)
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
        inr_purchase: true,
        total_cost: true,      // NEW
        total_revenue: true,   // NEW
        profit: true,          // NEW
        judgement: true,
        // Remove: inr_sold, india_price, cargo_charge, final_purchase_rate, purchase_rate_inr
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
        applyFilters();
    }, [products, filters, searchQuery, activeTab]); // Added searchQuery and activeTab

    // Clear search and filters when switching tabs
    useEffect(() => {
        setSearchQuery('');
        setFilters({ seller_tag: '', brand: '', funnel: '' });
        setSelectedIds(new Set());
    }, [activeTab]);


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
                    bank_conversion_rate: data.bank_conversion_rate,  // ✅ NEW
                    shipping_charge_per_kg: data.shipping_charge_per_kg,  // ✅ NEW
                    commission_rate: data.commission_rate,
                    packing_cost: data.packing_cost,
                })
            }
        } catch (err) {
            console.error('Error fetching constants:', err)
        }
    }

    const applyFilters = () => {
        // START with tab-filtered products
        let filtered = getTabProducts();

        // Apply search query (searches across ASIN, Product Name, Brand)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.asin?.toLowerCase().includes(query) ||
                p.product_name?.toLowerCase().includes(query) ||
                p.brand?.toLowerCase().includes(query)
            );
        }

        // Apply filter dropdowns
        if (filters.seller_tag) {
            filtered = filtered.filter(p =>
                p.seller_tag?.toLowerCase().includes(filters.seller_tag.toLowerCase())
            );
        }

        if (filters.brand) {
            filtered = filtered.filter(p =>
                p.brand?.toLowerCase().includes(filters.brand.toLowerCase())
            );
        }

        if (filters.funnel) {
            filtered = filtered.filter(p =>
                p.funnel?.toLowerCase().includes(filters.funnel.toLowerCase())
            );
        }

        setFilteredProducts(filtered);
    };

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
        setLoading(true);
        try {
            // Always fetch from main_file
            const { data, error } = await supabase
                .from('usa_validation_main_file')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching products:', error);
                setProducts([]);
            } else {
                // Store ALL products - DON'T filter here
                setProducts(data || []);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    // Get products for current tab (before search/filters)
    const getTabProducts = () => {
        let tabProducts = [...products];

        // Filter based on active tab
        if (activeTab === 'pass_file') {
            tabProducts = tabProducts.filter(p => p.judgement === 'PASS');
        } else if (activeTab === 'fail_file') {
            tabProducts = tabProducts.filter(p => p.judgement === 'FAIL');
        } else if (activeTab === 'pending') {
            tabProducts = tabProducts.filter(p => !p.judgement || p.judgement === 'PENDING');
        }
        // mainfile shows all products

        return tabProducts;
    };

    const handleCellEdit = async (id: string, field: string, value: any) => {
        try {
            const tableName = 'usa_validation_main_file'  // ✅ Always use main_file

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

    // 2. UPDATE the autoCalculateAndUpdate function (around line 180)
    const autoCalculateAndUpdate = async (id: string, product: ValidationProduct) => {
        // Calculate values
        const result = calculateProductValues(
            {
                usd_price: product.usd_price,
                product_weight: product.product_weight,
                inr_purchase: product.inr_purchase,  // ✅ Only 3 inputs needed
            },
            constants
        )

        // Update product with calculated values - ✅ NEW PROPERTY NAMES
        const { error: updateError } = await supabase
            .from('usa_validation_main_file')
            .update({
                total_cost: result.total_cost,
                total_revenue: result.total_revenue,
                profit: result.profit,
                judgement: result.judgement,
            })
            .eq('id', id)

        if (updateError) {
            console.error('Auto-calc error:', updateError)
            return
        }

        fetchStats()
        // Update local state - ✅ NEW PROPERTY NAMES
        setProducts((prev) =>
            prev.map((p) =>
                p.id === id
                    ? {
                        ...p,
                        total_cost: result.total_cost,
                        total_revenue: result.total_revenue,
                        profit: result.profit,
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
                product_name: product.product_name,
                brand: product.brand,
                seller_tag: product.seller_tag,
                funnel: product.funnel,
                origin_india: product.origin_india || false,
                origin_china: product.origin_china || false,
                product_link: product.usa_link,              // Product view link
                target_price: product.usd_price,
                target_quantity: 1,
                funnel_quantity: 1,
                funnel_seller: product.funnel,
                buying_price: product.inr_purchase,
                buying_quantity: 1,
                seller_link: product.amz_link || "",         // ✅ Amazon seller approval link
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

    const handleMoveToMainClick = async () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        const confirmed = window.confirm(
            `Move ${selectedIds.size} items back to Main File? This will reset their data for re-validation.`
        );

        if (!confirmed) return;

        try {
            const idsArray = Array.from(selectedIds);

            console.log('🔄 Moving IDs:', idsArray);

            // Use CORRECT database field names (snake_case with underscores)
            const { error } = await supabase
                .from('usa_validation_main_file')
                .update({
                    // Clear judgement
                    judgement: 'PENDING',
                    // Clear calculated values
                    total_cost: null,
                    total_revenue: null,
                    profit: null,
                    // Clear input fields
                    usd_price: null,
                    product_weight: null,
                    inr_purchase: null,
                    // Clear checklist - CORRECT NAMES with underscores
                    check_brand: false,
                    check_item_expire: false,
                    check_small_size: false,
                    check_multi_seller: false,
                    // Clear origin
                    origin_india: false,
                    origin_china: false,
                })
                .in('id', idsArray);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log('✅ Successfully updated!');

            // Immediate UI update
            setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());

            setToast({
                message: `Successfully moved ${idsArray.length} items back to Main File!`,
                type: 'success'
            });

            // Background refresh
            await fetchProducts();
            await fetchStats();

        } catch (err) {
            console.error('Move to main error:', err);
            setToast({ message: 'Failed to move items', type: 'error' });
        }
    };

    // Move items from Pending to Pass
    const handleMoveToPassClick = async () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        const confirmed = window.confirm(
            `Move ${selectedIds.size} items to Pass File?`
        );

        if (!confirmed) return;

        try {
            const idsArray = Array.from(selectedIds);

            console.log('🔄 Moving to Pass:', idsArray);

            // Update judgement to PASS in main_file
            const { error } = await supabase
                .from('usa_validation_main_file')
                .update({
                    judgement: 'PASS',
                })
                .in('id', idsArray);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            // Immediate UI update
            setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());

            setToast({
                message: `Successfully moved ${idsArray.length} items to Pass File!`,
                type: 'success'
            });

            // Background refresh
            await fetchProducts();
            await fetchStats();

        } catch (err) {
            console.error('Move to pass error:', err);
            setToast({ message: 'Failed to move items', type: 'error' });
        }
    };

    // Move items from Pending to Fail
    const handleMoveToFailClick = async () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        const confirmed = window.confirm(
            `Move ${selectedIds.size} items to Fail File?`
        );

        if (!confirmed) return;

        try {
            const idsArray = Array.from(selectedIds);

            console.log('🔄 Moving to Fail:', idsArray);

            // Update judgement to FAIL in main_file
            const { error } = await supabase
                .from('usa_validation_main_file')
                .update({
                    judgement: 'FAIL',
                })
                .in('id', idsArray);

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            // Immediate UI update
            setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
            setSelectedIds(new Set());

            setToast({
                message: `Successfully moved ${idsArray.length} items to Fail File!`,
                type: 'success'
            });

            // Background refresh
            await fetchProducts();
            await fetchStats();

        } catch (err) {
            console.error('Move to fail error:', err);
            setToast({ message: 'Failed to move items', type: 'error' });
        }
    };


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
                <div className="w-full flex flex-col flex-1 overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="flex-none">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-gray-900">USA Selling - Validation</h1>
                            <p className="text-gray-600 mt-1">Manage validation files and product status</p>
                        </div>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                            <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg px-5 py-4 text-white shadow-md">
                                <div className="text-xs font-medium opacity-90">Total Products</div>
                                <div className="text-3xl font-bold mt-1">{stats.total}</div>
                            </div>

                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg px-5 py-4 text-white shadow-md">
                                <div className="text-xs font-medium opacity-90">✓ Passed</div>
                                <div className="text-3xl font-bold mt-1">{stats.passed}</div>
                            </div>

                            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg px-5 py-4 text-white shadow-md">
                                <div className="text-xs font-medium opacity-90">✗ Failed</div>
                                <div className="text-3xl font-bold mt-1">{stats.failed}</div>
                            </div>

                            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg px-5 py-4 text-white shadow-md">
                                <div className="text-xs font-medium opacity-90">⏳ Pending</div>
                                <div className="text-3xl font-bold mt-1">{stats.pending}</div>
                            </div>
                        </div>

                        {/* File Tabs */}
                        <div className="flex gap-2 mb-5 flex-wrap">
                            <button
                                onClick={() => setActiveTab('main_file')}
                                className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'main_file'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                Main File
                            </button>

                            <button
                                onClick={() => setActiveTab('pass_file')}
                                className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'pass_file'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                Pass File
                            </button>

                            <button
                                onClick={() => setActiveTab('fail_file')}
                                className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'fail_file'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                Failed File
                            </button>

                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-6 py-2.5 text-sm font-semibold rounded-md transition-all ${activeTab === 'pending'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                Pending
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between gap-3">
                                {/* LEFT SIDE - Search + Filter */}
                                <div className="flex gap-3 flex-1 min-w-[300px]">
                                    {/* Search Bar - NEW */}
                                    <div className="relative flex-1 max-w-md">
                                        <svg
                                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search by ASIN, Product Name, or Brand..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    {/* Filter Button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                                            className="px-4 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                                                />
                                            </svg>
                                            Add Filter
                                        </button>

                                        {isFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
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
                                                            onClick={() => setFilters({ seller_tag: '', brand: '', funnel: '' } as Filters)}
                                                            className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                                                        >
                                                            Clear Filters
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT SIDE - Action Buttons */}
                                <div className="flex gap-3 flex-wrap">
                                    {/* Move to Main - ONLY for Pass and Failed tabs */}
                                    {(activeTab === 'pass_file' || activeTab === 'fail_file') && (
                                        <button
                                            onClick={handleMoveToMainClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition whitespace-nowrap ${selectedIds.size === 0
                                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                : 'bg-slate-800 text-white hover:bg-slate-900'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            Move to Main
                                        </button>
                                    )}

                                    {/* Move to Pass - ONLY for Pending tab */}
                                    {activeTab === 'pending' && (
                                        <button
                                            onClick={handleMoveToPassClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition whitespace-nowrap ${selectedIds.size === 0
                                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Move to Pass
                                        </button>
                                    )}

                                    {/* Move to Fail - ONLY for Pending tab */}
                                    {activeTab === 'pending' && (
                                        <button
                                            onClick={handleMoveToFailClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition whitespace-nowrap ${selectedIds.size === 0
                                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                                                : 'bg-red-600 text-white hover:bg-red-700'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Move to Fail
                                        </button>
                                    )}

                                    {/* Download CSV */}
                                    <button
                                        onClick={downloadCSV}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                            />
                                        </svg>
                                        Download CSV
                                    </button>

                                    {/* Upload CSV */}
                                    <button
                                        onClick={handleUploadCSV}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                            />
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

                                    {/* Bulk USA Price Update */}
                                    <button
                                        onClick={() => usaPriceCSVInputRef.current?.click()}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium whitespace-nowrap"
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

                                    {/* Configure Constants */}
                                    <button
                                        onClick={openConstantsModal}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                            />
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                            />
                                        </svg>
                                        Configure Constants
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Table Section - ONLY THIS SCROLLS */}
                    <div className="flex-1 min-h-0 bg-white rounded-md shadow overflow-hidden flex flex-col border border-gray-200">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-16">
                                <div className="relative">
                                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
                                    <div className="absolute top-0 left-0 inline-block animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-blue-600"></div>
                                </div>
                                <p className="mt-4 text-gray-600 font-medium">Loading products...</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-lg font-semibold text-gray-700 mb-2">No products found</p>
                                <p className="text-sm text-gray-500 max-w-md text-center">

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
                            <>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full">
                                        <thead className="bg-gradient-to-r from-slate-100 to-slate-200 border-b-2 border-slate-300 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
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

                                                {visibleColumns.asin && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">ASIN</th>}
                                                {visibleColumns.product_name && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">Product Name</th>}
                                                {visibleColumns.brand && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">Brand</th>}
                                                {visibleColumns.seller_tag && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">Seller Tag</th>}
                                                {visibleColumns.funnel && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left"> Funnel</th>}
                                                {visibleColumns.no_of_seller && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left"> No. of Sellers</th>}
                                                {visibleColumns.usa_link && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">USA Link</th>}
                                                {activeTab === 'pass_file' && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left"> Origin</th>}
                                                {visibleColumns.product_weight && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left"> Weight (g)</th>}
                                                {visibleColumns.usd_price && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">USD Price</th>}
                                                {visibleColumns.inr_purchase && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">INR Purchase</th>}
                                                {activeTab === 'pass_file' && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">Checklist</th>}
                                                {visibleColumns.judgement && <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">Judgement</th>}
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filteredProducts.map((product, index) => (
                                                <tr
                                                    key={product.id}
                                                    className="border-b hover:bg-gray-50 transition-colors"
                                                >
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

                                                    {activeTab === 'pass_file' && (
                                                        <td className="p-3">
                                                            {product.check_brand && product.check_item_expire && product.check_small_size && product.check_multi_seller ? (
                                                                <button
                                                                    onClick={() => handleChecklistOk(product.id)}
                                                                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                                                                >
                                                                    OK
                                                                </button>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2 text-xs">
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded" title="Brand Checking">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.check_brand}
                                                                            onChange={(e) => handleChecklistToggle(product.id, 'check_brand', e.target.checked)}
                                                                            className="w-3 h-3"
                                                                        />
                                                                        <span>Brand</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded" title="Item Expaire">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.check_item_expire}
                                                                            onChange={(e) => handleChecklistToggle(product.id, 'check_item_expire', e.target.checked)}
                                                                            className="w-3 h-3"
                                                                        />
                                                                        <span>Expire</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded" title="Small Size">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.check_small_size}
                                                                            onChange={(e) => handleChecklistToggle(product.id, 'check_small_size', e.target.checked)}
                                                                            className="w-3 h-3"
                                                                        />
                                                                        <span>Size</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded" title="Multi Sellers">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={!!product.check_multi_seller}
                                                                            onChange={(e) => handleChecklistToggle(product.id, 'check_multi_seller', e.target.checked)}
                                                                            className="w-3 h-3"
                                                                        />
                                                                        <span>Multi</span>
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {visibleColumns.judgement && (
                                                        <td className="p-3">
                                                            {product.judgement ? (
                                                                <span
                                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${product.judgement === 'PASS'
                                                                        ? 'bg-green-500 text-white'
                                                                        : product.judgement === 'FAIL'
                                                                            ? 'bg-red-500 text-white'
                                                                            : product.judgement === 'PENDING'
                                                                                ? 'bg-orange-500 text-white'
                                                                                : 'bg-gray-400 text-white'
                                                                        }`}
                                                                >
                                                                    {product.judgement}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-500 text-white">
                                                                    PENDING
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Footer Stats - Fixed at bottom of table */}
                                <div className="flex-none border-t bg-gray-50 px-4 py-3">
                                    <div className="flex items-center justify-between text-xs text-gray-600 flex-wrap gap-2">
                                        <span className="text-gray-600 font-medium">
                                            Showing <span className="font-bold text-slate-800">{filteredProducts.length}</span> of <span className="font-bold text-slate-800">{products.length}</span> products
                                        </span>
                                        {selectedIds.size > 0 && (
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                                                {selectedIds.size} selected
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Constants Configuration Modal */}
                {isConstantsModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsConstantsModalOpen(false)} />
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
                                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
                                    <h2 className="text-2xl font-bold">Calculation Constants Configuration</h2>
                                    <p className="text-purple-100 mt-1">Update global constants for automatic calculations</p>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Dollar Rate (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.dollar_rate}
                                            onChange={(e) =>
                                                setConstants({ ...constants, dollar_rate: parseFloat(e.target.value) || 90 })
                                            }
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Bank Fee (%)</label>
                                        <input
                                            type="number"
                                            value={constants.bank_conversion_rate * 100}
                                            onChange={(e) =>
                                                setConstants({ ...constants, bank_conversion_rate: parseFloat(e.target.value) / 100 || 0.02 })
                                            }
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Shipping per 1000g (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.shipping_charge_per_kg}
                                            onChange={(e) =>
                                                setConstants({ ...constants, shipping_charge_per_kg: parseFloat(e.target.value) || 950 })
                                            }
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

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
