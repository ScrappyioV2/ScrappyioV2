'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useAuth } from '@/lib/hooks/useAuth';
import PageTransition from '@/components/layout/PageTransition'
import { supabase } from '@/lib/supabaseClient'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { calculateProductValues, getDefaultConstants, CalculationConstants } from '@/lib/blackboxCalculations'
import { Loader2, History, X, } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ✅ Safe UUID generator (works in all browsers)
const generateUUID = (): string => {
    if (typeof window !== 'undefined' &&
        window.crypto &&
        typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    // Fallback: Generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// ✅ ADD THIS DEBOUNCE UTILITY
const debounce = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};


// ✅ ADD THIS HERE (TOP LEVEL)
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
    asin: 120,
    history: 120,           // Reduced
    product_name: 220,   // Reduced from 320
    brand: 110,
    seller_tag: 100,
    funnel: 80,
    no_of_seller: 80,
    usa_link: 70,        // Minimal width for "View"
    product_weight: 90,
    usd_price: 90,
    inr_purchase: 100,
    inr_purchase_link: 150, // Reduced from 260 (will truncate)
    judgement: 110,
    origin: 100,
    checklist: 140,
    total_cost: 100,
    total_revenue: 100,
    profit: 100,
    remark: 150,
};
// Controls how columns consume available width (layout-only)
const COLUMN_FLEX: Record<string, boolean> = {
    asin: false,
    product_name: false,        // 👈 main flex column
    brand: false,
    seller_tag: false,
    funnel: false,
    no_of_seller: false,
    usa_link: false,
    product_weight: false,
    usd_price: false,
    inr_purchase: false,
    inr_purchase_link: false,   // 👈 flex but truncated
    judgement: false,
    remark: false,
};
// ✅ ADD THIS TYPE for History
type HistorySnapshot = {
    id: string;
    stage: string;
    created_at: string;
    snapshot_data: any;
    journey_number: number;
    profit?: number;
    total_cost?: number;
    status?: string;
};



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
    inr_purchase_link: string | null
    product_weight: number | null
    judgement: string | null
    usd_price: number | null
    inr_sold: number | null  // Keep for backward compatibility
    inr_purchase: number | null

    // ✅ NEW FIELDS - Match CalculationResult
    total_cost: number | null
    total_revenue: number | null
    profit: number | null
    journey_number?: number | null
    current_journey_id?: string | null

    status: string | null
    origin_india: boolean | null
    origin_china: boolean | null
    check_brand: boolean | null
    check_item_expire: boolean | null
    check_small_size: boolean | null
    check_multi_seller: boolean | null
    sent_to_purchases?: boolean
    sent_to_purchases_at?: string
    calculated_judgement?: string | null
    remark: string | null
}

interface Stats {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    rejected: number;
}

interface Filters {
    seller_tag: string;  // Changed from 'sellertag' to 'seller_tag'
    brand: string;
    funnel: string;
}

type FileTab = 'main_file' | 'pass_file' | 'fail_file' | 'pending' | 'reject_file';

const SELLER_STYLES: Record<string, string> = {
    GR: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg border border-yellow-500/30',
    RR: 'bg-gradient-to-br from-gray-400 to-gray-600 text-white shadow-lg border border-gray-500/30',
    UB: 'bg-gradient-to-br from-pink-500 to-pink-700 text-white shadow-lg border border-pink-600/30',
    VV: 'bg-gradient-to-br from-purple-600 to-purple-800 text-white shadow-lg border border-purple-700/30',   // Purple
};

const renderSellerTags = (sellerTag: string | null) => {
    if (!sellerTag) return '-';

    return (
        <div className="flex flex-wrap gap-3">
            {sellerTag.split(',').map((tag) => {
                const cleanTag = tag.trim();
                return (
                    <span key={cleanTag} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-sm ${SELLER_STYLES[cleanTag] ?? 'bg-[#1a1a1a] text-white'}`}>
                        {cleanTag}
                    </span>
                );
            })}
        </div>
    );
};

const FUNNEL_STYLES: Record<string, string> = {
    HD: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
    LD: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg border border-blue-600/30',
    DP: 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30'     // Dropshipping
};


const renderFunnelBadge = (funnel: string | null) => {
    if (!funnel) return '-';

    const tag = funnel.trim();

    return (
        <span className={`w-7 h-7 inline-flex items-center justify-center rounded-lg font-bold text-sm ${FUNNEL_STYLES[tag] ?? 'bg-gray-400 text-white'}`}>
            {tag}
        </span>
    );
};

const ResizableTH = ({
    width,
    label,
    columnKey,
    align = 'left',
    onResizeStart,
}: {
    width: number
    label: React.ReactNode
    columnKey: string
    align?: 'left' | 'center'
    onResizeStart: (key: string, startX: number) => void
}) => {
    const isFlex = COLUMN_FLEX[columnKey];

    return (
        <th
            style={{
                minWidth: width,
                width: isFlex ? 'auto' : width,
            }}
            className={`relative px-4 py-3 text-xs font-bold text-white uppercase tracking-wider bg-[#111111] ${align === 'center' ? 'text-center' : 'text-left'
                } select-none`}
        >
            <div className={isFlex ? 'truncate' : ''}>{label}</div>

            <span
                onMouseDown={(e) => onResizeStart(columnKey, e.clientX)}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
            />
        </th>
    );
};



export default function ValidationPage() {
    const { user, loading: authLoading } = useAuth();
    // const [editingValue, setEditingValue] = useState<{
    //     id: string
    //     field: string
    //     value: string
    // } | null>(null)
    const [activeTab, setActiveTab] = useState<FileTab>('main_file')
    const [products, setProducts] = useState<ValidationProduct[]>([])
    // const [filteredProducts, setFilteredProducts] = useState<ValidationProduct[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
    const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, pending: 0, rejected: 0 })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [filters, setFilters] = useState<Filters>({ seller_tag: '', brand: '', funnel: '' })
    const [searchQuery, setSearchQuery] = useState('');
    const localEditCountRef = useRef(0);
    const [isTabSwitching, setIsTabSwitching] = useState(false);
    // ✅ Store page number for each tab separately
    const [tabPages, setTabPages] = useState<Record<FileTab, number>>({
        main_file: 1, pass_file: 1, fail_file: 1, pending: 1, reject_file: 1,
    });
    const [rowsPerPage] = useState(100);
    const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);

    // ✅ Get current page for active tab
    const currentPage = tabPages[activeTab];


    // ✅ Helper to update page for current tab
    const setCurrentPage = (pageOrUpdater: number | ((prev: number) => number)) => {
        setTabPages((prev) => ({
            ...prev,
            [activeTab]: typeof pageOrUpdater === 'function'
                ? pageOrUpdater(prev[activeTab])
                : pageOrUpdater,
        }));
    };


    const fileInputRef = useRef<HTMLInputElement>(null)
    const usaPriceCSVInputRef = useRef<HTMLInputElement>(null)

    // ✅ History Sidebar State
    const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<HistorySnapshot[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);



    // Constants Modal
    const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false)
    const [constants, setConstants] = useState<CalculationConstants>(getDefaultConstants())
    const [isSavingConstants, setIsSavingConstants] = useState(false)
    const [selectedRemark, setSelectedRemark] = useState<string | null>(null)

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
        inr_purchase_link: true,
        total_cost: true,      // NEW
        total_revenue: true,   // NEW
        profit: true,          // NEW
        judgement: true,
        remark: true,
        // Remove: inr_sold, india_price, cargo_charge, final_purchase_rate, purchase_rate_inr
    })


    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMN_WIDTHS;

        try {
            const saved = localStorage.getItem('usa_validation_column_widths');
            if (saved) {
                const parsed = JSON.parse(saved);
                // ✅ FIX: Merge with defaults to ensure all keys exist
                return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
            }
            return DEFAULT_COLUMN_WIDTHS;
        } catch {
            return DEFAULT_COLUMN_WIDTHS;
        }
    });
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
        confirmText: string;
        type: 'danger' | 'warning';
        onConfirm: () => void;
    } | null>(null);
    const startResize = (key: string, startX: number) => {
        const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120;

        const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(80, startWidth + (e.clientX - startX));
            setColumnWidths((prev) => {
                const updated = { ...prev, [key]: newWidth };
                localStorage.setItem(
                    'usa_validation_column_widths',
                    JSON.stringify(updated)
                );
                return updated;
            });
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const refreshProductsSilently = async () => {
        try {
            // Note: No setLoading(true) here!
            const validationData = await fetchAllRows<ValidationProduct>(
                'usa_validation_main_with_sellers',
                '*',
                { column: 'created_at', ascending: false }
            );


            setProducts(dedupeById(validationData));


        } catch (err) {
            console.error('Silent refresh error:', err);
            setToast({ message: 'Background refresh failed', type: 'error' });
        }
    };
    // ✅ ADD THIS DEBOUNCED VERSION
    const debouncedRefresh = useRef(
        debounce(async () => {
            await refreshProductsSilently();
            await fetchStats();
        }, 1500) // 1.5 second delay
    ).current;

    useEffect(() => {
        if (authLoading) return;

        fetchProducts(); // Runs once on mount (showing spinner)
        fetchStats();
        fetchConstants();

        // Realtime Subscription
        const channel = supabase
            .channel('validation-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usavalidationmainfile' }, () => {
                if (localEditCountRef.current > 0) return; // ✅ CHANGED: Skip if local edit in progress
                debouncedRefresh(); // ✅ CHANGED: Use debounced version
            })

            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_pass_file' }, () => fetchStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'usa_validation_fail_file' }, () => fetchStats())
            .subscribe();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshProductsSilently(); // ✅ NEW: Silent update on tab focus
                fetchStats();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [authLoading]); // ✅ FIXED: Removed 'activeTab' dependency

    // Clear search and filters when switching tabs
    useEffect(() => {
        setIsTabSwitching(true);
        setSearchQuery('');
        setFilters({ seller_tag: '', brand: '', funnel: '' });
        setSelectedIds(new Set());
        // setCurrentPage(1);
        setTimeout(() => setIsTabSwitching(false), 100);
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
            setToast({ message: 'Failed to load calculation settings', type: 'error' })
        }
    }

    const fetchStats = async () => {
        try {
            // Get all products from main file
            const mainData = await fetchAllRows<{ judgement: string | null }>(
                'usa_validation_main_file',
                'judgement'
            );

            const products = mainData || []

            // Count by judgement status
            const passed = products.filter(p => p.judgement === 'PASS').length
            const failed = products.filter(p => p.judgement === 'FAIL').length
            const pending = products.filter(p => !p.judgement || p.judgement === 'PENDING').length
            const rejected = products.filter(p => p.judgement === 'REJECT').length  // ← ADD THIS

            setStats({
                total: products.length,
                passed: passed,
                failed: failed,
                pending: pending,
                rejected: rejected   // ← ADD THIS
            })
        } catch (err) {
            console.error('Error fetching stats:', err)
            setToast({ message: 'Failed to load stats', type: 'error' })
        }
    }

    const fetchAllRows = async <T,>(
        table: string,
        select: string = '*',
        order?: { column: string; ascending?: boolean }
    ): Promise<T[]> => {
        const PAGE_SIZE = 1000;
        let from = 0;
        let allRows: T[] = [];

        while (true) {
            let query = supabase
                .from(table)
                .select(select)
                .range(from, from + PAGE_SIZE - 1);

            if (order) {
                query = query.order(order.column, {
                    ascending: order.ascending ?? false,
                });
            }

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) break;

            // ✅ TypeScript-safe narrowing
            allRows = allRows.concat(data as T[]);

            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }

        return allRows;
    };

    // ✅ Fetch History (The Sidebar Logic)
    const fetchHistory = async (asin: string) => {
        setSelectedHistoryAsin(asin);
        setHistoryLoading(true);
        try {
            // Fetch last 5 history entries
            const { data, error } = await supabase
                .from('usa_asin_history')
                .select('*')
                .eq('asin', asin)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setHistoryData(data || []);
        } catch (err) {
            console.error(err);
            setToast({ message: 'Failed to load history', type: 'error' });
        } finally {
            setHistoryLoading(false);
        }
    };


    const dedupeById = <T extends { id: string }>(rows: T[]): T[] => {
        const map = new Map<string, T>();
        for (const row of rows) {
            map.set(row.id, row); // latest wins
        }
        return Array.from(map.values());
    };


    const fetchProducts = async () => {
        setLoading(true);
        try {
            // Step 1: Fetch all validation products
            const validationData = await fetchAllRows<ValidationProduct>(
                'usa_validation_main_with_sellers',
                '*',
                { column: 'created_at', ascending: false }
            );

            // Step 2: Get all unique ASINs
            const asins = validationData.map(p => p.asin).filter(Boolean);

            setProducts(dedupeById(validationData));

        } catch (err) {
            console.error('Fetch error:', err);
            setToast({ message: 'Failed to load products. Please refresh.', type: 'error' });
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Cache filtered products per tab
    const tabProductsCache = useRef<Record<FileTab, ValidationProduct[]>>({
        main_file: [], pass_file: [], fail_file: [], pending: [], reject_file: []
    });

    // ✅ Add this useEffect to clear cache when products change
    useEffect(() => {
        // Clear cache when products array updates
        tabProductsCache.current = { main_file: [], pass_file: [], fail_file: [], pending: [], reject_file: [] };
    }, [products]);


    const handleCellEdit = async (id: string, field: string, value: any) => {
        localEditCountRef.current += 1;; // ✅ START local edit lock

        try {
            const tableName = 'usa_validation_main_file';

            // Update DB
            const { error } = await supabase
                .from(tableName)
                .update({ [field]: value })
                .eq('id', id);

            if (error) {
                setToast({ message: 'Failed to update', type: 'error' });
                return;
            }

            // Get current product snapshot
            const existingProduct = products.find((p) => p.id === id);

            if (existingProduct && activeTab === 'main_file') {
                const latestProduct: ValidationProduct = {
                    ...existingProduct,
                    [field]: value,
                };

                // ✅ Run calculation ONLY once per edit
                await autoCalculateAndUpdate(id, latestProduct);
            }

            // Update UI immediately
            // Update UI immediately
            setProducts((prev) =>
                prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
            );


        } catch (err) {
            console.error('Update error:', err);
            setToast({ message: 'Update failed', type: 'error' });
            await new Promise(resolve => setTimeout(resolve, 100));
        } finally {
            // ✅ RELEASE lock after short delay
            localEditCountRef.current -= 1;
        }
    };

    // STEP 1: Filter products
    const allFilteredProducts = useMemo(() => {
        let result = products;

        if (activeTab === 'pass_file') {
            result = products.filter((p) => p.judgement === 'PASS' && !p.sent_to_purchases);
        } else if (activeTab === 'fail_file') {
            result = products.filter(p => p.judgement === 'FAIL');
        } else if (activeTab === 'reject_file') {
            result = products.filter(p => p.judgement === 'REJECT');
        } else if (activeTab === 'pending' || activeTab === 'main_file') {
            result = products.filter(p => !p.judgement || p.judgement === 'PENDING');
        }

        // Search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (p) =>
                    p.asin?.toLowerCase().includes(query) ||
                    p.product_name?.toLowerCase().includes(query) ||
                    p.brand?.toLowerCase().includes(query)
            );
        }

        // Filters
        if (filters.seller_tag || filters.brand || filters.funnel) {
            result = result.filter((p) => {
                const sellerMatch = !filters.seller_tag ||
                    p.seller_tag?.toLowerCase().includes(filters.seller_tag.toLowerCase());
                const brandMatch = !filters.brand ||
                    p.brand?.toLowerCase().includes(filters.brand.toLowerCase());
                const funnelMatch = !filters.funnel ||
                    p.funnel?.toLowerCase().includes(filters.funnel.toLowerCase());

                return sellerMatch && brandMatch && funnelMatch;
            });
        }

        return result;
    }, [products, activeTab, searchQuery, filters]);

    // ✅ STEP 2: Paginate (only show 100 rows)
    const filteredProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return allFilteredProducts.slice(startIndex, endIndex);
    }, [allFilteredProducts, currentPage, rowsPerPage]);

    // ✅ STEP 3: Calculate total pages
    const totalPages = Math.ceil(allFilteredProducts.length / rowsPerPage);

    // 2. UPDATE the autoCalculateAndUpdate function around line 180
    const autoCalculateAndUpdate = async (id: string, product: ValidationProduct) => {
        try {
            if (!product.usd_price || !product.product_weight || !product.inr_purchase) {
                return;
            }

            const result = calculateProductValues(
                { usd_price: product.usd_price, product_weight: product.product_weight, inr_purchase: product.inr_purchase },
                constants,
                'USA'
            );

            const updateData: any = {};
            updateData.total_cost = result.total_cost !== null && isFinite(result.total_cost) ? Number(result.total_cost) : null;
            updateData.total_revenue = result.total_revenue !== null && isFinite(result.total_revenue) ? Number(result.total_revenue) : null;
            updateData.profit = result.profit !== null && isFinite(result.profit) ? Number(result.profit) : null;
            updateData.calculated_judgement = result.judgement || 'PENDING';
            updateData.judgement = 'PENDING';

            const { error: updateError } = await supabase
                .from('usa_validation_main_file')
                .update(updateData)
                .eq('id', id);

            if (updateError) {
                console.error('Auto-calc error', updateError);
                setToast({ message: 'Failed to update product calculation', type: 'error' });
                return;
            }

            setProducts((prev) =>
                prev.map((p) =>
                    p.id === id
                        ? {
                            ...p,
                            total_cost: result.total_cost,
                            total_revenue: result.total_revenue,
                            profit: result.profit,
                            judgement: 'PENDING',
                            calculated_judgement: result.judgement,
                        }
                        : p
                )
            );

            if (result.judgement === 'PASS') {
                setToast({ message: `✅ Judgement: PASS — Fill source link & press Enter to move`, type: 'success' });
            } else if (result.judgement === 'FAIL') {
                setToast({ message: `❌ Judgement: FAIL — Fill source link & press Enter to move`, type: 'error' });
            } else {
                setToast({ message: '✅ Updated successfully', type: 'success' });
            }
        } catch (err) {
            console.error('Exception in autoCalculateAndUpdate', err);
            setToast({ message: 'Calculation error occurred', type: 'error' });
        }
    };

    const handleUploadCSV = () => {
        fileInputRef.current?.click()
    }

    const processCSVFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            let rows: Record<string, string>[] = [];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
            } else {
                const text = (await file.text()).replace(/^\uFEFF/, '');
                rows = await new Promise((resolve) => {
                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results.data as Record<string, string>[]),
                    });
                });
            }

            if (rows.length === 0) {
                setToast({ message: 'File is empty', type: 'error' });
                return;
            }

            const rawHeaders = Object.keys(rows[0]);

            const headerMap: Record<string, string> = {};
            rawHeaders.forEach((h) => {
                const lower = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                if (lower === 'asin') headerMap['asin'] = h;
                else if (lower === 'productweight' || lower === 'weightg' || lower === 'weight') headerMap['product_weight'] = h;
                else if (lower === 'usdprice' || lower === 'usd') headerMap['usd_price'] = h;
                else if (lower === 'inrpurchase' || lower === 'inr') headerMap['inr_purchase'] = h;
                else if (lower === 'inrpurchaselink' || lower === 'sourcelink') headerMap['inr_purchase_link'] = h;
                else if (lower === 'remark' || lower === 'remarks') headerMap['remark'] = h;
                else if (lower === 'usalink' || lower === 'usa_link' || lower === 'uslink' || lower === 'amazon_link' || lower === 'amazonlink') headerMap['usalink'] = h;
            });

            if (!headerMap['asin']) {
                setToast({ message: 'File must have an ASIN column', type: 'error' });
                return;
            }


            const updates: { asin: string; product_weight?: number | null; usd_price?: number | null; inr_purchase?: number | null; inr_purchase_link?: string | null; remark?: string | null; usalink?: string | null }[] = [];

            for (const row of rows) {
                const asin = row[headerMap['asin']]?.toString().trim();
                if (!asin) continue;
                const update: any = { asin };
                if (headerMap['product_weight']) { const val = parseFloat(row[headerMap['product_weight']]); if (!isNaN(val)) update.product_weight = val; }
                if (headerMap['usd_price']) { const val = parseFloat(row[headerMap['usd_price']]); if (!isNaN(val)) update.usd_price = val; }
                if (headerMap['inr_purchase']) { const val = parseFloat(row[headerMap['inr_purchase']]); if (!isNaN(val)) update.inr_purchase = val; }
                if (headerMap['inr_purchase_link']) { const val = row[headerMap['inr_purchase_link']]?.toString().trim(); if (val) update.inr_purchase_link = val; }
                if (headerMap['remark']) { const val = row[headerMap['remark']]?.toString().trim(); if (val !== undefined) update.remark = val || null; }
                if (headerMap['usalink']) {
                    const val = row[headerMap['usalink']]?.toString().trim();
                    if (val) {
                        update.usalink = val.startsWith('http') ? val : `https://${val}`;
                    }
                }
                updates.push(update);
            }

            if (updates.length === 0) {
                setToast({ message: 'No valid rows found in file', type: 'warning' });
                return;
            }


            const productsByAsin = new Map<string, ValidationProduct>();
            products.forEach((p) => productsByAsin.set(p.asin, p));

            let updated = 0;
            let skipped = 0;
            let passCount = 0;
            let failCount = 0;
            const BATCH_SIZE = 50;

            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                const batch = updates.slice(i, i + BATCH_SIZE);
                const promises = batch.map(async (csvRow) => {
                    const existingProduct = productsByAsin.get(csvRow.asin);
                    if (!existingProduct) { skipped++; return; }

                    const mergedProduct: ValidationProduct = {
                        ...existingProduct,
                        product_weight: csvRow.product_weight ?? existingProduct.product_weight,
                        usd_price: csvRow.usd_price ?? existingProduct.usd_price,
                        inr_purchase: csvRow.inr_purchase ?? existingProduct.inr_purchase,
                        inr_purchase_link: csvRow.inr_purchase_link ?? existingProduct.inr_purchase_link,
                        remark: csvRow.remark !== undefined ? csvRow.remark : existingProduct.remark,
                        usa_link: csvRow.usalink ?? existingProduct.usa_link,
                    };

                    const dbUpdate: Record<string, any> = {};
                    if (csvRow.product_weight !== undefined) dbUpdate.product_weight = csvRow.product_weight;
                    if (csvRow.usd_price !== undefined) dbUpdate.usd_price = csvRow.usd_price;
                    if (csvRow.inr_purchase !== undefined) dbUpdate.inr_purchase = csvRow.inr_purchase;
                    if (csvRow.inr_purchase_link !== undefined) dbUpdate.inr_purchase_link = csvRow.inr_purchase_link;
                    if (csvRow.remark !== undefined) dbUpdate.remark = csvRow.remark;
                    if (csvRow.usalink !== undefined) dbUpdate.usa_link = csvRow.usalink;

                    const usdPrice = mergedProduct.usd_price;
                    const weight = mergedProduct.product_weight;
                    const inrPurchase = mergedProduct.inr_purchase;

                    if (usdPrice && usdPrice > 0 && weight && weight > 0 && inrPurchase && inrPurchase > 0) {
                        const result = calculateProductValues(
                            { usd_price: usdPrice, product_weight: weight, inr_purchase: inrPurchase },
                            constants,
                            'USA'
                        );
                        dbUpdate.total_cost = isFinite(result.total_cost) ? result.total_cost : null;
                        dbUpdate.total_revenue = isFinite(result.total_revenue) ? result.total_revenue : null;
                        dbUpdate.profit = isFinite(result.profit) ? result.profit : null;

                        const hasLink = mergedProduct.inr_purchase_link && mergedProduct.inr_purchase_link.trim() !== '';
                        if (hasLink) {
                            dbUpdate.judgement = result.judgement || 'PENDING';
                            dbUpdate.calculated_judgement = result.judgement || 'PENDING';
                            if (result.judgement === 'PASS') passCount++;
                            else if (result.judgement === 'FAIL') failCount++;
                        } else {
                            dbUpdate.judgement = 'PENDING';
                            dbUpdate.calculated_judgement = result.judgement || 'PENDING';
                        }
                    }

                    // ⚡ USA TABLE
                    const { error } = await supabase
                        .from('usa_validation_main_file')
                        .update(dbUpdate)
                        .eq('asin', csvRow.asin);

                    if (error) { console.error(`❌ Failed to update ${csvRow.asin}:`, error.message); skipped++; }
                    else { updated++; productsByAsin.set(csvRow.asin, { ...mergedProduct, ...dbUpdate }); }
                });
                await Promise.all(promises);
                if (i % 200 === 0 && i > 0) {
                    setToast({ message: `Processing... ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`, type: 'info' });
                }
            }

            setProducts((prev) => prev.map((p) => {
                const updatedProduct = productsByAsin.get(p.asin);
                return updatedProduct ? { ...p, ...updatedProduct } : p;
            }));
            await fetchStats();

            if (updated === 0) {
                setToast({ message: `⚠️ No matching ASINs found. ${skipped} skipped.`, type: 'warning' });
            } else {
                setToast({ message: `✅ ${updated} products updated from file`, type: 'success' });
                setTimeout(() => {
                    const movements: string[] = [];
                    if (passCount > 0) movements.push(`✅ ${passCount} moved to Pass File`);
                    if (failCount > 0) movements.push(`❌ ${failCount} moved to Fail File`);
                    const pendingCount = updated - passCount - failCount;
                    if (pendingCount > 0) movements.push(`⏳ ${pendingCount} still Pending`);
                    if (skipped > 0) movements.push(`⚠️ ${skipped} ASINs not found`);
                    setToast({ message: movements.join(' | '), type: passCount > 0 ? 'success' : failCount > 0 ? 'error' : 'info' });
                }, 2000);
            }
        } catch (err) {
            console.error('File processing error:', err);
            setToast({ message: 'Failed to process file', type: 'error' });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

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

    const handleChecklistOk = (id: string) => {
        const product = products.find(p => p.id === id)
        if (!product) return

        setConfirmDialog({
            title: 'Send to Purchases',
            message: 'Send this item to Purchases?',
            confirmText: 'Send',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);

                // ✅ LOGIC: Resolve Journey ID (Start Cycle 1 if missing)
                // If it's a reorder, it will already have current_journey_id from the DB
                const journeyId = product.current_journey_id || generateUUID()
                const journeyNum = product.journey_number || 1

                try {
                    // ✅ STEP 1: Snapshot to History (The "Bag")
                    const snapshotData = {
                        source: 'validation_pass',
                        usd_price: product.usd_price,
                        inr_purchase: product.inr_purchase,
                        product_weight: product.product_weight,
                        profit: product.profit,
                        total_cost: product.total_cost,
                        total_revenue: product.total_revenue,
                        origin_india: product.origin_india,
                        origin_china: product.origin_china,
                        remark: product.remark,
                        timestamp: new Date().toISOString()
                    }

                    const { error: historyError } = await supabase
                        .from('usa_asin_history')
                        .insert({
                            asin: product.asin,
                            journey_id: journeyId,
                            journey_number: journeyNum,
                            stage: 'validation_to_purchase',
                            snapshot_data: snapshotData,
                            profit: product.profit,
                            total_cost: product.total_cost,
                            status: 'passed'
                        })

                    if (historyError) {
                        console.error('History snapshot failed:', historyError)
                        // We don't stop the flow for history error, but we log it
                    }

                    // ✅ STEP 2: Insert into Purchases with Journey ID
                    const originText =
                        (product.origin_india && product.origin_china) ? 'Both' :
                            product.origin_china ? 'China' :
                                product.origin_india ? 'India' : 'India';

                    const { error: insertError } = await supabase
                        .from('usa_purchases')
                        .insert({
                            asin: product.asin,
                            product_name: product.product_name,
                            brand: product.brand,
                            seller_tag: product.seller_tag,
                            funnel: product.funnel,
                            origin: originText,
                            origin_india: product.origin_india ?? false,
                            origin_china: product.origin_china ?? false,
                            product_link: product.usa_link,
                            target_price: product.inr_purchase,
                            target_quantity: 1,
                            funnel_quantity: 1,
                            funnel_seller: product.funnel,
                            inr_purchase_link: product.inr_purchase_link ?? '',
                            buying_price: null,
                            buying_quantity: null,
                            seller_link: null,
                            seller_phone: '',
                            payment_method: '',
                            tracking_details: '',
                            delivery_date: null,
                            status: 'pending',
                            admin_confirmed: false,
                            product_weight: product.product_weight,
                            usd_price: product.usd_price,
                            inr_purchase: product.inr_purchase,
                            profit: product.profit ?? null,
                            remark: product.remark ?? null,

                            // 🔗 LINKING THE CYCLE
                            journey_id: journeyId,
                            journey_number: journeyNum
                        })

                    if (insertError) {
                        console.error('Insert error:', insertError)
                        setToast({ message: `Failed: ${insertError.message}`, type: 'error' })
                        return
                    }

                    // ✅ STEP 3: Mark as sent in main file
                    // We also save the generated journey_id back to validation file for consistency
                    const { error: updateError } = await supabase
                        .from('usa_validation_main_file')
                        .update({
                            sent_to_purchases: true,
                            sent_to_purchases_at: new Date().toISOString(),
                            current_journey_id: journeyId, // Persist ID if we just generated it
                            journey_number: journeyNum
                        })
                        .eq('id', id)

                    if (updateError) {
                        console.error('Update error:', updateError)
                    }

                    // Remove from local state
                    setProducts((prev) => prev.filter((p) => p.id !== id))
                    setToast({ message: 'Sent to Purchases with History!', type: 'success' })

                } catch (err) {
                    console.error('Unexpected error:', err)
                    setToast({ message: 'An unexpected error occurred', type: 'error' })
                }
            }
        });
    }

    const handleMoveToMainClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Main File',
            message: `Move ${selectedIds.size} items back to Main File? This will reset their data for re-validation.`,
            confirmText: 'Move',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);

                try {
                    const idsArray = Array.from(selectedIds);


                    // Use CORRECT database field names (snake_case with underscores)
                    const { error } = await supabase
                        .from('usa_validation_main_file')
                        .update({
                            judgement: 'PENDING',
                            calculated_judgement: null,
                            check_brand: false,
                            check_item_expire: false,
                            check_small_size: false,
                            check_multi_seller: false,
                            origin_india: false,
                            origin_china: false,
                            sent_to_purchases: false,
                            sent_to_purchases_at: null,
                        })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }


                    // Immediate UI update
                    setProducts((prev) =>
                        prev.map((p) =>
                            selectedIds.has(p.id)
                                ? {
                                    ...p,
                                    judgement: 'PENDING',
                                    calculated_judgement: null,
                                    check_brand: false,
                                    check_item_expire: false,
                                    check_small_size: false,
                                    check_multi_seller: false,
                                    origin_india: false,
                                    origin_china: false,
                                    sent_to_purchases: false,
                                    sent_to_purchases_at: undefined,
                                }
                                : p
                        )
                    );
                    // setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
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
            }
        });
    };

    // Move items from Pending to Pass
    const handleMoveToPassClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Pass',
            message: `Move ${selectedIds.size} items to Pass File?`,
            confirmText: 'Move',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);

                try {
                    const idsArray = Array.from(selectedIds);


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
                    setProducts((prev) =>
                        prev.map((p) =>
                            selectedIds.has(p.id)
                                ? {
                                    ...p,
                                    judgement: 'PENDING',
                                    calculated_judgement: null,
                                    check_brand: false,
                                    check_item_expire: false,
                                    check_small_size: false,
                                    check_multi_seller: false,
                                    origin_india: false,
                                    origin_china: false,
                                    sent_to_purchases: false,
                                    sent_to_purchases_at: undefined,
                                }
                                : p
                        )
                    );
                    // setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
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
            }
        });
    };

    // Move items from Pending to Fail
    const handleMoveToFailClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Fail',
            message: `Move ${selectedIds.size} items to Fail File?`,
            confirmText: 'Move to Fail',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);

                try {
                    const idsArray = Array.from(selectedIds);


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
                    setProducts((prev) =>
                        prev.map((p) =>
                            selectedIds.has(p.id)
                                ? {
                                    ...p,
                                    judgement: 'PENDING',
                                    calculated_judgement: null,
                                    check_brand: false,
                                    check_item_expire: false,
                                    check_small_size: false,
                                    check_multi_seller: false,
                                    origin_india: false,
                                    origin_china: false,
                                    sent_to_purchases: false,
                                    sent_to_purchases_at: undefined,
                                }
                                : p
                        )
                    );
                    // setFilteredProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
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
            }
        });
    };

    // Move items to Reject
    const handleMoveToRejectClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Rejected',
            message: `Move ${selectedIds.size} items to Rejected?`,
            confirmText: 'Reject',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);

                try {
                    const idsArray = Array.from(selectedIds);

                    const { error } = await supabase
                        .from('usa_validation_main_file')
                        .update({ judgement: 'REJECT' })
                        .in('id', idsArray);

                    if (error) throw error;

                    setProducts(prev =>
                        prev.map(p =>
                            selectedIds.has(p.id) ? { ...p, judgement: 'REJECT' } : p
                        )
                    );
                    setSelectedIds(new Set());
                    setToast({ message: `Successfully moved ${idsArray.length} items to Rejected!`, type: 'success' });

                    await fetchStats();

                } catch (err) {
                    console.error('Move to reject error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                }
            }
        });
    };

    const downloadCSV = (mode: 'selected' | 'page' | 'all') => {
        let dataToDownload: ValidationProduct[] = [];
        let label = '';

        if (mode === 'selected') {
            dataToDownload = allFilteredProducts.filter(p => selectedIds.has(p.id));
            label = `${dataToDownload.length} selected`;
        } else if (mode === 'page') {
            dataToDownload = filteredProducts;
            label = `page ${currentPage}`;
        } else {
            dataToDownload = allFilteredProducts;
            label = `all ${dataToDownload.length}`;
        }

        if (dataToDownload.length === 0) {
            setToast({ message: 'No data to download', type: 'warning' });
            return;
        }

        const headers = Object.keys(visibleColumns).filter(
            col => visibleColumns[col as keyof typeof visibleColumns]
        );

        const csvContent = [
            headers.join(','),
            ...dataToDownload.map(product =>
                headers.map(header => {
                    const value = product[header as keyof ValidationProduct];
                    return value != null ? `"${String(value).replace(/"/g, '""')}"` : '';
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usa_validation_${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        setToast({
            message: `✅ Downloaded ${dataToDownload.length} products (${label})`,
            type: 'success'
        });
        setIsDownloadDropdownOpen(false);
    };

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
            <div className="h-screen flex flex-col overflow-hidden bg-[#111111] p-6 text-gray-100 font-sans selection:bg-orange-400/30">
                <div className="w-full flex flex-col flex-1 overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="flex-none">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-3xl font-bold text-white">USA Selling - Validation</h1>
                            <p className="text-gray-400 mt-1">Manage validation files and product status</p>
                        </div>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl px-5 py-4 text-white shadow-lg border border-white/[0.1]">
                                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Products</div>
                                <div className="text-3xl font-bold mt-1">{stats.total}</div>
                            </div>

                            <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-900/20 rounded-xl px-5 py-4 text-emerald-100 shadow-lg border border-emerald-500/20">
                                <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">✓ Passed</div>
                                <div className="text-3xl font-bold mt-1 text-white">{stats.passed}</div>
                            </div>

                            <div className="bg-gradient-to-br from-rose-900/50 to-rose-900/20 rounded-xl px-5 py-4 text-rose-100 shadow-lg border border-rose-500/20">
                                <div className="text-xs font-medium text-rose-400 uppercase tracking-wider">✗ Failed</div>
                                <div className="text-3xl font-bold mt-1 text-white">{stats.failed}</div>
                            </div>

                            <div className="bg-gradient-to-br from-amber-900/50 to-amber-900/20 rounded-xl px-5 py-4 text-amber-100 shadow-lg border border-amber-500/20">
                                <div className="text-xs font-medium text-amber-400 uppercase tracking-wider">⏳ Pending</div>
                                <div className="text-3xl font-bold mt-1 text-white">{stats.pending}</div>
                            </div>
                            <div className="bg-gradient-to-br from-violet-900/50 to-violet-900/20 rounded-xl px-5 py-4 text-violet-100 shadow-lg border border-violet-500/20">
                                <div className="text-xs font-medium text-violet-400 uppercase tracking-wider">Rejected</div>
                                <div className="text-3xl font-bold mt-1 text-white">{stats.rejected}</div>
                            </div>
                        </div>

                        {/* File Tabs */}
                        <div className="flex gap-2 mb-5 flex-wrap p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-fit">
                            {[
                                { id: 'main_file', label: 'Main File' },
                                { id: 'pass_file', label: 'Pass File' },
                                { id: 'fail_file', label: 'Failed File' },
                                { id: 'reject_file', label: 'Rejected' },
                                { id: 'pending', label: 'Pending' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as FileTab)}
                                    className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-all relative overflow-hidden ${activeTab === tab.id
                                        ? 'bg-orange-500 text-white font-semibold shadow-sm'
                                        : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between gap-3">
                                {/* LEFT SIDE - Search + Filter */}
                                <div className="flex gap-3 flex-1 min-w-[300px]">
                                    {/* Search Bar */}
                                    <div className="relative flex-1 max-w-md group">
                                        <svg
                                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            placeholder="Search by ASIN, Product Name, or Brand..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-10 py-2.5 text-sm bg-[#111111] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600 transition-all shadow-sm"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-200"
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
                                            className="px-3 py-1.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] hover:text-white border border-white/[0.1] text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors shadow-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                            </svg>
                                            Add Filter
                                        </button>

                                        {isFilterOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)}></div>
                                                <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-4 z-20 w-72 animate-in fade-in zoom-in-95 duration-200">
                                                    <h3 className="font-semibold text-gray-100 mb-3">Filter Products</h3>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-400 mb-1">Seller Tag</label>
                                                            <input
                                                                type="text"
                                                                value={filters.seller_tag}
                                                                onChange={(e) => setFilters({ ...filters, seller_tag: e.target.value })}
                                                                className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-gray-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-slate-600"
                                                                placeholder="Enter seller name"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-400 mb-1">Brand</label>
                                                            <input
                                                                type="text"
                                                                value={filters.brand}
                                                                onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
                                                                className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-gray-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-slate-600"
                                                                placeholder="Enter brand"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-400 mb-1">Funnel</label>
                                                            <input
                                                                type="text"
                                                                value={filters.funnel}
                                                                onChange={(e) => setFilters({ ...filters, funnel: e.target.value })}
                                                                className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-gray-100 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-slate-600"
                                                                placeholder="Enter funnel"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => setFilters({ seller_tag: '', brand: '', funnel: '' } as Filters)}
                                                            className="w-full px-3 py-2 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] hover:text-white font-medium text-sm transition-colors"
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
                                    {/* Move to Main */}
                                    {(activeTab === 'pass_file' || activeTab === 'fail_file' || activeTab === 'reject_file') && (
                                        <button onClick={handleMoveToMainClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-sm ${selectedIds.size === 0
                                                ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                                : 'bg-[#1a1a1a] text-white hover:bg-slate-600 border border-white/[0.1]'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            Move to Main
                                        </button>
                                    )}

                                    {/* Move to Pass */}
                                    {/* {activeTab === 'pending' && (
                                            <button
                                                onClick={handleMoveToPassClick}
                                                disabled={selectedIds.size === 0}
                                                className={`px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-emerald-900/20 ${selectedIds.size === 0
                                                    ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-500 border border-emerald-500'
                                                    }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Move to Pass
                                            </button>
                                        )} */}

                                    {/* Move to Fail */}
                                    {/* {activeTab === 'pending' && (
                                            <button
                                                onClick={handleMoveToFailClick}
                                                disabled={selectedIds.size === 0}
                                                className={`px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-rose-900/20 ${selectedIds.size === 0
                                                    ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                                    : 'bg-rose-600 text-white hover:bg-rose-500 border border-rose-500'
                                                    }`}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Move to Fail
                                            </button>
                                        )} */}

                                    {(activeTab === 'pending' || activeTab === 'main_file' || activeTab === 'pass_file') && (
                                        <button
                                            onClick={handleMoveToRejectClick}
                                            disabled={selectedIds.size === 0}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-violet-900/20 ${selectedIds.size === 0
                                                ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                                : 'bg-violet-600 text-white hover:bg-violet-500 border border-violet-500'
                                                }`}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                            Move to Reject
                                        </button>
                                    )}

                                    {/* Download CSV Dropdown */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            Download CSV
                                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {isDownloadDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsDownloadDropdownOpen(false)} />
                                                <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-2 z-20 w-56 animate-in fade-in zoom-in-95 duration-200">

                                                    {selectedIds.size > 0 && (
                                                        <button
                                                            onClick={() => downloadCSV('selected')}
                                                            className="w-full px-3 py-1.5 text-left text-sm text-gray-100 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                                                        >
                                                            <span>📋 Download Selected</span>
                                                            <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => downloadCSV('page')}
                                                        className="w-full px-3 py-1.5 text-left text-sm text-gray-100 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                                                    >
                                                        <span>📄 Download Page</span>
                                                        <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                                                    </button>

                                                    <button
                                                        onClick={() => downloadCSV('all')}
                                                        className="w-full px-3 py-1.5 text-left text-sm text-gray-100 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
                                                    >
                                                        <span>📦 Download All</span>
                                                        <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{allFilteredProducts.length}</span>
                                                    </button>

                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Upload CSV */}
                                    <button
                                        onClick={handleUploadCSV}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-blue-900/20 transition-all border border-blue-500/50"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Upload CSV
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={processCSVFile} className="hidden" />

                                    {/* Bulk USA Price Update */}
                                    <button
                                        onClick={() => usaPriceCSVInputRef.current?.click()}
                                        className="px-3 py-1.5 bg-orange-500 text-white rounded-xl hover:bg-orange-400 text-sm font-medium whitespace-nowrap shadow-lg shadow-orange-500/10 transition-all border border-orange-500/50"
                                    >
                                        Bulk USA Price Update
                                    </button>
                                    <input type="file" accept=".csv" ref={usaPriceCSVInputRef} onChange={handleUSAPriceCSVUpload} className="hidden" />

                                    {/* Configure Constants */}
                                    <button
                                        onClick={openConstantsModal}
                                        className="px-3 py-1.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-purple-900/20 transition-all border border-purple-500/50"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        Configure Constants
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Table Section - ONLY THIS SCROLLS */}
                    <div className="flex-1 min-h-0 bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col border border-white/[0.1]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-16">
                                <div className="relative">
                                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500/30"></div>
                                    <div className="absolute top-0 left-0 inline-block animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-indigo-500"></div>
                                </div>
                                <p className="mt-4 text-gray-400 font-medium tracking-wide animate-pulse">Loading products...</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                                <svg className="w-16 h-16 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-lg font-semibold text-gray-400 mb-2">No products found</p>
                                <p className="text-sm text-gray-300 max-w-md text-center">
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
                                <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                                    {/* ✅ ADD THIS LOADING OVERLAY */}
                                    {isTabSwitching && (
                                        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center z-50">
                                            <div className="flex items-center gap-3 bg-[#111111] px-6 py-4 rounded-xl shadow-2xl border border-white/[0.1]">
                                                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                                                <span className="text-gray-100 font-semibold">
                                                    Loading {activeTab.replace('_', ' ')}...
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <table className="w-full table-auto max-w-full">
                                        <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10 shadow-md">

                                            <tr>
                                                {/* ✅ Fixed width for checkbox to prevent overlap */}
                                                <th className="px-6 py-4 text-left bg-[#111111] sticky left-0 z-20" style={{ width: '50px', minWidth: '50px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                                        className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                                                    />
                                                </th>

                                                {/* ✅ Resizable Columns */}
                                                {visibleColumns.asin && <ResizableTH width={columnWidths.asin} columnKey="asin" label="ASIN" onResizeStart={startResize} />}
                                                {/* ✅ HISTORY COLUMN */}
                                                {/* HISTORY COLUMN */}
                                                <ResizableTH
                                                    width={columnWidths.history}
                                                    columnKey="history"
                                                    label="HISTORY"
                                                    onResizeStart={startResize}
                                                />
                                                {visibleColumns.product_name && <ResizableTH width={columnWidths.product_name} columnKey="product_name" label="Product Name" onResizeStart={startResize} />}
                                                {visibleColumns.brand && <ResizableTH width={columnWidths.brand} columnKey="brand" label="Brand" onResizeStart={startResize} />}
                                                {visibleColumns.seller_tag && <ResizableTH width={columnWidths.seller_tag} columnKey="seller_tag" label="Seller Tag" onResizeStart={startResize} />}
                                                {visibleColumns.funnel && <ResizableTH width={columnWidths.funnel} columnKey="funnel" label="Funnel" onResizeStart={startResize} />}
                                                {visibleColumns.no_of_seller && <ResizableTH width={columnWidths.no_of_seller} columnKey="no_of_seller" label="Sellers" onResizeStart={startResize} />}
                                                {visibleColumns.usa_link && <ResizableTH width={columnWidths.usa_link} columnKey="usa_link" label="USA" onResizeStart={startResize} />}

                                                {activeTab === 'pass_file' && <ResizableTH width={110} columnKey="origin" label="Origin" onResizeStart={startResize} />}

                                                {visibleColumns.product_weight && <ResizableTH width={columnWidths.product_weight} columnKey="product_weight" label="Weight (g)" onResizeStart={startResize} />}
                                                {visibleColumns.usd_price && <ResizableTH width={columnWidths.usd_price} columnKey="usd_price" label="USD $" onResizeStart={startResize} />}
                                                {visibleColumns.inr_purchase && <ResizableTH width={columnWidths.inr_purchase} columnKey="inr_purchase" label="INR ₹" onResizeStart={startResize} />}

                                                {visibleColumns.inr_purchase_link && activeTab === 'main_file' && <ResizableTH width={columnWidths.inr_purchase_link} columnKey="inr_purchase_link" label="Source Link" onResizeStart={startResize} />}

                                                {activeTab === 'pass_file' && <ResizableTH width={160} columnKey="checklist" label="Checklist" onResizeStart={startResize} />}

                                                {visibleColumns.judgement && <ResizableTH width={columnWidths.judgement} columnKey="judgement" label="Status" onResizeStart={startResize} />}
                                                {visibleColumns.remark && <ResizableTH width={columnWidths.remark} columnKey="remark" label="Remark" align="center" onResizeStart={startResize} />}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-white/[0.06]">
                                            {filteredProducts.map((product) => (
                                                <tr key={product.id} className="hover:bg-[#1a1a1a]/50 transition-colors">
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(product.id)}
                                                            onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                            className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                                                        />
                                                    </td>

                                                    {/* Column 1: ASIN only (no icon) */}
                                                    {visibleColumns.asin && (
                                                        <td className="p-3 font-mono text-sm text-gray-300">
                                                            {product.asin}
                                                        </td>
                                                    )}

                                                    {/* Column 2: History icon only (no ASIN) */}
                                                    <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                                                        <button
                                                            onClick={() => fetchHistory(product.asin)}
                                                            className="p-2 rounded-full hover:bg-white/[0.08] text-gray-400 hover:text-orange-500 transition-colors"
                                                            title="View Journey History"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
                                                    </td>

                                                    {visibleColumns.product_name && (
                                                        <td style={{ width: columnWidths.product_name, maxWidth: columnWidths.product_name }} className="p-3 border-b border-white/[0.1]">
                                                            {/* ✅ Truncate long names */}
                                                            <div className="truncate max-w-full text-gray-500 text-xs" title={product.product_name || ''}>
                                                                {product.product_name || '-'}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {visibleColumns.brand && <td className="p-3 text-gray-300">{product.brand || '-'}</td>}
                                                    {visibleColumns.seller_tag && <td className="p-3">{renderSellerTags(product.seller_tag)}</td>}
                                                    {visibleColumns.funnel && <td className="p-3">{renderFunnelBadge(product.funnel)}</td>}
                                                    {visibleColumns.no_of_seller && <td className="p-3 text-gray-300">{product.no_of_seller || '-'}</td>}

                                                    {visibleColumns.usa_link && (
                                                        <td className="p-3 overflow-hidden text-center">
                                                            {product.usa_link ? (
                                                                <a
                                                                    href={product.usa_link?.startsWith('http') ? product.usa_link : `https://${product.usa_link}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-orange-500 hover:text-orange-400 hover:underline text-sm truncate block"
                                                                >
                                                                    View
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-300 text-xs">-</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {activeTab === 'pass_file' && (
                                                        <td className="p-3">
                                                            <div className="flex flex-col gap-1 text-sm text-gray-300">
                                                                <label className="flex items-center gap-2">
                                                                    <input type="checkbox" checked={!!product.origin_india} onChange={(e) => handleOriginToggle(product.id, 'origin_india', e.target.checked)} className="rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                    India
                                                                </label>
                                                                <label className="flex items-center gap-2">
                                                                    <input type="checkbox" checked={!!product.origin_china} onChange={(e) => handleOriginToggle(product.id, 'origin_china', e.target.checked)} className="rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                    China
                                                                </label>
                                                            </div>
                                                        </td>
                                                    )}

                                                    {visibleColumns.product_weight && (
                                                        <td className="p-3 text-gray-300">
                                                            {activeTab === 'main_file' ? (
                                                                <input
                                                                    type="number"
                                                                    key={product.id}
                                                                    defaultValue={product.product_weight ?? ''}
                                                                    onBlur={(e) =>
                                                                        handleCellEdit(product.id, 'product_weight', Number(e.target.value) || null)
                                                                    }
                                                                    className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                />
                                                            ) : (
                                                                product.product_weight ?? '-'
                                                            )}

                                                        </td>
                                                    )}

                                                    {visibleColumns.usd_price && (
                                                        <td className="p-3 text-gray-300">
                                                            {activeTab === 'main_file' ? (
                                                                <input
                                                                    type="text"
                                                                    key={product.id}
                                                                    defaultValue={product.usd_price ?? ''}
                                                                    onBlur={(e) => {
                                                                        const parsed = parseCurrency(e.target.value);
                                                                        handleCellEdit(product.id, 'usd_price', parsed);
                                                                    }}
                                                                    className="w-28 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                />
                                                            ) : (
                                                                formatUSD(product.usd_price)
                                                            )}

                                                        </td>
                                                    )}

                                                    {visibleColumns.inr_purchase && (
                                                        <td className="p-3 text-gray-300">
                                                            {activeTab === 'main_file' ? (
                                                                <input
                                                                    type="text"
                                                                    key={product.id}
                                                                    defaultValue={product.inr_purchase ?? ''}
                                                                    onBlur={(e) => {
                                                                        const parsed = parseCurrency(e.target.value);
                                                                        handleCellEdit(product.id, 'inr_purchase', parsed);
                                                                    }}
                                                                    className="w-32 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                                                />
                                                            ) : (
                                                                formatINR(product.inr_purchase)
                                                            )}

                                                        </td>
                                                    )}

                                                    {visibleColumns.inr_purchase_link && activeTab === 'main_file' && (
                                                        <td className="px-6 py-4 text-sm overflow-hidden">
                                                            <input
                                                                type="url"
                                                                value={product.inr_purchase_link || ''}
                                                                onChange={(e) => handleCellEdit(product.id, 'inr_purchase_link', e.target.value)}
                                                                onKeyDown={async (e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        const link = (e.target as HTMLInputElement).value.trim();
                                                                        if (!link) { setToast({ message: '⚠️ Please enter a source link first', type: 'warning' }); return; }
                                                                        const currentProduct = products.find((p) => p.id === product.id);
                                                                        if (!currentProduct) return;
                                                                        if (!currentProduct.usd_price || !currentProduct.product_weight || !currentProduct.inr_purchase) {
                                                                            setToast({ message: '⚠️ Fill Weight, USD & INR first', type: 'warning' }); return;
                                                                        }
                                                                        const result = calculateProductValues(
                                                                            { usd_price: currentProduct.usd_price, product_weight: currentProduct.product_weight, inr_purchase: currentProduct.inr_purchase },
                                                                            constants, 'USA'
                                                                        );
                                                                        const finalJudgement = result.judgement || 'PENDING';
                                                                        const { error } = await supabase
                                                                            .from('usa_validation_main_file')
                                                                            .update({
                                                                                inr_purchase_link: link, judgement: finalJudgement, calculated_judgement: finalJudgement,
                                                                                total_cost: isFinite(result.total_cost) ? result.total_cost : null,
                                                                                total_revenue: isFinite(result.total_revenue) ? result.total_revenue : null,
                                                                                profit: isFinite(result.profit) ? result.profit : null,
                                                                            })
                                                                            .eq('id', product.id);
                                                                        if (error) { setToast({ message: '❌ Failed to finalize', type: 'error' }); return; }
                                                                        setProducts((prev) => prev.map((p) => p.id === product.id
                                                                            ? {
                                                                                ...p, inr_purchase_link: link, judgement: finalJudgement, calculated_judgement: finalJudgement,
                                                                                total_cost: result.total_cost, total_revenue: result.total_revenue, profit: result.profit
                                                                            } : p));
                                                                        await fetchStats();
                                                                        if (finalJudgement === 'PASS') setToast({ message: `✅ ${currentProduct.asin} → Pass File!`, type: 'success' });
                                                                        else if (finalJudgement === 'FAIL') setToast({ message: `❌ ${currentProduct.asin} → Fail File!`, type: 'error' });
                                                                    }
                                                                }}
                                                                placeholder="Enter link + press Enter ↵"
                                                                className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 truncate"
                                                            />
                                                        </td>
                                                    )}

                                                    {activeTab === 'pass_file' && (
                                                        <td className="p-3">
                                                            {/* ✅ FIX: Require Checklist AND Origin to show OK button */}
                                                            {product.check_brand &&
                                                                product.check_item_expire &&
                                                                product.check_small_size &&
                                                                product.check_multi_seller &&
                                                                (product.origin_india || product.origin_china) ? (
                                                                <button
                                                                    onClick={() => handleChecklistOk(product.id)}
                                                                    className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
                                                                >
                                                                    OK
                                                                </button>
                                                            ) : (
                                                                <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                                                                    {/* ... existing checkboxes ... */}
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors" title="Brand Checking">
                                                                        <input type="checkbox" checked={!!product.check_brand} onChange={(e) => handleChecklistToggle(product.id, 'check_brand', e.target.checked)} className="w-3 h-3 rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                        <span>Brand</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors" title="Item Expire">
                                                                        <input type="checkbox" checked={!!product.check_item_expire} onChange={(e) => handleChecklistToggle(product.id, 'check_item_expire', e.target.checked)} className="w-3 h-3 rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                        <span>Expire</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors" title="Small Size">
                                                                        <input type="checkbox" checked={!!product.check_small_size} onChange={(e) => handleChecklistToggle(product.id, 'check_small_size', e.target.checked)} className="w-3 h-3 rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                        <span>Size</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1 cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors" title="Multi Sellers">
                                                                        <input type="checkbox" checked={!!product.check_multi_seller} onChange={(e) => handleChecklistToggle(product.id, 'check_multi_seller', e.target.checked)} className="w-3 h-3 rounded border-white/[0.1] bg-[#111111] text-orange-500" />
                                                                        <span>Multi</span>
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    {visibleColumns.judgement && (
                                                        <td className="p-3">
                                                            {(() => {
                                                                // Use calculated judgement for visual feedback, fallback to DB judgement
                                                                const displayJudgement = product.calculated_judgement || product.judgement;

                                                                return displayJudgement ? (
                                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${displayJudgement === 'PASS' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                                        displayJudgement === 'FAIL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                                            displayJudgement === 'PENDING' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                                                                'bg-[#1a1a1a] text-gray-500'
                                                                        }`}>
                                                                        {displayJudgement}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">PENDING</span>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    {/* ✅ REMARK COLUMN */}
                                                    {visibleColumns.remark && (
                                                        <td className="p-3 text-center">
                                                            {product.remark ? (
                                                                <button
                                                                    onClick={() => setSelectedRemark(product.remark)}
                                                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                                                >
                                                                    View
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-300">-</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {allFilteredProducts.length > rowsPerPage && (
                                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.1] bg-[#111111]">
                                        <div className="text-sm text-gray-300">
                                            Showing <span className="font-bold text-gray-100">{filteredProducts.length}</span> of <span className="font-bold text-gray-100">{allFilteredProducts.length}</span> products
                                            {selectedIds.size > 0 && (
                                                <span className="ml-4">
                                                    (<span className="font-bold text-orange-500">{selectedIds.size}</span> selected)
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border border-white/[0.1]"
                                            >
                                                First
                                            </button>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border border-white/[0.1]"
                                            >
                                                Previous
                                            </button>

                                            <span className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-semibold">
                                                Page {currentPage} of {totalPages}
                                            </span>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border border-white/[0.1]"
                                            >
                                                Next
                                            </button>

                                            <button
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border border-white/[0.1]"
                                            >
                                                Last
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Footer Stats - Fixed at bottom of table
                                <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3">
                                    <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
                                        <span className="font-medium">
                                            Showing <span className="font-bold text-gray-100">{filteredProducts.length}</span> of <span className="font-bold text-gray-100">{products.length}</span> products
                                        </span>
                                        {selectedIds.size > 0 && (
                                            <span className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full font-semibold border border-orange-500/30">
                                                {selectedIds.size} selected
                                            </span>
                                        )}
                                    </div>
                                </div> */}
                            </>
                        )}
                    </div>
                </div>

                {/* Constants Configuration Modal */}
                {isConstantsModalOpen && (
                    <>
                        <div className="fixed inset-0 bg-[#111111] z-40" onClick={() => setIsConstantsModalOpen(false)} />
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full border border-white/[0.1] overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-6">
                                    <h2 className="text-2xl font-bold">Calculation Constants Configuration</h2>
                                    <p className="text-purple-100 mt-1 opacity-80">Update global constants for automatic calculations</p>
                                </div>

                                <div className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Dollar Rate (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.dollar_rate}
                                            onChange={(e) => setConstants({ ...constants, dollar_rate: parseFloat(e.target.value) || 90 })}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Bank Fee (%)</label>
                                        <input
                                            type="number"
                                            value={constants.bank_conversion_rate * 100}
                                            onChange={(e) => setConstants({ ...constants, bank_conversion_rate: parseFloat(e.target.value) / 100 || 0.02 })}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Shipping per 1000g (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.shipping_charge_per_kg}
                                            onChange={(e) => setConstants({ ...constants, shipping_charge_per_kg: parseFloat(e.target.value) || 950 })}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div className="p-6 border-t border-white/[0.1] bg-[#1a1a1a] flex items-center justify-end gap-3">
                                    <button
                                        onClick={() => setIsConstantsModalOpen(false)}
                                        className="px-5 py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] font-medium transition-colors border border-white/[0.1]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveConstants}
                                        disabled={isSavingConstants}
                                        className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
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
                            {/* Header */}
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Journey History</h2>
                                    <p className="text-sm text-gray-300 font-mono mt-1">{selectedHistoryAsin}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedHistoryAsin(null)}
                                    className="p-2 hover:bg-[#111111] rounded-full text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Timeline */}
                            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                                {historyLoading ? (
                                    <div className="flex justify-center py-10">
                                        <Loader2 className="animate-spin w-8 h-8 text-orange-500" />
                                    </div>
                                ) : historyData.length === 0 ? (
                                    <div className="text-center text-gray-500 py-10">
                                        No history found for this item.
                                    </div>
                                ) : (
                                    historyData.map((snapshot, idx) => (
                                        <div
                                            key={snapshot.id}
                                            className="relative pl-6 border-l-2 border-orange-500/30 last:border-0 pb-6"
                                        >
                                            {/* Timeline Dot */}
                                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#111111] border-2 border-orange-500" />

                                            {/* Card */}
                                            <div className="bg-[#1a1a1a]/50 rounded-xl p-4 border border-white/[0.1] hover:border-orange-500/30 transition-colors">
                                                {/* Journey Info */}
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">
                                                        Journey #{snapshot.journey_number}
                                                    </span>
                                                    <span className="text-xs text-gray-300">
                                                        {new Date(snapshot.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                {/* Stage Name */}
                                                <h3 className="text-sm font-semibold text-white mb-2 capitalize">
                                                    {snapshot.stage.replace(/_/g, ' ')}
                                                </h3>

                                                {/* Snapshot Details */}
                                                <div className="space-y-1 text-xs text-gray-300">
                                                    {snapshot.profit && (
                                                        <div className="flex justify-between">
                                                            <span>Profit:</span>
                                                            <span className={snapshot.profit > 0 ? 'text-emerald-400' : 'text-rose-400'}>
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

                                                    {snapshot.total_cost && (
                                                        <div className="flex justify-between">
                                                            <span>Total Cost:</span>
                                                            <span>₹{snapshot.total_cost}</span>
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
            {/* ✅ REMARK MODAL */}
            {selectedRemark && (
                <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Remark Details</h3>
                            <button
                                onClick={() => setSelectedRemark(null)}
                                className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
                            >
                                ×
                            </button>
                        </div>
                        <div className="whitespace-pre-wrap text-gray-100 bg-[#111111] p-4 rounded-lg border border-white/[0.1] max-h-96 overflow-y-auto">
                            {selectedRemark}
                        </div>
                    </div>
                </div>
            )}
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
        </PageTransition>
    )
}
