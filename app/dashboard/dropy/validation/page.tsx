'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient'
import Toast from '@/components/Toast'
import { calculateProductValues, getDefaultConstants, CalculationConstants, type IndiaProductInput } from '@/lib/blackboxCalculations'
import { CATEGORY_NAMES, type FulfillmentChannel, type ShippingZone } from '@/lib/amazonIndiaFees'
import { Loader2, History, X, } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import ConfirmDialog from '@/components/ConfirmDialog';
import PurchaseHistoryDialog from '@/components/shared/PurchaseHistoryDialog'
import { useVirtualizer } from '@tanstack/react-virtual';

const toSnakeCase = (obj: Record<string, any>): Record<string, any> => {
    const map: Record<string, string> = {
        productname: 'product_name',
        sku: 'sku',
        sellertag: 'seller_tag',
        noofseller: 'no_of_seller',
        dropylink: 'india_link',
        usalink: 'usa_link',
        productweight: 'product_weight',
        usdprice: 'usd_price',
        inrpurchase: 'inr_purchase',
        inrpurchaselink: 'inr_purchase_link',
        calculatedjudgement: 'calculated_judgement',
        totalcost: 'total_cost',
        totalrevenue: 'total_revenue',
        origindropy: 'origin_india',
        originchina: 'origin_china',
        originus: 'origin_us',
        checkbrand: 'check_brand',
        checkitemexpire: 'check_item_expire',
        checksmallsize: 'check_small_size',
        checkmultiseller: 'check_multi_seller',
        senttopurchases: 'sent_to_purchases',
        senttopurchasesat: 'sent_to_purchases_at',
        currentjourneyid: 'current_journey_id',
        journeynumber: 'journey_number',
        rejectreason: 'reject_reason',
        amzlink: 'amz_link',
        indiaprice: 'india_price',
        inrsold: 'inr_sold',
    };
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[map[key] || key] = value;
    }
    return result;
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
    asin: 180,
    sku: 180,
    history: 120,           // Reduced
    product_name: 220,   // Reduced from 320
    brand: 110,
    seller_tag: 100,
    funnel: 80,
    no_of_seller: 80,
    india_link: 160,
    usa_link: 80,        // Minimal width for "View"
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
    india_link: false,
    product_weight: false,
    usd_price: false,
    inr_purchase: false,
    inr_purchase_link: false,   // 👈 flex but truncated
    judgement: false,
    remark: false,
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
    created_at?: string | null
    sku?: string | null
    product_name: string | null
    brand: string | null
    seller_tag: string | null
    funnel: string | null
    no_of_seller: number | null
    india_link: string | null
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
    origin_us: boolean | null;
    check_brand: boolean | null
    check_item_expire: boolean | null
    check_small_size: boolean | null
    check_multi_seller: boolean | null
    sent_to_purchases?: boolean
    sent_to_purchases_at?: string
    calculated_judgement?: string | null
    remark: string | null
    reject_reason?: string | null
    amazon_category?: string | null
    fulfillment_channel?: string | null
    shipping_zone?: string | null
    referral_fee?: number | null
    closing_fee?: number | null
    fulfilment_cost?: number | null
    gst_on_fees?: number | null
    amazon_fees_total?: number | null
    actual_profit_percent?: number | null
    is_new?: boolean | null
}

interface Stats {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    rejected: number;
    reworking: number;
    india_link_nf: number;
    usa_link_nf: number;
}

interface Filters {
    seller_tag: string;  // Changed from 'sellertag' to 'seller_tag'
    brand: string;
    funnel: string;
}

type FileTab = 'main_file' | 'pass_file' | 'fail_file' | 'pending' | 'reworking' | 'reject_file' | 'india_link_nf' | 'usa_link_nf';

const SELLER_STYLES: Record<string, string> = {
    DR: 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg border border-orange-600/30',
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
    'RS': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
    'DP': 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30',
    // Legacy fallbacks (old data may still have these)
    'HD': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
    'LD': 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg border border-blue-600/30',
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
    onDragStart,
    onDragOver,
    onDrop,
}: {
    width: number
    label: React.ReactNode
    columnKey: string
    align?: 'left' | 'center'
    onResizeStart: (key: string, startX: number) => void
    onDragStart?: () => void
    onDragOver?: (e: React.DragEvent) => void
    onDrop?: (e: React.DragEvent) => void
}) => {
    const isFlex = COLUMN_FLEX[columnKey];

    return (
        <th
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            style={{
                minWidth: width,
                width: isFlex ? 'auto' : width,
            }}
            className={`relative px-4 py-3 text-xs font-bold text-white uppercase tracking-wider bg-[#111111] ${align === 'center' ? 'text-center' : 'text-left'
                } select-none cursor-grab active:cursor-grabbing`}
        >
            <div className={isFlex ? 'truncate' : ''}>{label}</div>

            <span
                onMouseDown={(e) => { e.stopPropagation(); onResizeStart(columnKey, e.clientX); }}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
            />
        </th>
    );
};

export default function ValidationPage() {
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<FileTab>('main_file')
    const [products, _setProducts] = useState<ValidationProduct[]>([])
    const setProducts: typeof _setProducts = (action) => {
        _setProducts(action);
    };
    const productsRef = useRef<ValidationProduct[]>([]);
    useEffect(() => { productsRef.current = products; }, [products]);
    const movingIdsRef = useRef<Set<string>>(new Set());
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [editingLinkValue, setEditingLinkValue] = useState<string>('');
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
    const [editingSkuValue, setEditingSkuValue] = useState<string>('');
    const [editingUsaLinkId, setEditingUsaLinkId] = useState<string | null>(null);
    const [editingUsaLinkValue, setEditingUsaLinkValue] = useState('');
    const originalUsaLinkWidthRef = useRef<number>(0);
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)
    const [stats, setStats] = useState<Stats>({ total: 0, passed: 0, failed: 0, pending: 0, rejected: 0, reworking: 0, india_link_nf: 0, usa_link_nf: 0 });
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [filters, setFilters] = useState<Filters>({ seller_tag: '', brand: '', funnel: '' })
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRowId, setActiveRowId] = useState<string | null>(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('dropyValidationActiveRowId');
    });
    const markRowActive = (id: string) => {
        setActiveRowId(id);
        if (typeof window !== 'undefined') {
            localStorage.setItem('dropyValidationActiveRowId', id);
        }
    };
    const [rollbackHistory, setRollbackHistory] = useState<
        Record<string, { product: ValidationProduct; action: string } | undefined>
    >({});
    const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
        if (typeof window === 'undefined') return 'ALL';
        return (localStorage.getItem('dropyValidationFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
    });
    const { logActivity, logBatchActivity } = useActivityLogger();

    useEffect(() => {
        localStorage.setItem('dropyValidationFunnelFilter', funnelFilter);
    }, [funnelFilter]);
    const localEditCountRef = useRef(0);
    const recentEditsRef = useRef<Map<string, number>>(new Map());
    const lastVisibilityRefreshRef = useRef(0);
    const [isTabSwitching, setIsTabSwitching] = useState(false);
    // ✅ Store page number for each tab separately
    const [tabPages, setTabPages] = useState<Record<FileTab, number>>({
        main_file: 1, pass_file: 1, fail_file: 1, pending: 1, reworking: 1, reject_file: 1, india_link_nf: 1, usa_link_nf: 1,
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
    const dropyPriceCSVInputRef = useRef<HTMLInputElement>(null)

    // ✅ History Sidebar State
    const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null);



    // Constants Modal
    const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false)
    const [constants, setConstants] = useState<CalculationConstants>(getDefaultConstants())
    const [isSavingConstants, setIsSavingConstants] = useState(false)
    const [selectedRemark, setSelectedRemark] = useState<string | null>(null)
    const [editingRemarkText, setEditingRemarkText] = useState('');
    const [editingRemarkProductId, setEditingRemarkProductId] = useState<string | null>(null);
    const [openChecklistId, setOpenChecklistId] = useState<string | null>(null)
    const [openOriginId, setOpenOriginId] = useState<string | null>(null)
    const [openFunnelId, setOpenFunnelId] = useState<string | null>(null)
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [confirmDialog, setConfirmDialog] = useState<{
        title: string;
        message: string;
        confirmText: string;
        type: 'danger' | 'warning';
        onConfirm: () => void;
    } | null>(null);
    const [selectedRejectReason, setSelectedRejectReason] = useState<string | null>(null)

    // 5. UPDATE visibleColumns state (around line 100)
    const [visibleColumns, setVisibleColumns] = useState({
        asin: true,
        sku: true,
        product_name: true,
        brand: true,
        seller_tag: true,
        funnel: true,
        no_of_seller: true,
        india_link: true,

        product_weight: true,
        usd_price: true,
        inr_purchase: true,
        inr_purchase_link: true,
        amazon_category: true,
        fulfillment_channel: true,
        shipping_zone: true,
        referral_fee: false,
        closing_fee: false,
        fulfilment_cost: false,
        gst_on_fees: false,
        amazon_fees_total: false,
        actual_profit_percent: false,
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
            const saved = localStorage.getItem('dropy_validation_column_widths');
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
    const startResize = (key: string, startX: number) => {
        const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120;

        const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(80, startWidth + (e.clientX - startX));
            setColumnWidths((prev) => {
                const updated = { ...prev, [key]: newWidth };
                localStorage.setItem(
                    'dropy_validation_column_widths',
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

    // ========== COLUMN DRAG REORDER ==========
    const DEFAULT_COLUMN_ORDER = [
        'asin', 'sku', 'history', 'product_name', 'brand', 'seller_tag', 'funnel',
        'no_of_seller', 'india_link', 'usa_link', 'origin', 'product_weight', 'usd_price',
        'inr_purchase', 'inr_purchase_link', 'amazon_category', 'fulfillment_channel', 'shipping_zone', 'referral_fee', 'closing_fee', 'fulfilment_cost', 'gst_on_fees', 'amazon_fees_total', 'actual_profit_percent', 'checklist', 'reject_reason',
        'judgement', 'remark'
    ];

    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMN_ORDER;
        try {
            const saved = localStorage.getItem('dropyValidationColumnOrder');
            if (saved) {
                const parsed = JSON.parse(saved);
                const merged = parsed.filter((k: string) => DEFAULT_COLUMN_ORDER.includes(k));
                // This adds new columns that weren't in the saved order:
                DEFAULT_COLUMN_ORDER.forEach(k => {
                    if (!merged.includes(k)) merged.push(k);
                });
                return merged;
            }
        } catch { }
        return DEFAULT_COLUMN_ORDER;
    });

    const dragColumnRef = useRef<string | null>(null);
    const dragOverColumnRef = useRef<string | null>(null);

    const handleColumnDragStart = (col_key: string) => {
        dragColumnRef.current = col_key;
    };

    const handleColumnDragOver = (e: React.DragEvent, col_key: string) => {
        e.preventDefault();
        dragOverColumnRef.current = col_key;
    };

    const handleColumnDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (!dragColumnRef.current || !dragOverColumnRef.current) return;
        if (dragColumnRef.current === dragOverColumnRef.current) return;

        const newOrder = [...columnOrder];
        const fromIdx = newOrder.indexOf(dragColumnRef.current);
        const toIdx = newOrder.indexOf(dragOverColumnRef.current);
        if (fromIdx === -1 || toIdx === -1) return;

        newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, dragColumnRef.current);

        setColumnOrder(newOrder);
        localStorage.setItem('dropyValidationColumnOrder', JSON.stringify(newOrder));
        dragColumnRef.current = null;
        dragOverColumnRef.current = null;
    };
    // ========== END COLUMN DRAG REORDER ==========

    const refreshProductsSilently = async () => {
        try {
            if (localEditCountRef.current > 0) return;
            if (movingIdsRef.current.size > 0) return;

            const validationData = (await fetchAllRows<ValidationProduct>(
                'dropy_validation_main_file',
                '*',
                { column: 'created_at', ascending: false }
            )).map(p => ({
                ...p,
                usalink: (p as any).usa_link || p.usa_link,
            }));

            // MERGE: only update fields for products that user hasn't touched locally
            setProducts(prev => {
                const dbMap = new Map(dedupeById(validationData).map(p => [p.id, p]));
                const localIds = new Set(prev.map(p => p.id));

                // Update existing products with DB data, but KEEP local calculated fields
                const movingIds = movingIdsRef.current;

                // Update existing products with DB data, but KEEP local calculated fields
                const merged = prev.map(p => {
                    const dbProduct = dbMap.get(p.id);
                    if (!dbProduct) return null;
                    dbMap.delete(p.id);
                    if (movingIds.has(p.id)) return p;
                    const editTime = recentEditsRef.current.get(p.id);
                    if (editTime && Date.now() - editTime < 10000) return p;
                    // Keep local calculated_judgement if it exists (user just calculated)
                    return {
                        ...dbProduct,
                        calculated_judgement: p.calculated_judgement || dbProduct.calculated_judgement,
                    };
                });

                // Add any new products from DB that weren't in local state
                for (const [, dbProduct] of dbMap) {
                    if (movingIds.has(dbProduct.id)) continue;
                    merged.push(dbProduct);
                }

                return merged.filter(Boolean) as ValidationProduct[];
            });
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

    const debouncedStats = useRef(
        debounce(async () => {
            await fetchStats();
        }, 5000)
    ).current;

    useEffect(() => {
        if (authLoading) return;

        Promise.all([fetchProducts(), fetchStats(), fetchConstants()]); // parallel on mount

        // Realtime Subscription
        const channel = supabase
            .channel('validation-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dropy_validation_main_file' }, (payload) => {
                if (localEditCountRef.current > 0) return;
                if (movingIdsRef.current.size > 0) return;

                const eventType = payload.eventType;

                if (eventType === 'INSERT' && payload.new) {
                    const newProduct = payload.new as ValidationProduct;
                    if (movingIdsRef.current.has(newProduct.id)) return;
                    setProducts(prev => {
                        if (prev.some(p => p.id === newProduct.id)) return prev;
                        return [newProduct, ...prev];
                    });
                } else if (eventType === 'UPDATE' && payload.new) {
                    const updated = payload.new as ValidationProduct;
                    if (movingIdsRef.current.has(updated.id)) return;
                    const editTime = recentEditsRef.current.get(updated.id);
                    if (editTime && Date.now() - editTime < 10000) return;
                    setProducts(prev => prev.map(p => {
                        if (p.id !== updated.id) return p;
                        return {
                            ...updated,
                            judgement: p.judgement || updated.judgement,
                            calculated_judgement: p.calculated_judgement || updated.calculated_judgement,
                            sent_to_purchases: p.sent_to_purchases ?? updated.sent_to_purchases,
                        };
                    }));
                } else if (eventType === 'DELETE') {
                    const oldId = (payload.old as any)?.id;
                    if (oldId) {
                        setProducts(prev => prev.filter(p => p.id !== oldId));
                    }
                }

                debouncedStats();
            })

            .on('postgres_changes', { event: '*', schema: 'public', table: 'dropy_validation_main_file' }, () => debouncedStats())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dropy_validation_main_file' }, () => debouncedStats())
            .subscribe();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (localEditCountRef.current > 0) return;
                if (movingIdsRef.current.size > 0) return;
                const now = Date.now();
                if (now - lastVisibilityRefreshRef.current < 10000) return;
                lastVisibilityRefreshRef.current = now;
                refreshProductsSilently();
                debouncedStats();
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
        // searchQuery is NOT cleared — persists across tab switches
        setFilters({ seller_tag: '', brand: '', funnel: '' });
        setSelectedIds(new Set());
        setCurrentPage(1);
        setTimeout(() => setIsTabSwitching(false), 100);
    }, [activeTab]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;

                const canRollback =
                    (activeTab === 'main_file' && rollbackHistory['pass_move']) ||
                    (activeTab === 'pass_file' && rollbackHistory['purchase_move']) ||
                    ((activeTab as string) === 'reworking' && rollbackHistory['reworking_move_out']);

                if (canRollback) {
                    e.preventDefault();
                    handleRollBack();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, rollbackHistory]);

    const fetchConstants = async () => {
        try {
            const { data, error } = await supabase
                .from('dropy_validation_constants')
                .select()
                .limit(1)
                .single();

            if (!error && data) {
                setConstants({
                    dollar_rate: data.dollarrate,
                    bank_conversion_rate: data.bankconversionrate,
                    shipping_charge_per_kg: data.shippingchargeperkg,
                    commission_rate: data.commissionrate,
                    packing_cost: data.packingcost,
                    target_profit_percent: data.targetprofitpercent ?? 10,
                });
            }
        } catch (err) {
            console.error('Error fetching constants', err);
            setToast({ message: 'Failed to load calculation settings', type: 'error' });
        }
    };

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase.rpc('get_dropy_validation_stats');
            if (error) throw error;
            if (data) {
                setStats({
                    total: data.total ?? 0,
                    passed: data.passed ?? 0,
                    failed: data.failed ?? 0,
                    pending: data.pending ?? 0,
                    rejected: data.rejected ?? 0,
                    reworking: data.reworking ?? 0,
                    india_link_nf: data.india_link_nf ?? 0,
                    usa_link_nf: data.usa_link_nf ?? 0,
                });
            }
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

        // Get total count first so we can fetch all pages in parallel
        const { count, error: countError } = await supabase
            .from(table)
            .select(select, { count: 'exact', head: true });

        if (countError) throw countError;
        if (!count || count === 0) return [];

        const totalPages = Math.ceil(count / PAGE_SIZE);

        const pagePromises = Array.from({ length: totalPages }, (_, i) => {
            let query = supabase
                .from(table)
                .select(select)
                .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);

            if (order) {
                query = query.order(order.column, { ascending: order.ascending ?? false });
            }

            return query;
        });

        const results = await Promise.all(pagePromises);

        const allRows: T[] = [];
        for (const { data, error } of results) {
            if (error) throw error;
            if (data) allRows.push(...(data as T[]));
        }

        return allRows;
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
            const validationData = await fetchAllRows<ValidationProduct>(
                'dropy_validation_main_file',
                '*',
                { column: 'created_at', ascending: false }
            );

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
    const tabProductsCache = useRef<Record<FileTab, ValidationProduct[]>>({ main_file: [], pass_file: [], fail_file: [], pending: [], reworking: [], reject_file: [], india_link_nf: [], usa_link_nf: [] });

    // ✅ Add this useEffect to clear cache when products change
    useEffect(() => {
        // Clear cache when products array updates
        tabProductsCache.current = { main_file: [], pass_file: [], fail_file: [], pending: [], reworking: [], reject_file: [], india_link_nf: [], usa_link_nf: [] };
    }, [products]);


    const handleCellEdit = async (id: string, field: string, value: any) => {
        localEditCountRef.current += 1;
        recentEditsRef.current.set(id, Date.now());
        try {
            // Fields that indicate someone is working on this ASIN — clears NEW badge
            const WORK_FIELDS = ['usd_price', 'product_weight', 'inr_purchase', 'inr_purchase_link', 'sku', 'india_link', 'usa_link'];
            const product = productsRef.current.find(p => p.id === id);
            const shouldClearNew = activeTab !== 'main_file' && WORK_FIELDS.includes(field) && product?.is_new;

            // Step 1: Optimistic update
            setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value, ...(shouldClearNew ? { is_new: false } : {}) } : p));

            // Step 2: Save to DB
            const updatePayload = shouldClearNew
                ? toSnakeCase({ [field]: value, is_new: false })
                : toSnakeCase({ [field]: value });
            const { error } = await supabase.from('dropy_validation_main_file').update(updatePayload).eq('id', id);
            if (error) {
                setToast({ message: 'Failed to update', type: 'error' });
                return;
            }

            // Step 3: Auto-calculate using LATEST state (from ref, not stale closure)
            const CALC_FIELDS = ['usd_price', 'product_weight', 'inr_purchase', 'amazon_category', 'fulfillment_channel', 'shipping_zone'];
            if ((activeTab === 'main_file' || activeTab === 'fail_file' || activeTab === 'reworking') && CALC_FIELDS.includes(field)) {
                const freshProduct = productsRef.current.find(p => p.id === id);
                    // Merge the just-edited field so the calculation uses latest values
                    if (freshProduct && ['amazon_category', 'fulfillment_channel', 'shipping_zone'].includes(field)) {
                        (freshProduct as any)[field] = value;
                    }
                if (freshProduct) {
                    await autoCalculateAndUpdate(id, freshProduct);
                }
            }
        } catch (err) {
            console.error('Update error:', err);
            setToast({ message: 'Update failed', type: 'error' });
        } finally {
            await new Promise(resolve => setTimeout(resolve, 100));
            localEditCountRef.current -= 1;
        }
    };

    const handleInstantCalc = (id: string, field: string, inputValue: string) => {
        const numVal = parseFloat(inputValue);
        if (isNaN(numVal) || numVal <= 0) return;

        setProducts(prev => prev.map(p => {
            if (p.id !== id) return p;

            // Merge the currently-typed value with latest state
            const usd = field === 'usd_price' ? numVal : p.usd_price;
            const weight = field === 'product_weight' ? numVal : p.product_weight;
            const inr = field === 'inr_purchase' ? numVal : p.inr_purchase;

            if (!usd || !weight || !inr) return p;

            const result = calculateProductValues(
                {
                    usd_price: usd, product_weight: weight, inr_purchase: inr,
                    amazon_category: p.amazon_category || null,
                    fulfillment_channel: (p.fulfillment_channel as FulfillmentChannel) || 'Seller Flex',
                    shipping_zone: (p.shipping_zone as ShippingZone) || 'National',
                } as IndiaProductInput,
                constants,
                'INDIA'
            );

            return {
                ...p,
                total_cost: result.total_cost,
                total_revenue: result.total_revenue,
                profit: result.profit,
                calculated_judgement: result.judgement || 'PENDING',
                referral_fee: result.referral_fee ?? null,
                closing_fee: result.closing_fee ?? null,
                fulfilment_cost: result.fulfilment_cost ?? null,
                gst_on_fees: result.gst_on_fees ?? null,
                amazon_fees_total: result.amazon_fees_total ?? null,
                actual_profit_percent: result.actual_profit_percent ?? null,
            };
        }));
    };

    // ✅ STEP 1: Filter products
    const allFilteredProducts = useMemo(() => {
        let result = products;

        if (activeTab === 'pass_file') {
            result = products.filter((p) => p.judgement === 'PASS' && !p.sent_to_purchases);
        } else if (activeTab === 'fail_file') {
            result = products.filter(p => p.judgement === 'FAIL');
        } else if (activeTab === 'reject_file') {
            result = products.filter(p => p.judgement === 'REJECT');
        } else if (activeTab === 'reworking') {
            result = products.filter(p => p.judgement === 'REWORKING');
        } else if (activeTab === 'india_link_nf') {
            result = products.filter(p => p.judgement === 'INDIA_LINK_NF');
        } else if (activeTab === 'usa_link_nf') {
            result = products.filter(p => p.judgement === 'USA_LINK_NF');
        } else if (activeTab === 'pending' || activeTab === 'main_file') {
            result = products.filter(p => !p.judgement || p.judgement === 'PENDING');
        }

        // Search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (p) =>
                    p.asin?.toLowerCase().includes(query) ||
                    p.sku?.toLowerCase().includes(query) ||
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

        if (funnelFilter !== 'ALL') {
            result = result.filter(p => p.funnel === funnelFilter);
        }

        result = [...result].sort((a, b) => {
            return (b.created_at || '').localeCompare(a.created_at || '');
        });

        return result;
    }, [products, activeTab, searchQuery, filters, funnelFilter]);

    // ✅ STEP 2: Paginate (only show 100 rows)
    const filteredProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return allFilteredProducts.slice(startIndex, endIndex);
    }, [allFilteredProducts, currentPage, rowsPerPage]);

    // ✅ STEP 3: Calculate total pages
    const totalPages = Math.ceil(allFilteredProducts.length / rowsPerPage);

    const tableScrollRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredProducts.length,
        getScrollElement: () => tableScrollRef.current,
        estimateSize: () => 60,
        overscan: 10,
    });
    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0
        ? totalSize - virtualItems[virtualItems.length - 1].end
        : 0;



    // 2. UPDATE the autoCalculateAndUpdate function around line 180
    const autoCalculateAndUpdate = async (id: string, product: ValidationProduct) => {
        try {
            // GUARD: If this product is being moved, DO NOT touch it
            if (movingIdsRef.current.has(id)) {
                return;
            }

            if (!product.usd_price || !product.product_weight || !product.inr_purchase) {
                return;
            }

            const result = calculateProductValues(
                {
                    usd_price: product.usd_price,
                    product_weight: product.product_weight,
                    inr_purchase: product.inr_purchase,
                    amazon_category: product.amazon_category || null,
                    fulfillment_channel: (product.fulfillment_channel as FulfillmentChannel) || 'Seller Flex',
                    shipping_zone: (product.shipping_zone as ShippingZone) || 'National',
                } as IndiaProductInput,
                constants,
                'INDIA'
            );

            // Save calculated values
            const updateData: any = {
                total_cost: result.total_cost !== null && isFinite(result.total_cost) ? Number(result.total_cost) : null,
                total_revenue: result.total_revenue !== null && isFinite(result.total_revenue) ? Number(result.total_revenue) : null,
                profit: result.profit !== null && isFinite(result.profit) ? Number(result.profit) : null,
                calculated_judgement: result.judgement || 'PENDING',
                referral_fee: result.referral_fee ?? null,
                closing_fee: result.closing_fee ?? null,
                fulfilment_cost: result.fulfilment_cost ?? null,
                gst_on_fees: result.gst_on_fees ?? null,
                amazon_fees_total: result.amazon_fees_total ?? null,
                actual_profit_percent: result.actual_profit_percent ?? null,
            };

            // Auto-correct judgement ONLY for products already in Pass/Fail tabs
            // Main File products have judgement=PENDING/null — untouched (manual Move button preserved)
            if ((product.judgement === 'PASS' || product.judgement === 'FAIL') && result.judgement && result.judgement !== 'PENDING' && result.judgement !== product.judgement) {
                updateData.judgement = result.judgement;
            }


            // GUARD again before DB write (product may have been moved while we calculated)
            if (movingIdsRef.current.has(id)) return;

            const { error: updateError } = await supabase
                .from('dropy_validation_main_file')
                .update(toSnakeCase(updateData))
                .eq('id', id);

            if (updateError) {
                console.error('Auto-calc error', updateError);
                setToast({ message: 'Failed to update product calculation', type: 'error' });
                return;
            }

            // GUARD again before state write
            if (movingIdsRef.current.has(id)) return;

            // Update local state — NEVER write judgement
            setProducts(prev => prev.map(p => {
                if (p.id !== id) return p;
                return {
                    ...p,
                    total_cost: result.total_cost,
                    total_revenue: result.total_revenue,
                    profit: result.profit,
                    calculated_judgement: result.judgement,
                    referral_fee: result.referral_fee ?? null,
                    closing_fee: result.closing_fee ?? null,
                    fulfilment_cost: result.fulfilment_cost ?? null,
                    gst_on_fees: result.gst_on_fees ?? null,
                    amazon_fees_total: result.amazon_fees_total ?? null,
                    actual_profit_percent: result.actual_profit_percent ?? null,
                    // ❌ NO judgement here
                };
            }));

            if (result.judgement === 'PASS') {
                setToast({ message: 'Judgement: PASS — Fill source link, then click Move', type: 'success' });
            } else if (result.judgement === 'FAIL') {
                setToast({ message: 'Judgement: FAIL — Fill source link, then click Move', type: 'error' });
            } else {
                setToast({ message: 'Updated successfully', type: 'success' });
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
        const XLSX = await import('xlsx');
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            // Detect file type and parse accordingly
            let rows: Record<string, string>[] = [];
            const fileName = file.name.toLowerCase();

            if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                // Excel file → use XLSX
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });
            } else {
                // CSV file → use Papa.parse
                const text = (await file.text()).replace(/^\uFEFF/, ''); // Strip BOM
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

            // Normalize header mapping
            const headerMap: Record<string, string> = {};
            rawHeaders.forEach((h) => {
                const lower = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                if (lower === 'asin') headerMap['asin'] = h;
                else if (lower === 'productweight' || lower === 'weightg' || lower === 'weight') headerMap['product_weight'] = h;
                else if (lower === 'usdprice' || lower === 'usd' || lower === 'usdprice') headerMap['usd_price'] = h;
                else if (lower === 'inrpurchase' || lower === 'inr' || lower === 'inrpurchase' || lower === 'inr₹') headerMap['inr_purchase'] = h;
                else if (lower === 'inrpurchaselink' || lower === 'sourcelink' || lower === 'sourcelink' || lower === 'inrpurchaselink') headerMap['inr_purchase_link'] = h;
                else if (lower === 'remark' || lower === 'remarks') headerMap['remark'] = h;
                else if (lower === 'dropylink' || lower === 'india_link' || lower === 'indianlink' || lower === 'amazon_link' || lower === 'amazonlink' || lower === 'india_link') headerMap['dropylink'] = h;
                else if (lower === 'sku') headerMap['sku'] = h;
            });

            if (!headerMap['asin']) {
                setToast({ message: 'File must have an ASIN column', type: 'error' });
                return;
            }


            const updates: { asin: string; product_weight?: number | null; usd_price?: number | null; inr_purchase?: number | null; inr_purchase_link?: string | null; remark?: string | null; dropylink?: string | null; sku?: string | null }[] = [];

            for (const row of rows) {
                const asin = row[headerMap['asin']]?.toString().trim();
                if (!asin) continue;

                const update: any = { asin };

                if (headerMap['product_weight']) {
                    const val = parseFloat(row[headerMap['product_weight']]);
                    if (!isNaN(val)) update.product_weight = val;
                }
                if (headerMap['usd_price']) {
                    const val = parseFloat(row[headerMap['usd_price']]);
                    if (!isNaN(val)) update.usd_price = val;
                }
                if (headerMap['inr_purchase']) {
                    const val = parseFloat(row[headerMap['inr_purchase']]);
                    if (!isNaN(val)) update.inr_purchase = val;
                }
                if (headerMap['inr_purchase_link']) {
                    const val = row[headerMap['inr_purchase_link']]?.toString().trim();
                    if (val) update.inr_purchase_link = val;
                }
                if (headerMap['remark']) {
                    const val = row[headerMap['remark']]?.toString().trim();
                    if (val !== undefined) update.remark = val || null;
                }

                if (headerMap['dropylink']) {
                    const val = row[headerMap['dropylink']]?.toString().trim();
                    if (val) {
                        update.dropylink = val.startsWith('http') ? val : `https://${val}`;
                    }
                }

                if (headerMap['sku']) {
                    const val = row[headerMap['sku']]?.toString().trim();
                    if (val !== undefined) update.sku = val || null;
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
                    if (!existingProduct) {
                        skipped++;
                        return;
                    }

                    const mergedProduct: ValidationProduct = {
                        ...existingProduct,
                        product_weight: csvRow.product_weight ?? existingProduct.product_weight,
                        usd_price: csvRow.usd_price ?? existingProduct.usd_price,
                        inr_purchase: csvRow.inr_purchase ?? existingProduct.inr_purchase,
                        inr_purchase_link: csvRow.inr_purchase_link ?? existingProduct.inr_purchase_link,
                        remark: csvRow.remark !== undefined ? csvRow.remark : existingProduct.remark,
                        india_link: csvRow.dropylink ?? existingProduct.india_link,
                        sku: csvRow.sku ?? existingProduct.sku,
                    };

                    const dbUpdate: Record<string, any> = {};

                    if (csvRow.product_weight !== undefined) dbUpdate.product_weight = csvRow.product_weight;
                    if (csvRow.usd_price !== undefined) dbUpdate.usd_price = csvRow.usd_price;
                    if (csvRow.inr_purchase !== undefined) dbUpdate.inr_purchase = csvRow.inr_purchase;
                    if (csvRow.inr_purchase_link !== undefined) dbUpdate.inr_purchase_link = csvRow.inr_purchase_link;
                    if (csvRow.remark !== undefined) dbUpdate.remark = csvRow.remark;
                    if (csvRow.dropylink !== undefined) dbUpdate.india_link = csvRow.dropylink;
                    if (csvRow.sku !== undefined) dbUpdate.sku = csvRow.sku;

                    const usdPrice = mergedProduct.usd_price;
                    const weight = mergedProduct.product_weight;
                    const inrPurchase = mergedProduct.inr_purchase;

                    if (usdPrice && usdPrice > 0 && weight && weight > 0 && inrPurchase && inrPurchase > 0) {
                        // ⚡ INDIA MODE — Buy USD, Sell INR
                        const result = calculateProductValues(
                            { usd_price: usdPrice, product_weight: weight, inr_purchase: inrPurchase },
                            constants,
                            'INDIA'
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

                    // ⚡ INDIA TABLE
                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update(toSnakeCase(dbUpdate)).eq('asin', csvRow.asin)

                    if (error) {
                        console.error(`❌ Failed to update ${csvRow.asin}:`, error.message);
                        skipped++;
                    } else {
                        updated++;
                        productsByAsin.set(csvRow.asin, { ...mergedProduct, ...dbUpdate });
                    }
                });

                await Promise.all(promises);

                if (i % 200 === 0 && i > 0) {
                    setToast({
                        message: `Processing... ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`,
                        type: 'info',
                    });
                }
            }

            setProducts((prev) =>
                prev.map((p) => {
                    const updatedProduct = productsByAsin.get(p.asin);
                    return updatedProduct ? { ...p, ...updatedProduct } : p;
                })
            );

            debouncedStats();

            // ✅ DETAILED SUMMARY TOASTS
            if (updated === 0) {
                setToast({ message: `⚠️ No matching ASINs found. ${skipped} skipped.`, type: 'warning' });
            } else {
                setToast({
                    message: `✅ ${updated} products updated from file`,
                    type: 'success',
                });

                setTimeout(() => {
                    const movements: string[] = [];
                    if (passCount > 0) movements.push(`✅ ${passCount} moved to Pass File`);
                    if (failCount > 0) movements.push(`❌ ${failCount} moved to Fail File`);
                    const pendingCount = updated - passCount - failCount;
                    if (pendingCount > 0) movements.push(`⏳ ${pendingCount} still Pending`);
                    if (skipped > 0) movements.push(`⚠️ ${skipped} ASINs not found`);

                    setToast({
                        message: movements.join(' | '),
                        type: passCount > 0 ? 'success' : failCount > 0 ? 'error' : 'info',
                    });
                }, 2000);
            }

        } catch (err) {
            console.error('File processing error:', err);
            setToast({ message: 'Failed to process file', type: 'error' });
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handledropyPriceCSVUpload = async (
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
                            .from('dropy_validation_main_file')
                            .select('*')
                            .eq('asin', row.asin)
                            .single()

                        if (data) {
                            await handleCellEdit(data.id, 'usd_price', row.usd_price)
                        }
                    }

                    setToast({ message: 'INDIA prices updated via CSV', type: 'success' })
                    fetchProducts()
                    debouncedStats()
                } catch (err) {
                    console.error(err)
                    setToast({ message: 'INDIA price CSV update failed', type: 'error' })
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

    const handleOriginToggle = async (id: string, field: 'origin_india' | 'origin_china' | 'origin_us', value: boolean) => {
        // optimistic UI
        setProducts(prev =>
            prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
        )

        const { error } = await supabase
            .from('dropy_validation_main_file')
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

    const handleFunnelChange = async (id: string, newFunnel: string) => {
        localEditCountRef.current += 1;
        recentEditsRef.current.set(id, Date.now());
        const oldFunnel = products.find(p => p.id === id)?.funnel;
        // Optimistic UI
        setProducts(prev => prev.map(p => p.id === id ? { ...p, funnel: newFunnel } : p));
        setOpenFunnelId(null);
        setDropdownPos(null);

        try {
            const { error } = await supabase
                .from('dropy_validation_main_file')
                .update({ funnel: newFunnel })
                .eq('id', id);

            if (error) {
                // Rollback
                setProducts(prev => prev.map(p => p.id === id ? { ...p, funnel: oldFunnel } : p));
                setToast({ message: 'Failed to update funnel', type: 'error' });
            } else {
                setToast({ message: `Funnel changed to ${newFunnel}`, type: 'success' });
                const product = products.find(p => p.id === id);
                logActivity({
                    action: 'funnel_change',
                    marketplace: 'dropy',
                    page: 'validation',
                    table_name: 'dropy_validation_main_file',
                    asin: product?.asin || '',
                    details: { from: oldFunnel, to: newFunnel }
                });
            }
        } finally {
            await new Promise(resolve => setTimeout(resolve, 3000));
            localEditCountRef.current -= 1;
            setTimeout(() => recentEditsRef.current.delete(id), 10000);
        }
    };

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
            .from('dropy_validation_main_file')
            .update(toSnakeCase({ [field]: value })).eq('id', id)

        if (error) {
            // rollback
            setProducts(prev =>
                prev.map(p => (p.id === id ? { ...p, [field]: !value } : p))
            )
            setToast({ message: 'Failed to update checklist', type: 'error' })
        }
    }

    const handleChecklistOk = async (id: string) => {

        const product = products.find(p => p.id === id)
        if (!product) return

        // ✅ Generate UUID with fallback for older browsers
        const generateUUID = () => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            // Fallback: Generate UUID manually
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        };

        const journeyId = product.current_journey_id || generateUUID();
        const journeyNum = product.journey_number || 1;

        try {
            // 1. Fetch fresh data from DB to get the correct links + funnel + seller_tag
            const { data: realData, error: fetchError } = await supabase
                .from('dropy_validation_main_file')
                .select('india_link, inr_purchase_link, funnel, seller_tag')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('Error fetching fresh links:', fetchError);
            }

            // 2. Snapshot History
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
                .from('dropy_asin_history')
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
            }

            // 3. Insert into Purchases
            const origins: string[] = [];
            if (product.origin_india) origins.push('India');
            if (product.origin_china) origins.push('China');
            if (product.origin_us) origins.push('US');
            const originText = origins.length > 0 ? origins.join(', ') : 'India';

            const { error: insertError } = await supabase
                .from('dropy_purchases')
                .insert({
                    asin: product.asin,
                    product_name: product.product_name,
                    brand: product.brand,
                    seller_tag: realData?.seller_tag || product.seller_tag,
                    funnel: realData?.funnel || product.funnel,
                    origin: originText,
                    origin_india: product.origin_india ?? false,
                    origin_china: product.origin_china ?? false,
                    origin_us: product.origin_us ?? false,
                    product_link: realData?.india_link || product.india_link,
                    inr_purchase_link: realData?.inr_purchase_link || product.inr_purchase_link || '',
                    seller_link: null,
                    target_price: product.inr_purchase,
                    // target_quantity: 1,
                    funnel_quantity: 1,
                    funnel_seller: product.funnel,
                    buying_price: null,
                    buying_quantity: null,
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
                    journey_id: journeyId,
                    journey_number: journeyNum,
                    sku: product.sku || null
                })

            if (insertError) {
                console.error('Insert error:', insertError)
                setToast({ message: `Failed: ${insertError.message}`, type: 'error' })
                return
            }

            // 4. Mark as Sent
            const { error: markError } = await supabase
                .from('dropy_validation_main_file')
                .update(toSnakeCase({ senttopurchases: true, senttopurchasesat: new Date().toISOString(), currentjourneyid: journeyId, journeynumber: journeyNum }))
                .eq('id', id)

            if (markError) {
                console.error('Failed to mark as sent:', markError);
                setToast({ message: 'Warning: Product sent but flag not saved. Try again.', type: 'error' });
                return;
            }

            setRollbackHistory(prev => ({
                ...prev,
                purchase_move: { product, action: 'sent_to_purchases' }
            }));

            setProducts((prev) => prev.map((p) =>
                p.id === id ? { ...p, sent_to_purchases: true } : p
            ))
            setToast({ message: 'Sent to Purchases successfully!', type: 'success' })
            logActivity({
                action: 'submit',
                marketplace: 'dropy',
                page: 'validation',
                table_name: 'dropy_purchases',
                asin: product.asin,
                details: { seller_tag: product.seller_tag, journey_id: journeyId, journey_number: journeyNum }
            });

        } catch (err) {
            console.error('Unexpected error:', err)
            setToast({ message: 'An unexpected error occurred', type: 'error' })
        }
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
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {

                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({
                            judgement: 'PENDING',
                            calculated_judgement: null,
                            check_brand: false,
                            check_item_expire: false,
                            check_small_size: false,
                            check_multi_seller: false,
                            origin_india: false,
                            origin_china: false,
                            origin_us: false,
                            sent_to_purchases: false,
                            sent_to_purchases_at: null,
                            reject_reason: null,
                        })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }


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
                    setSelectedIds(new Set());

                    setToast({ message: `Successfully moved ${idsArray.length} items back to Main File!`, type: 'success' });
                    const movedProducts = products.filter(p => selectedIds.has(p.id));
                    logBatchActivity(
                        movedProducts.map(p => ({ asin: p.asin, details: { seller_tag: p.seller_tag, from: activeTab, to: 'mainfile' } })),
                        { action: 'move', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();

                } catch (err) {
                    console.error('Move to main error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => {
                        localEditCountRef.current -= 1;
                        setTimeout(() => {
                            idsArray.forEach(id => movingIdsRef.current.delete(id));
                        }, 10000);
                    }, 5000);
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

        // Check all selected items have category
        const selectedProducts = products.filter(p => selectedIds.has(p.id));
        const missingCategory = selectedProducts.filter(p => !p.amazon_category);
        if (missingCategory.length > 0) {
            setToast({
                message: `${missingCategory.length} item(s) missing Category. Please select Category for all items before moving to Pass.`,
                type: 'warning'
            });
            return;
        }

        setConfirmDialog({
            title: 'Move to Pass File',
            message: `Move ${selectedIds.size} items to Pass File?`,
            confirmText: 'Move to Pass',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {

                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({
                            judgement: 'PASS',
                        })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    setProducts(prev => prev.map(p =>
                        selectedIds.has(p.id) ? { ...p, judgement: 'PASS' } : p
                    ));
                    setSelectedIds(new Set());

                    setToast({ message: `Successfully moved ${idsArray.length} items to Pass File!`, type: 'success' });
                    const passProducts = products.filter(p => selectedIds.has(p.id));
                    logBatchActivity(
                        passProducts.map(p => ({ asin: p.asin, details: { seller_tag: p.seller_tag } })),
                        { action: 'pass', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();

                } catch (err) {
                    console.error('Move to pass error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => {
                        localEditCountRef.current -= 1;
                        setTimeout(() => {
                            idsArray.forEach(id => movingIdsRef.current.delete(id));
                        }, 10000);
                    }, 5000);
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
            title: 'Move to Fail File',
            message: `Move ${selectedIds.size} items to Fail File?`,
            confirmText: 'Move to Fail',
            type: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {

                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({
                            judgement: 'FAIL',
                        })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    setProducts(prev => prev.map(p =>
                        selectedIds.has(p.id) ? { ...p, judgement: 'FAIL' } : p
                    ));
                    setSelectedIds(new Set());

                    setToast({ message: `Successfully moved ${idsArray.length} items to Fail File!`, type: 'success' });
                    const failProducts = products.filter(p => selectedIds.has(p.id));
                    logBatchActivity(
                        failProducts.map(p => ({ asin: p.asin, details: { seller_tag: p.seller_tag } })),
                        { action: 'fail', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();

                } catch (err) {
                    console.error('Move to fail error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => {
                        localEditCountRef.current -= 1;
                        setTimeout(() => {
                            idsArray.forEach(id => movingIdsRef.current.delete(id));
                        }, 10000);
                    }, 5000);
                }
            }
        });
    };

    const handleMoveToReworkingClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Reworking',
            message: `Move ${selectedIds.size} items to Reworking?`,
            confirmText: 'Move to Reworking',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {
                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({
                            judgement: 'REWORKING',
                            // check_brand: false,
                            // check_item_expire: false,
                            // check_small_size: false,
                            // check_multi_seller: false,
                            // origin_india: false,
                            // origin_china: false,
                            // origin_us: false,
                            sent_to_purchases: false,
                            sent_to_purchases_at: null,
                            reject_reason: null,
                        })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    setProducts(prev =>
                        prev.map(p => selectedIds.has(p.id)
                            ? {
                                ...p,
                                judgement: 'REWORKING',
                                // check_brand: false,
                                // check_item_expire: false,
                                // check_small_size: false,
                                // check_multi_seller: false,
                                // origin_india: false,
                                // origin_china: false,
                                // origin_us: false,
                                sent_to_purchases: false,
                                sent_to_purchases_at: undefined,
                            }
                            : p
                        )
                    );
                    setSelectedIds(new Set());
                    setToast({ message: `Successfully moved ${idsArray.length} items to Reworking!`, type: 'success' });
                    const lastMovedProduct = products.find(p => idsArray.includes(p.id));
                    if (lastMovedProduct) {
                        setRollbackHistory(prev => ({
                            ...prev,
                            reworking_move: { product: lastMovedProduct, action: 'move_to_reworking' }
                        }));
                    }

                    const reworkProducts = products.filter(p => selectedIds.has(p.id));
                    logBatchActivity(
                        reworkProducts.map(p => ({
                            asin: p.asin,
                            details: { seller_tag: p.seller_tag, from: 'fail_file', to: 'reworking' }
                        })),
                        { action: 'move', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();
                } catch (err) {
                    console.error('Move to reworking error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => { localEditCountRef.current -= 1; }, 5000);
                    setTimeout(() => { idsArray.forEach(id => movingIdsRef.current.delete(id)); }, 10000);
                }
            }
        });
    };

    const handleMoveToIndiaLinkNFClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to Link NF',
            message: `Move ${selectedIds.size} items to India Link Not Found?`,
            confirmText: 'Move to Link NF',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {
                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({ judgement: 'INDIA_LINK_NF' })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    setProducts(prev =>
                        prev.map(p => selectedIds.has(p.id)
                            ? { ...p, judgement: 'INDIA_LINK_NF' }
                            : p
                        )
                    );
                    setSelectedIds(new Set());
                    setToast({ message: `Moved ${idsArray.length} items to Link NF`, type: 'success' });

                    logBatchActivity(
                        products.filter(p => selectedIds.has(p.id)).map(p => ({
                            asin: p.asin,
                            details: { seller_tag: p.seller_tag, from: 'main_file', to: 'india_link_nf' }
                        })),
                        { action: 'move', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();
                } catch (err) {
                    console.error('Move to Link NF error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => { localEditCountRef.current -= 1; }, 5000);
                    setTimeout(() => { idsArray.forEach(id => movingIdsRef.current.delete(id)); }, 10000);
                }
            }
        });
    };

    const handleMoveToUsaLinkNFClick = () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' });
            return;
        }

        setConfirmDialog({
            title: 'Move to USA Link NF',
            message: `Move ${selectedIds.size} items to USA Link Not Found?`,
            confirmText: 'Move to USA Link NF',
            type: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                const idsArray = Array.from(selectedIds);
                idsArray.forEach(id => movingIdsRef.current.add(id));
                localEditCountRef.current += 1;

                try {
                    const { error } = await supabase
                        .from('dropy_validation_main_file')
                        .update({ judgement: 'USA_LINK_NF' })
                        .in('id', idsArray);

                    if (error) {
                        console.error('Supabase error:', error);
                        throw error;
                    }

                    setProducts(prev =>
                        prev.map(p => selectedIds.has(p.id)
                            ? { ...p, judgement: 'USA_LINK_NF' }
                            : p
                        )
                    );
                    setSelectedIds(new Set());
                    setToast({ message: `Moved ${idsArray.length} items to USA Link NF`, type: 'success' });

                    logBatchActivity(
                        products.filter(p => selectedIds.has(p.id)).map(p => ({
                            asin: p.asin,
                            details: { seller_tag: p.seller_tag, from: 'main_file', to: 'usa_link_nf' }
                        })),
                        { action: 'move', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
                    );

                    debouncedStats();
                } catch (err) {
                    console.error('Move to USA Link NF error:', err);
                    setToast({ message: 'Failed to move items', type: 'error' });
                } finally {
                    setTimeout(() => { localEditCountRef.current -= 1; }, 5000);
                    setTimeout(() => { idsArray.forEach(id => movingIdsRef.current.delete(id)); }, 10000);
                }
            }
        });
    };

    // Move items to Reject
    const handleMoveToRejectClick = async () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' })
            return
        }
        // Open the reject reason modal instead of window.confirm
        setRejectReason('')
        setIsRejectModalOpen(true)
    }

    const handleConfirmReject = async () => {
        if (!rejectReason.trim()) {
            setToast({ message: 'Please enter a reason for rejection', type: 'warning' })
            return
        }
        setIsRejectModalOpen(false)

        const idsArray = Array.from(selectedIds)
        idsArray.forEach(id => movingIdsRef.current.add(id));
        localEditCountRef.current += 1;

        try {
            const { error } = await supabase
                .from('dropy_validation_main_file')
                .update(toSnakeCase({ judgement: 'REJECT', rejectreason: rejectReason.trim() }))
                .in('id', idsArray)

            if (error) throw error

            setProducts(prev => prev.map(p =>
                selectedIds.has(p.id) ? { ...p, judgement: 'REJECT' } : p
            ))
            setSelectedIds(new Set())
            setRejectReason('')
            setToast({ message: `Successfully moved ${idsArray.length} items to Rejected!`, type: 'success' });
            // ✅ ADD THIS:
            const rejectProducts = products.filter(p => selectedIds.has(p.id));
            logBatchActivity(
                rejectProducts.map(p => ({ asin: p.asin, details: { seller_tag: p.seller_tag, reason: rejectReason.trim() } })),
                { action: 'reject', marketplace: 'dropy', page: 'validation', table_name: 'dropy_validation_main_file' }
            );
            // await fetchProducts()
            debouncedStats()
        } catch (err) {
            console.error('Move to reject error', err)
            setToast({ message: 'Failed to move items', type: 'error' })
        } finally {
            setTimeout(() => {
                localEditCountRef.current -= 1;
                setTimeout(() => {
                    idsArray.forEach(id => movingIdsRef.current.delete(id));
                }, 10000);
            }, 5000);
        }
    }

    const downloadCSV = (mode: 'selected' | 'page' | 'all') => {
        let dataToDownload: ValidationProduct[] = [];
        let label = '';

        if (mode === 'selected') {
            dataToDownload = allFilteredProducts.filter(p => selectedIds.has(p.id));
            label = `${dataToDownload.length} selected`;
        } else if (mode === 'page') {
            dataToDownload = filteredProducts; // paginated 100 rows
            label = `page ${currentPage}`;
        } else {
            dataToDownload = allFilteredProducts; // all in current tab
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
        a.download = `validation_${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
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
        setIsSavingConstants(true);
        try {
            // Map state keys → DB column names
            const dbPayload = {
                dollarrate: constants.dollar_rate,
                bankconversionrate: constants.bank_conversion_rate,
                shippingchargeperkg: constants.shipping_charge_per_kg,
                commissionrate: constants.commission_rate,
                packingcost: constants.packing_cost,
                targetprofitpercent: constants.target_profit_percent ?? 10,
            };

            const { data: existingData } = await supabase
                .from('dropy_validation_constants')
                .select('id')
                .limit(1)
                .single();

            if (existingData) {
                const { error } = await supabase
                    .from('dropy_validation_constants')
                    .update(dbPayload)
                    .eq('id', existingData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('dropy_validation_constants')
                    .insert(dbPayload);
                if (error) throw error;
            }

            setToast({ message: 'Constants saved successfully!', type: 'success' });
            setIsConstantsModalOpen(false);
            await recalculateAllProducts();
        } catch (err) {
            console.error('Save constants error', err);
            setToast({ message: 'Failed to save constants', type: 'error' });
        } finally {
            setIsSavingConstants(false);
        }
    };

    const recalculateAllProducts = async () => {
        if (activeTab !== 'main_file' && activeTab !== 'reworking') return;

        const productsToRecalc = products.filter(p =>
            p.usd_price && p.product_weight && p.inr_sold && p.inr_purchase
        )

        for (const product of productsToRecalc) {
            await autoCalculateAndUpdate(product.id, product)
        }

        setToast({ message: `Recalculated ${productsToRecalc.length} products`, type: 'info' })
        fetchProducts()
        debouncedStats()
    }

    // Check if all required fields are filled for moving
    const isReadyToMove = (product: ValidationProduct): boolean => {
        const baseReady = !!(
            product.product_weight &&
            product.usd_price &&
            product.inr_purchase &&
            product.inr_purchase_link?.trim() &&
            product.calculated_judgement &&
            product.calculated_judgement !== 'PENDING'
        );
        // PASS requires category; FAIL does not
        if (product.calculated_judgement === 'PASS') {
            return baseReady && !!product.amazon_category && CATEGORY_NAMES.includes(product.amazon_category);
        }
        return baseReady;
    };

    // Move ASIN to Pass/Fail based on calculated judgement
    const handleMoveByJudgement = async (product: ValidationProduct) => {
        const judgement = product.calculated_judgement;

        if (!judgement || judgement === 'PENDING') return;

        // Block PASS if category not selected
        if (judgement === 'PASS' && !product.amazon_category) {
            setToast({ message: 'Please select a Category before moving to Pass', type: 'warning' });
            return;
        }

        // LOCK this product — no autoCalc or refresh can touch it
        movingIdsRef.current.add(product.id);
        localEditCountRef.current += 1;
        let cleanedUp = false;

        try {
            // Step 1: Save to DB
            const finalJudgement = judgement;
            const { error } = await supabase
                .from('dropy_validation_main_file')
                .update({ judgement: finalJudgement })
                .eq('id', product.id);

            if (error) {
                setToast({ message: 'Failed to move: ' + error.message, type: 'error' });
                movingIdsRef.current.delete(product.id);
                localEditCountRef.current -= 1;
                cleanedUp = true;
                return;
            }

            // Step 2: Update local state — product filtered to pass/fail tab view
            setProducts(prev => prev.map(p =>
                p.id === product.id ? { ...p, judgement: finalJudgement } : p
            ));

            if ((activeTab as string) === 'reworking') {
                setRollbackHistory(prev => ({
                    ...prev,
                    reworking_move_out: { product, action: `move_to_${finalJudgement.toLowerCase()}` }
                }));
            } else if (finalJudgement === 'PASS') {
                setRollbackHistory(prev => ({ ...prev, pass_move: { product, action: 'move_to_pass' } }));
            } else {
                setToast({ message: `Moved to Fail File`, type: 'error' });
            }

            setToast({ message: `Moved to ${judgement === 'PASS' ? 'Pass' : 'Fail'} File`, type: judgement === 'PASS' ? 'success' : 'error' });
            // ✅ ADD THIS:
            logActivity({
                action: finalJudgement === 'PASS' ? 'pass' : 'fail',
                marketplace: 'dropy',
                page: 'validation',
                table_name: 'dropy_validation_main_file',
                asin: product.asin,
                details: { seller_tag: product.seller_tag, funnel: product.funnel, judgement: finalJudgement },
            });

            debouncedStats();
        } catch (err: any) {
            console.error('Move by judgement error', err);
            setToast({ message: err?.message || 'Unexpected error', type: 'error' });
        } finally {
            if (!cleanedUp) {
                // Keep lock for 5 seconds so no refresh can resurrect this product
                await new Promise(resolve => setTimeout(resolve, 5000));
                localEditCountRef.current -= 1;
                // Keep movingIds lock for 10 more seconds to block any late-arriving refresh
                setTimeout(() => {
                    movingIdsRef.current.delete(product.id);
                }, 10000);
            }
        }
    };

    // ========== ROLLBACK LOGIC ==========
    const handleRollBack = async () => {
        // SCENARIO 1: On Main File tab → pull ASIN back from Pass File
        if (activeTab === 'main_file') {
            const last = rollbackHistory['pass_move'];
            if (!last) {
                setToast({ message: 'No recent Pass move to roll back', type: 'warning' });
                return;
            }

            // const confirmed = window.confirm(
            //     `Roll back "${last.product.asin}" from Pass File back to Main File (Pending)?`
            // );
            // if (!confirmed) return;

            try {
                // Reset judgement to PENDING → moves it back to Main File view
                const { error } = await supabase
                    .from('dropy_validation_main_file')
                    .update(toSnakeCase({
                        judgement: 'PENDING',
                        calculatedjudgement: last.product.calculated_judgement || null,
                        // Reset pass-file-only fields
                        checkbrand: false,
                        checkitemexpire: false,
                        checksmallsize: false,
                        checkmultiseller: false,
                        origindropy: false,
                        originchina: false,
                        originus: false,
                    }))
                    .eq('id', last.product.id);

                if (error) throw error;

                // Clear rollback history for this action
                setRollbackHistory(prev => {
                    const next = { ...prev };
                    delete next['pass_move'];
                    return next;
                });

                setToast({ message: `Rolled back ${last.product.asin} to Main File`, type: 'success' });
                // ✅ ADD THIS:
                logActivity({
                    action: 'rollback',
                    marketplace: 'dropy',
                    page: 'validation',
                    table_name: 'dropy_validation_main_file',
                    asin: last.product.asin,
                    details: { from: 'passfile', to: 'mainfile' }
                });
                movingIdsRef.current.delete(last.product.id);
                await fetchProducts();
                debouncedStats();
            } catch (err: any) {
                console.error('Rollback from pass error:', err);
                setToast({ message: 'Rollback failed: ' + err.message, type: 'error' });
            }
        }

        // SCENARIO 2: On Pass File tab → pull ASIN back from Purchases
        else if (activeTab === 'pass_file') {
            const last = rollbackHistory['purchase_move'];
            if (!last) {
                setToast({ message: 'No recent Purchase move to roll back', type: 'warning' });
                return;
            }

            // const confirmed = window.confirm(
            //     `Roll back "${last.product.asin}" from Purchases back to Pass File?`
            // );
            // if (!confirmed) return;

            try {
                // ✅ GUARD: Check if this product was already sent to admin validation
                const { data: purchaseRow } = await supabase
                    .from('dropy_purchases')
                    .select('sent_to_admin, admin_confirmed')
                    .eq('asin', last.product.asin)
                    .eq('journey_number', last.product.journey_number || 1)
                    .maybeSingle();

                if (purchaseRow?.sent_to_admin || purchaseRow?.admin_confirmed) {
                    setToast({
                        message: `Cannot roll back "${last.product.asin}" — it's already ${purchaseRow.admin_confirmed ? 'confirmed by admin' : 'sent to Admin Validation'}. Roll it back from there instead.`,
                        type: 'error'
                    });
                    return;
                }

                // 1. Delete from dropy_purchases
                const { error: deleteError } = await supabase
                    .from('dropy_purchases')
                    .delete()
                    .eq('asin', last.product.asin)
                    .eq('journey_number', last.product.journey_number || 1);

                if (deleteError) throw deleteError;

                // 2. Reset sent_to_purchases flag in main_file → reappears in Pass File
                const { error: updateError } = await supabase
                    .from('dropy_validation_main_file')
                    .update(toSnakeCase({
                        senttopurchases: false,
                        senttopurchasesat: null,
                    }))
                    .eq('id', last.product.id);

                if (updateError) throw updateError;

                // 3. Delete the history snapshot for this move
                await supabase
                    .from('dropy_asin_history')
                    .delete()
                    .eq('asin', last.product.asin)
                    .eq('stage', 'validation_to_purchase')
                    .eq('journey_number', last.product.journey_number || 1);

                // Clear rollback history
                setRollbackHistory(prev => {
                    const next = { ...prev };
                    delete next['purchase_move'];
                    return next;
                });

                setToast({ message: `Rolled back ${last.product.asin} from Purchases to Pass File`, type: 'success' });
                // ✅ ADD THIS:
                logActivity({
                    action: 'rollback',
                    marketplace: 'dropy',
                    page: 'validation',
                    table_name: 'dropy_purchases',
                    asin: last.product.asin,
                    details: { from: 'purchases', to: 'passfile' }
                });
                await fetchProducts();
                debouncedStats();
            } catch (err: any) {
                console.error('Rollback from purchases error:', err);
                setToast({ message: 'Rollback failed: ' + err.message, type: 'error' });
            }
        }

        else if (activeTab === 'reworking') {
            const last = rollbackHistory['reworking_move_out'];
            if (!last) {
                setToast({ message: 'No recent move to roll back', type: 'warning' });
                return;
            }
            const movedTo = last.action === 'move_to_pass' ? 'Pass File' : 'Fail File';
            // const confirmed = window.confirm(
            //     `Roll back ${last.product.asin} from ${movedTo} back to Reworking?`
            // );
            // if (!confirmed) return;
            try {
                const { error } = await supabase
                    .from('dropy_validation_main_file')
                    .update({ judgement: 'REWORKING' })
                    .eq('id', last.product.id);
                if (error) throw error;

                setRollbackHistory(prev => {
                    const next = { ...prev };
                    delete next['reworking_move_out'];
                    return next;
                });
                setToast({ message: `Rolled back ${last.product.asin} to Reworking`, type: 'success' });

                logActivity({
                    action: 'rollback',
                    marketplace: 'dropy',
                    page: 'validation',
                    table_name: 'dropy_validation_main_file',
                    asin: last.product.asin,
                    details: { from: movedTo, to: 'reworking' },
                });

                movingIdsRef.current.delete(last.product.id);
                await fetchProducts();
                debouncedStats();
            } catch (err: any) {
                console.error('Rollback to reworking error:', err);
                setToast({ message: `Rollback failed: ${err.message}`, type: 'error' });
            }
        }

        else {
            setToast({ message: 'Rollback not available on this tab', type: 'warning' });
        }
    };
    // ========== END ROLLBACK ==========

    // ========== RENDER CELL BY COLUMN KEY ==========
    const renderCell = (col_key: string, product: ValidationProduct) => {
        switch (col_key) {

            case 'asin':
                if (!visibleColumns.asin) return null;
                return (
                    <td key={col_key} className="p-3 font-mono text-sm text-gray-300" style={{ minWidth: 160 }}>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span>{product.asin}</span>
                            {product.is_new && (
                                <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded uppercase tracking-wider animate-pulse">
                                    New
                                </span>
                            )}
                        </div>
                    </td>
                );

            case 'sku':
                if (!visibleColumns.sku) return null;
                return (
                    <td key={col_key} className="px-6 py-4 text-sm" style={{ maxWidth: columnWidths.sku || 150 }}>
                        <div className="w-40">
                            {editingSkuId === product.id ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={editingSkuValue}
                                        onChange={(e) => setEditingSkuValue(e.target.value)}
                                        className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                        placeholder="Enter SKU..."
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleCellEdit(product.id, 'sku', editingSkuValue.trim() || null);
                                                setEditingSkuId(null);
                                            } else if (e.key === 'Escape') {
                                                setEditingSkuId(null);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            handleCellEdit(product.id, 'sku', editingSkuValue.trim() || null);
                                            setEditingSkuId(null);
                                        }}
                                        className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                                        title="Save (Enter)"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setEditingSkuId(null)}
                                        className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                                        title="Cancel (Esc)"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ) : product.sku ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-100 text-xs truncate" title={product.sku}>{product.sku}</span>
                                    <button
                                        onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(product.sku || ''); }}
                                        className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0"
                                        title="Edit SKU"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(''); }}
                                    className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add SKU
                                </button>
                            )}
                        </div>
                    </td>
                );

            case 'history':
                return (
                    <td key={col_key} className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <button
                            onClick={() => setSelectedHistoryAsin(product.asin)}
                            className="p-2 rounded-full hover:bg-white/[0.08] text-gray-400 hover:text-orange-500 transition-colors"
                            title="View Journey History"
                        >
                            <History className="w-4 h-4" />
                        </button>
                    </td>
                );

            case 'product_name':
                if (!visibleColumns.product_name) return null;
                return (
                    <td key={col_key} style={{ width: columnWidths.product_name, maxWidth: columnWidths.product_name }} className="p-3 border-b border-white/[0.1]">
                        <div className="truncate max-w-full text-gray-500 text-xs" title={product.product_name || ''}>
                            {product.product_name || '-'}
                        </div>
                    </td>
                );

            case 'brand':
                if (!visibleColumns.brand) return null;
                return <td key={col_key} className="p-3 text-gray-300">{product.brand || '-'}</td>;

            case 'seller_tag':
                if (!visibleColumns.seller_tag) return null;
                return <td key={col_key} className="p-3">{renderSellerTags(product.seller_tag)}</td>;

            case 'funnel':
                if (!visibleColumns.funnel) return null;
                return (
                    <td key={col_key} className="p-3">
                        {(activeTab === 'main_file' || activeTab === 'pending' || activeTab === 'pass_file' || activeTab === 'fail_file' || activeTab === 'reworking') ? (
                            <div className="relative">
                                <button
                                    onClick={() => {
                                        if (openFunnelId === product.id) {
                                            setOpenFunnelId(null);
                                            setDropdownPos(null);
                                        } else {
                                            setDropdownPos({ top: 0, left: 0 });
                                            setOpenFunnelId(product.id);
                                            setOpenChecklistId(null);
                                            setOpenOriginId(null);
                                        }
                                    }}
                                    className={`group/funnel relative cursor-pointer transition-all ${openFunnelId === product.id ? 'ring-2 ring-orange-500 rounded-lg' : ''}`}
                                    title="Click to change funnel"
                                >
                                    {renderFunnelBadge(product.funnel)}
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-400 rounded-full flex items-center justify-center opacity-0 group-hover/funnel:opacity-100 transition-opacity shadow-lg">
                                        <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </span>
                                </button>

                                {openFunnelId === product.id && dropdownPos && (
                                    <div
                                        style={{ position: 'absolute', top: '100%', left: '0', zIndex: 9999 }}
                                        className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-1.5 min-w-[120px] animate-in fade-in zoom-in-95 duration-150"
                                    >
                                        {['RS', 'DP'].map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => handleFunnelChange(product.id, f)}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${product.funnel === f
                                                    ? 'bg-orange-500/10 text-orange-400'
                                                    : 'text-gray-500 hover:bg-[#111111] hover:text-white'
                                                    }`}
                                            >
                                                {renderFunnelBadge(f)}
                                                <span>{f === 'RS' ? 'Restock' : 'Dropshipping'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            renderFunnelBadge(product.funnel)
                        )}
                    </td>
                );

            case 'no_of_seller':
                if (!visibleColumns.no_of_seller) return null;
                return <td key={col_key} className="p-3 text-gray-300">{product.no_of_seller || '-'}</td>;

            case 'india_link': {
                if (!visibleColumns.india_link) return null;
                const isEditingIndia = editingLinkId === product.id;
                return (
                    <td key={col_key} className="px-6 py-4 text-sm"
                        style={isEditingIndia ? { minWidth: '350px' } : undefined}
                    >
                        {isEditingIndia ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={editingLinkValue}
                                    onChange={(e) => setEditingLinkValue(e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                    placeholder="Paste URL..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCellEdit(product.id, 'india_link', editingLinkValue);
                                            setEditingLinkId(null);
                                        } else if (e.key === 'Escape') {
                                            setEditingLinkId(null);
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => { handleCellEdit(product.id, 'india_link', editingLinkValue); setEditingLinkId(null); }}
                                    className="text-emerald-500 hover:text-emerald-400 flex-shrink-0" title="Save (Enter)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button onClick={() => setEditingLinkId(null)} className="text-rose-500 hover:text-rose-400 flex-shrink-0" title="Cancel (Esc)">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {product.india_link ? (
                                    <>
                                        <a href={product.india_link?.startsWith('http') ? product.india_link : `https://${product.india_link}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap text-xs">
                                            View Link
                                        </a>
                                        <button
                                            onClick={() => { setEditingLinkId(product.id); setEditingLinkValue(product.india_link || ''); }}
                                            className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit link"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => { setEditingLinkId(product.id); setEditingLinkValue(''); }}
                                        className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Link
                                    </button>
                                )}
                            </div>
                        )}
                    </td>
                );
            }

            case 'usa_link': {
                const isEditingUsa = editingUsaLinkId === product.id;
                return (
                    <td key={col_key} className="px-6 py-4 text-sm">
                        {isEditingUsa ? (
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={editingUsaLinkValue}
                                    onChange={(e) => setEditingUsaLinkValue(e.target.value)}
                                    className="flex-1 min-w-0 px-2 py-1 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                    placeholder="Paste URL..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCellEdit(product.id, 'usa_link', editingUsaLinkValue);
                                            setEditingUsaLinkId(null);
                                            setColumnWidths(prev => {
                                                const updated = { ...prev, usa_link: originalUsaLinkWidthRef.current };
                                                localStorage.setItem('dropyvalidationcolumnwidths', JSON.stringify(updated));
                                                return updated;
                                            });
                                        } else if (e.key === 'Escape') {
                                            setEditingUsaLinkId(null);
                                            setColumnWidths(prev => {
                                                const updated = { ...prev, usa_link: originalUsaLinkWidthRef.current };
                                                localStorage.setItem('dropyvalidationcolumnwidths', JSON.stringify(updated));
                                                return updated;
                                            });
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        handleCellEdit(product.id, 'usa_link', editingUsaLinkValue);
                                        setEditingUsaLinkId(null);
                                        setColumnWidths(prev => {
                                            const updated = { ...prev, usa_link: originalUsaLinkWidthRef.current };
                                            localStorage.setItem('dropyvalidationcolumnwidths', JSON.stringify(updated));
                                            return updated;
                                        });
                                    }}
                                    className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                                    title="Save (Enter)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingUsaLinkId(null);
                                        setColumnWidths(prev => {
                                            const updated = { ...prev, usa_link: originalUsaLinkWidthRef.current };
                                            localStorage.setItem('dropyvalidationcolumnwidths', JSON.stringify(updated));
                                            return updated;
                                        });
                                    }}
                                    className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                                    title="Cancel (Esc)"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {product.usa_link || product.asin ? (
                                    <>
                                        <a
                                            href={product.usa_link || `https://www.amazon.com/dp/${product.asin}?th=1&psc=1`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap text-xs"
                                        >
                                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            .com
                                        </a>
                                        <button
                                            onClick={() => {
                                                originalUsaLinkWidthRef.current = columnWidths['usa_link'] || 80;
                                                setEditingUsaLinkId(product.id);
                                                setEditingUsaLinkValue(product.usa_link || `https://www.amazon.com/dp/${product.asin}?th=1&psc=1`);
                                                setColumnWidths(prev => ({ ...prev, usa_link: 350 }));
                                            }}
                                            className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0"
                                            title="Edit link"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            originalUsaLinkWidthRef.current = columnWidths['usa_link'] || 80;
                                            setEditingUsaLinkId(product.id);
                                            setEditingUsaLinkValue('');
                                            setColumnWidths(prev => ({ ...prev, usa_link: 350 }));
                                        }}
                                        className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Link
                                    </button>
                                )}
                            </div>
                        )}
                    </td>
                );
            }

            case 'origin':
                if (activeTab !== 'pass_file' && activeTab !== 'fail_file' && activeTab !== 'reworking') return null;
                // PASTE YOUR EXACT EXISTING origin <td> block here
                // It starts with: {activeTab === 'pass_file' && (() => { const origins = [...]
                // Copy everything between the outer <td> and </td> for origin
                return (() => {
                    const origins = [
                        { key: 'origin_india' as const, label: 'India', checked: !!product.origin_india },
                        { key: 'origin_china' as const, label: 'China', checked: !!product.origin_china },
                        { key: 'origin_us' as const, label: 'US', checked: !!product.origin_us },
                    ];
                    const selected = origins.filter(o => o.checked);
                    const isOpen = openOriginId === product.id;

                    return (
                        <td key={col_key} className="p-3">
                            {/* YOUR EXISTING ORIGIN DROPDOWN JSX — copy the entire <div className="relative"> ... </div> from your current code */}
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        if (isOpen) { setOpenOriginId(null); setOpenFunnelId(null); setDropdownPos(null); }
                                        else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            const dropdownHeight = 120;
                                            const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 4;
                                            setDropdownPos({ top, left: rect.left });
                                            setOpenOriginId(product.id);
                                            setOpenChecklistId(null);
                                        }
                                    }}
                                    className={`w-full min-w-[100px] px-3 py-1.5 bg-[#111111] border rounded-lg text-xs text-left flex items-center justify-between gap-2 transition-colors ${isOpen ? 'border-orange-500 ring-1 ring-orange-500/50' : 'border-white/[0.1] hover:border-white/[0.1]'}`}
                                >
                                    {selected.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {selected.map(o => (
                                                <span key={o.key} className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-medium">{o.label}</span>
                                            ))}
                                        </div>
                                    ) : (<span className="text-gray-300">Select...</span>)}
                                    <svg className={`w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {isOpen && dropdownPos && (
                                    <>
                                        <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenOriginId(null); setDropdownPos(null); }} />
                                        <div className="fixed w-40 bg-[#111111] border border-white/[0.1] rounded-lg shadow-2xl z-[9999] py-1" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
                                            {origins.map(o => (
                                                <label key={o.key} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#111111] cursor-pointer text-xs text-gray-300 transition-colors">
                                                    <input type="checkbox" checked={o.checked} onChange={(e) => handleOriginToggle(product.id, o.key, e.target.checked)} className="w-3.5 h-3.5 rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50" />
                                                    <span className={o.checked ? 'text-emerald-400 font-medium' : ''}>{o.label}</span>
                                                    {o.checked && (<svg className="w-3 h-3 text-emerald-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>)}
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </td>
                    );
                })();

            case 'product_weight':
                if (!visibleColumns.product_weight) return null;
                return (
                    <td key={col_key} className="p-3 text-gray-300 overflow-hidden">
                        {/* ✅ ADD 'reworking' */}
                        {(activeTab === 'main_file' || activeTab === 'fail_file' || activeTab === 'reworking') ? (
                            <input type="number" key={`${product.id}-pw-${product.product_weight}`} defaultValue={product.product_weight ?? ''}
                                onChange={(e) => handleInstantCalc(product.id, 'product_weight', e.target.value)}
                                onBlur={(e) => handleCellEdit(product.id, 'product_weight', Number(e.target.value) || null)}
                                className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs"
                            />
                        ) : (product.product_weight ?? '-')}
                    </td>
                );

            case 'usd_price':
                if (!visibleColumns.usd_price) return null;
                return (
                    <td key={col_key} className="p-3 text-gray-300 overflow-hidden">
                        {/* ✅ ADD 'reworking' */}
                        {(activeTab === 'main_file' || activeTab === 'fail_file' || activeTab === 'reworking') ? (
                            <input type="text" key={`${product.id}-usd-${product.usd_price}`} defaultValue={product.usd_price ?? ''}
                                onChange={(e) => handleInstantCalc(product.id, 'usd_price', e.target.value)}
                                onBlur={(e) => { const parsed = parseCurrency(e.target.value); handleCellEdit(product.id, 'usd_price', parsed) }}
                                className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs"
                            />
                        ) : (formatUSD(product.usd_price))}
                    </td>
                );

            case 'inr_purchase':
                if (!visibleColumns.inr_purchase) return null;
                return (
                    <td key={col_key} className="p-3 text-gray-300 overflow-hidden">
                        {/* ✅ ADD 'reworking' */}
                        {(activeTab === 'main_file' || activeTab === 'fail_file' || activeTab === 'reworking') ? (
                            <input type="text" key={`${product.id}-inr-${product.inr_purchase}`} defaultValue={product.inr_purchase ?? ''}
                                onChange={(e) => handleInstantCalc(product.id, 'inr_purchase', e.target.value)}
                                onBlur={(e) => { const parsed = parseCurrency(e.target.value); handleCellEdit(product.id, 'inr_purchase', parsed) }}
                                className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs"
                            />
                        ) : (formatINR(product.inr_purchase))}
                    </td>
                );

            case 'inr_purchase_link':
                if (activeTab !== 'main_file' && activeTab !== 'reworking') return null;
                if (!visibleColumns.inr_purchase_link) return null;
                return (
                    <td key={col_key} className="px-6 py-4 text-sm overflow-hidden">
                        <input
                            type="url"
                            defaultValue={product.inr_purchase_link || ''}
                            key={`${product.id}-ipl-${product.inr_purchase_link || ''}`}
                            onBlur={(e) => { const val = e.target.value.trim(); if (val) { handleCellEdit(product.id, 'inr_purchase_link', val); } }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                            placeholder="Paste source link"
                            className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 truncate text-xs"
                        />
                    </td>
                );

            case 'checklist':
                if (activeTab !== 'pass_file') return null;
                // PASTE YOUR EXACT EXISTING checklist IIFE block here
                return (() => {
                    const checks = [
                        { key: 'check_brand' as const, label: 'Brand', checked: !!product.check_brand },
                        { key: 'check_item_expire' as const, label: 'Expire', checked: !!product.check_item_expire },
                        { key: 'check_small_size' as const, label: 'Size', checked: !!product.check_small_size },
                        { key: 'check_multi_seller' as const, label: 'Multi', checked: !!product.check_multi_seller },
                    ];
                    const checkedItems = checks.filter(c => c.checked);
                    const checkedCount = checkedItems.length;
                    const isOpen = openChecklistId === product.id;
                    const hasOrigin = product.origin_india || product.origin_china || product.origin_us;

                    // Copy the ENTIRE return from your existing checklist block
                    // starting with <td className="p-3"> ... </td>
                    // This is the biggest block — just copy-paste it from your existing code
                    return (
                        <td key={col_key} className="p-3">
                            {/* PASTE your existing checklist <div> here — the button + dropdown + OK button */}
                            <div className="flex flex-col items-center gap-1.5">
                                <button
                                    onClick={(e) => {
                                        if (isOpen) { setOpenChecklistId(null); setDropdownPos(null); }
                                        else {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            const dropdownHeight = 170;
                                            const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 4;
                                            setDropdownPos({ top, left: rect.left });
                                            setOpenChecklistId(product.id);
                                            setOpenOriginId(null);
                                        }
                                    }}
                                    className={`w-full min-w-[130px] px-3 py-1.5 bg-[#111111] border rounded-lg text-xs text-left flex items-center justify-between gap-2 transition-colors ${isOpen ? 'border-orange-500 ring-1 ring-orange-500/50' : 'border-white/[0.1] hover:border-white/[0.1]'}`}
                                >
                                    {checkedCount > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {checkedItems.map(c => (
                                                <span key={c.key} className="px-1.5 py-0.5 bg-orange-500/10 text-orange-500 rounded text-[10px] font-medium">{c.label}</span>
                                            ))}
                                        </div>
                                    ) : (<span className="text-gray-300">-</span>)}
                                </button>
                                {isOpen && dropdownPos && (
                                    <>
                                        <div className="fixed inset-0 z-[9998]" onClick={() => { setOpenChecklistId(null); setDropdownPos(null); }} />
                                        <div className="fixed w-44 bg-[#111111] border border-white/[0.1] rounded-lg shadow-2xl z-[9999] py-1" style={{ top: dropdownPos.top, left: dropdownPos.left }}>
                                            {checks.map(c => (
                                                <label key={c.key} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#111111] cursor-pointer text-xs text-gray-300 transition-colors">
                                                    <input type="checkbox" checked={c.checked} onChange={(e) => handleChecklistToggle(product.id, c.key, e.target.checked)} className="w-3.5 h-3.5 rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50" />
                                                    <span className={c.checked ? 'text-orange-500 font-medium' : ''}>{c.label}</span>
                                                    {c.checked && (<svg className="w-3 h-3 text-orange-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>)}
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {product.check_brand && hasOrigin && (
                                    <button onClick={() => handleChecklistOk(product.id)} className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-md transition-all w-fit text-xs">
                                        OK
                                    </button>
                                )}
                            </div>
                        </td>
                    );
                })();

            case 'reject_reason':
                if (activeTab !== 'reject_file') return null;
                return (
                    <td key={col_key} className="p-3 text-center">
                        {product.reject_reason ? (
                            <button onClick={() => setSelectedRejectReason(product.reject_reason || null)} className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">View</button>
                        ) : (<span className="text-gray-300">-</span>)}
                    </td>
                );

            case 'judgement':
                if (!visibleColumns.judgement) return null;
                return (
                    <td key={col_key} className="p-3 text-sm text-center">
                        <div className="flex flex-col items-center gap-1.5">
                            {product.calculated_judgement && product.calculated_judgement !== 'PENDING' ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${product.calculated_judgement === 'PASS'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    }`}>
                                    {product.calculated_judgement}
                                </span>
                            ) : (<span className="text-gray-300 text-xs"></span>)}

                            {(activeTab === 'main_file' || activeTab === 'fail_file' || activeTab === 'reworking') && isReadyToMove(product) && (
                                <button
                                    onClick={() => handleMoveByJudgement(product)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${product.calculated_judgement === 'PASS'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
                                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/50'
                                        }`}
                                >
                                    Move {product.calculated_judgement === 'PASS' ? 'Pass' : 'Fail'}
                                </button>
                            )}
                        </div>
                    </td>
                );

            case 'remark':
                if (!visibleColumns.remark) return null;
                return (
                    <td key={col_key} className="p-3 text-center">
                        {product.remark ? (
                            <button onClick={() => { setSelectedRemark(product.remark || ' '); setEditingRemarkText(product.remark || ''); setEditingRemarkProductId(product.id); }} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                                View
                            </button>
                        ) : (<button onClick={() => { setSelectedRemark(' '); setEditingRemarkText(''); setEditingRemarkProductId(product.id); }} className="text-gray-300 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>)}
                    </td>
                );

            case 'amazon_category':
                if (!visibleColumns.amazon_category) return null;
                return (
                    <td key={col_key} style={{ width: columnWidths[col_key] || 200, minWidth: 170 }} className="px-2 py-1.5 text-sm">
                        <div className="relative"> 
                            <select
                                value={product.amazon_category || ''}
                                onChange={(e) => {
                                    handleCellEdit(product.id, 'amazon_category', e.target.value || null);
                                }}
                                className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer truncate [color-scheme:dark]"
                                title={product.amazon_category || 'Select category'}
                            >
                                <option value="" style={{ backgroundColor: '#1a1a1a', color: '#9ca3af' }}>Select Category...</option>
                                {CATEGORY_NAMES.map(cat => (
                                    <option key={cat} value={cat} style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </td>
                );

            case 'fulfillment_channel':
                if (!visibleColumns.fulfillment_channel) return null;
                return (
                    <td key={col_key} className="px-2 py-1.5 text-sm">
                        <select
                            value={product.fulfillment_channel || 'Seller Flex'}
                            onChange={(e) => handleCellEdit(product.id, 'fulfillment_channel', e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer [color-scheme:dark]"
                        >
                            <option value="Seller Flex" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>Seller Flex</option>
                            <option value="Easy Ship" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>Easy Ship</option>
                            <option value="Self-Ship" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>Self-Ship</option>
                        </select>
                    </td>
                );

            case 'shipping_zone':
                if (!visibleColumns.shipping_zone) return null;
                return (
                    <td key={col_key} className="px-2 py-1.5 text-sm">
                        <select
                            value={product.shipping_zone || 'National'}
                            onChange={(e) => handleCellEdit(product.id, 'shipping_zone', e.target.value)}
                            className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs text-white focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer [color-scheme:dark]"
                        >
                            <option value="Local" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>Local</option>
                            <option value="Regional" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>Regional</option>
                            <option value="National" style={{ backgroundColor: '#1a1a1a', color: '#e5e7eb' }}>National</option>
                        </select>
                    </td>
                );

            case 'referral_fee':
            case 'closing_fee':
            case 'fulfilment_cost':
            case 'gst_on_fees':
            case 'amazon_fees_total':
                if (visibleColumns[col_key as keyof typeof visibleColumns] === false) return null;
                return (
                    <td key={col_key} className="p-3 text-sm text-gray-400 text-right">
                        {product[col_key as keyof ValidationProduct] != null ? `₹${Number(product[col_key as keyof ValidationProduct]).toFixed(0)}` : '—'}
                    </td>
                );

            case 'actual_profit_percent': {
                if (!visibleColumns.actual_profit_percent) return null;
                const pct = product.actual_profit_percent;
                const targetPct = constants.target_profit_percent ?? 10;
                return (
                    <td key={col_key} className={`p-3 text-sm text-right font-semibold ${pct != null ? (pct >= targetPct ? 'text-emerald-400' : 'text-red-400') : 'text-gray-500'}`}>
                        {pct != null ? `${pct.toFixed(1)}%` : '—'}
                    </td>
                );
            }

            default:
                return null;
        }
    };
    // ========== END RENDER CELL ==========

    return (
        <>
            <div className="h-screen flex flex-col overflow-hidden bg-[#111111] p-3 sm:p-4 lg:p-6 text-gray-100 font-sans selection:bg-orange-400/30">
                <div className="w-full flex flex-col flex-1 overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="flex-none">
                        {/* Header */}
                        <div className="mb-6">
                            <h1 className="text-xl sm:text-3xl font-bold text-white">Dropy - Validation</h1>
                            <p className="text-xs sm:text-sm text-gray-300 mt-1">Manage validation files and product status</p>
                        </div>

                        {/* Stats Cards - Compact */}
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6">
                            <div className="flex items-center gap-2.5 bg-[#1a1a1a] rounded-lg px-3.5 py-2 border border-white/[0.1]">
                                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total</span>
                                <span className="text-sm sm:text-lg font-bold text-white">{stats.total}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-emerald-900/30 rounded-lg px-3.5 py-2 border border-emerald-500/20">
                                <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">✓ Pass</span>
                                <span className="text-sm sm:text-lg font-bold text-emerald-300">{stats.passed}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-rose-900/30 rounded-lg px-3.5 py-2 border border-rose-500/20">
                                <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">✗ Fail</span>
                                <span className="text-sm sm:text-lg font-bold text-rose-300">{stats.failed}</span>
                            </div>
                            {/* <div className="flex items-center gap-2.5 bg-amber-900/30 rounded-lg px-3.5 py-2 border border-amber-500/20">
                                <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">⏳ Pending</span>
                                <span className="text-lg font-bold text-amber-300">{stats.pending}</span>
                            </div> */}
                            <div className="flex items-center gap-2.5 bg-violet-900/30 rounded-lg px-3.5 py-2 border border-violet-500/20">
                                <span className="text-[11px] font-medium text-violet-400 uppercase tracking-wider">Rejected</span>
                                <span className="text-sm sm:text-lg font-bold text-violet-300">{stats.rejected}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-cyan-900/30 rounded-lg px-3.5 py-2 border border-cyan-500/20">
                                <span className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">Reworking</span>
                                <span className="text-sm sm:text-lg font-bold text-cyan-300">{stats.reworking}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-amber-900/30 rounded-lg px-3.5 py-2 border border-amber-500/20">
                                <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Link NF</span>
                                <span className="text-sm sm:text-lg font-bold text-amber-300">{stats.india_link_nf}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-blue-900/30 rounded-lg px-3.5 py-2 border border-blue-500/20">
                                <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">USA Link NF</span>
                                <span className="text-sm sm:text-lg font-bold text-blue-300">{stats.usa_link_nf}</span>
                            </div>
                        </div>
                        {/* File Tabs */}
                        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-5 p-1 sm:p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-full sm:w-fit overflow-x-auto scrollbar-none">
                            {[
                                { id: 'main_file', label: 'Main File' },
                                { id: 'pass_file', label: 'Pass File' },
                                { id: 'fail_file', label: 'Failed File' },
                                { id: 'reworking', label: 'Reworking' },
                                { id: 'reject_file', label: 'Rejected' },
                                { id: 'india_link_nf', label: 'Link NF' },
                                { id: 'usa_link_nf', label: 'USA Link NF' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as FileTab)}
                                    className={`px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-orange-500 text-white font-semibold shadow-sm'
                                        : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 mb-6">
                            {/* Search Bar */}
                            <div className="relative w-64 shrink-0 group">
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
                                    placeholder="Search by ASIN, SKU, Product Name, or Brand..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-10 py-2 sm:py-2.5 text-xs sm:text-sm bg-[#111111] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600 transition-all shadow-sm"
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
                                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] hover:text-white border border-white/[0.1] text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors shadow-sm"
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

                            {/* Move to Main */}
                            {(activeTab === 'pass_file' || activeTab === 'fail_file' || activeTab === 'reject_file' || activeTab === 'india_link_nf' || activeTab === 'usa_link_nf') && (
                                <button
                                    onClick={handleMoveToMainClick}
                                    disabled={selectedIds.size === 0}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-sm ${selectedIds.size === 0
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-[#1a1a1a] text-white hover:bg-slate-600 border border-white/[0.1]'
                                        }`}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="hidden sm:inline">Move to Main</span>
                                </button>
                            )}

                            {(activeTab === 'fail_file' || activeTab === 'main_file' || activeTab === 'pass_file') && (
                                <button
                                    onClick={handleMoveToReworkingClick}
                                    disabled={selectedIds.size === 0}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-cyan-900/20 ${selectedIds.size === 0
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-cyan-600 text-white hover:bg-cyan-500 border border-cyan-500'
                                        }`}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span className="hidden sm:inline">Move to Reworking</span>
                                </button>
                            )}

                            {activeTab === 'main_file' && (
                                <button
                                    onClick={handleMoveToIndiaLinkNFClick}
                                    disabled={selectedIds.size === 0}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-amber-900/20 ${selectedIds.size === 0
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-amber-600 text-white hover:bg-amber-500 border border-amber-500'
                                        }`}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                                    </svg>
                                    <span className="hidden sm:inline">Link NF</span>
                                </button>
                            )}

                            {activeTab === 'main_file' && (
                                <button
                                    onClick={handleMoveToUsaLinkNFClick}
                                    disabled={selectedIds.size === 0}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-blue-900/20 ${selectedIds.size === 0
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-blue-600 text-white hover:bg-blue-500 border border-blue-500'
                                        }`}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                                    </svg>
                                    <span className="hidden sm:inline">USA Link NF</span>
                                </button>
                            )}

                            {/* Move to Pass */}
                            {/* {activeTab === 'pending' && (
      <button
        onClick={handleMoveToPassClick}
        disabled={selectedIds.size === 0}
        className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-emerald-900/20 ${selectedIds.size === 0
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
        className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-rose-900/20 ${selectedIds.size === 0
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

                            {/* Funnel Quick Filters */}
                            <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl p-1 border border-white/[0.1]">
                                <button
                                    onClick={() => setFunnelFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'ALL'
                                        ? 'bg-orange-500 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                                        }`}
                                >
                                    ALL
                                </button>
                                <button
                                    onClick={() => setFunnelFilter(funnelFilter === 'RS' ? 'ALL' : 'RS')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'RS'
                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                                        }`}
                                >
                                    RS
                                </button>
                                <button
                                    onClick={() => setFunnelFilter(funnelFilter === 'DP' ? 'ALL' : 'DP')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'DP'
                                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                                        }`}
                                >
                                    DP
                                </button>
                            </div>

                            {(activeTab === 'pending' || activeTab === 'main_file' || activeTab === 'pass_file') && (
                                <button
                                    onClick={handleMoveToRejectClick}
                                    disabled={selectedIds.size === 0}
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-violet-900/20 ${selectedIds.size === 0
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-violet-600 text-white hover:bg-violet-500 border border-violet-500'
                                        }`}
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                    <span className="hidden sm:inline">Move to Reject</span>
                                </button>
                            )}

                            {(activeTab === 'main_file' || activeTab === 'pass_file' || activeTab === 'reworking') && (
                                <button
                                    onClick={handleRollBack}
                                    disabled={
                                        (activeTab === 'main_file' && !rollbackHistory['pass_move']) ||
                                        (activeTab === 'pass_file' && !rollbackHistory['purchase_move']) ||
                                        (activeTab === 'reworking' && !rollbackHistory['reworking_move_out'])
                                    }
                                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg shadow-amber-900/20 ${(activeTab === 'main_file' && !rollbackHistory['pass_move']) ||
                                        (activeTab === 'pass_file' && !rollbackHistory['purchase_move']) ||
                                        (activeTab === 'reworking' && !rollbackHistory['reworking_move_out'])
                                        ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                        : 'bg-amber-600 text-white hover:bg-amber-500 border border-amber-500'
                                        }`}
                                    title={
                                        activeTab === 'main_file' ? 'Roll back last ASIN from Pass File' :
                                            activeTab === 'reworking' ? 'Roll back last ASIN to Fail File' :
                                                'Roll back last ASIN from Purchases'
                                    }
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    <span className="hidden sm:inline">Roll Back</span>
                                </button>
                            )}

                            {/* Download CSV Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50"
                                >
                                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span className="hidden sm:inline">Download CSV</span>
                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isDownloadDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsDownloadDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-2 z-20 w-56 animate-in fade-in zoom-in-95 duration-200">

                                            {/* Download Selected - only if items selected */}
                                            {selectedIds.size > 0 && (
                                                <button
                                                    onClick={() => downloadCSV('selected')}
                                                    className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                                                >
                                                    <span>📋 Download Selected</span>
                                                    <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                                                </button>
                                            )}

                                            {/* Download Current Page */}
                                            <button
                                                onClick={() => downloadCSV('page')}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                                            >
                                                <span>📄 Download Page</span>
                                                <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                                            </button>

                                            {/* Download All */}
                                            <button
                                                onClick={() => downloadCSV('all')}
                                                className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
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
                                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-blue-900/20 transition-all border border-blue-500/50"
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span className="hidden sm:inline">Upload CSV</span>
                            </button>
                            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={processCSVFile} className="hidden" />

                            {/* Bulk Dropy Price Update */}
                            <button
                                onClick={() => dropyPriceCSVInputRef.current?.click()}
                                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-400 text-xs sm:text-sm font-medium whitespace-nowrap shadow-lg shadow-orange-500/10 transition-all border border-orange-500/50"
                            >
                                Bulk Dropy Price Update
                            </button>
                            <input type="file" accept=".csv" ref={dropyPriceCSVInputRef} onChange={handledropyPriceCSVUpload} className="hidden" />

                            {/* Configure Constants */}
                            <button
                                onClick={openConstantsModal}
                                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-purple-900/20 transition-all border border-purple-500/50"
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="hidden sm:inline">Configure Constants</span>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Table Section - ONLY THIS SCROLLS */}
                    <div className="flex-1 min-h-0 bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col border border-white/[0.1]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-8 sm:p-16">
                                <div className="relative">
                                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500/30"></div>
                                    <div className="absolute top-0 left-0 inline-block animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-indigo-500"></div>
                                </div>
                                <p className="mt-4 text-gray-400 font-medium tracking-wide animate-pulse">Loading products...</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 sm:p-12 text-gray-500">
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
                                <div ref={tableScrollRef} className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50" style={{ overflow: 'auto visible' }} onScroll={() => { setOpenFunnelId(null); setDropdownPos(null); setOpenChecklistId(null); setOpenOriginId(null); }}>
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
                                                {/* Checkbox — always first, not draggable */}
                                                <th className="px-6 py-4 text-left bg-[#111111] sticky left-0 z-20" style={{ width: 50, minWidth: 50 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                                        className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                                                    />
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider bg-[#111111]"
                                                    style={{ width: 50, minWidth: 50 }}>Sr.</th>

                                                {columnOrder.map((col_key) => {
                                                    // Tab-specific visibility
                                                    if (col_key === 'origin' && activeTab !== 'pass_file' && activeTab !== 'fail_file' && activeTab !== 'reworking') return null;
                                                    if (col_key === 'checklist' && activeTab !== 'pass_file') return null;
                                                    if (col_key === 'reject_reason' && activeTab !== 'reject_file') return null;
                                                    if (col_key === 'inr_purchase_link' && activeTab !== 'main_file' && activeTab !== 'reworking') return null;

                                                    // visibleColumns check for standard columns
                                                    const visKey = col_key as keyof typeof visibleColumns;
                                                    if (visibleColumns[visKey] !== undefined && !visibleColumns[visKey]) return null;

                                                    // Skip columns not in visibleColumns AND not special tab columns
                                                    const specialCols = ['history', 'origin', 'checklist', 'reject_reason', 'usa_link'];
                                                    if (!specialCols.includes(col_key) && visibleColumns[visKey] === undefined) return null;

                                                    const labels: Record<string, string> = {
                                                        asin: 'ASIN',
                                                        history: 'HISTORY',
                                                        product_name: 'Product Name',
                                                        brand: 'Brand',
                                                        seller_tag: 'Seller Tag',
                                                        funnel: 'Funnel',
                                                        no_of_seller: 'Sellers',
                                                        india_link: 'INDIA Link',
                                                        usa_link: 'USA Link',
                                                        origin: 'Origin',
                                                        product_weight: 'Weight (g)',
                                                        usd_price: 'USD $',
                                                        inr_purchase: 'INR ₹',
                                                        inr_purchase_link: 'Source Link',
                                                        checklist: 'Checklist',
                                                        reject_reason: 'Reject Reason',
                                                        judgement: 'Status',
                                                        remark: 'Remark',
                                                        amazon_category: 'CATEGORY',
                                                        fulfillment_channel: 'CHANNEL',
                                                        shipping_zone: 'ZONE',
                                                        referral_fee: 'REF FEE',
                                                        closing_fee: 'CLOSE FEE',
                                                        fulfilment_cost: 'FULFIL',
                                                        gst_on_fees: 'GST',
                                                        amazon_fees_total: 'AMZ TOTAL',
                                                        actual_profit_percent: 'PROFIT %',
                                                    };

                                                    const widths: Record<string, number> = {
                                                        origin: 110,
                                                        checklist: 160,
                                                        reject_reason: 200,
                                                    };

                                                    return (
                                                        <ResizableTH
                                                            key={col_key}
                                                            width={widths[col_key] ?? columnWidths[col_key] ?? DEFAULT_COLUMN_WIDTHS[col_key] ?? 120}
                                                            columnKey={col_key}
                                                            label={labels[col_key] || col_key}
                                                            align={col_key === 'remark' ? 'center' : 'left'}
                                                            onResizeStart={startResize}
                                                            onDragStart={() => handleColumnDragStart(col_key)}
                                                            onDragOver={(e) => handleColumnDragOver(e, col_key)}
                                                            onDrop={handleColumnDrop}
                                                        />
                                                    );
                                                })}
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-white/[0.06] overflow-visible">
                                            {paddingTop > 0 && (
                                                <tr><td colSpan={30} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
                                            )}
                                            {virtualItems.map((virtualRow) => {
                                                const product = filteredProducts[virtualRow.index];
                                                const idx = virtualRow.index;
                                                return (
                                                    <tr
                                                        key={product.id}
                                                        data-index={virtualRow.index}
                                                        ref={rowVirtualizer.measureElement}
                                                        onClick={() => markRowActive(product.id)}
                                                        className={
                                                            product.id === activeRowId
                                                                ? 'bg-emerald-500/10 ring-2 ring-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.6)] transition-colors'
                                                                : 'hover:bg-[#1a1a1a]/50 transition-colors'
                                                        }
                                                    >
                                                        <td className="p-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(product.id)}
                                                                onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                                className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                                                            />
                                                        </td>

                                                        <td className="px-6 py-4 text-center text-xs font-mono text-gray-300">
                                                            {(currentPage - 1) * rowsPerPage + idx + 1}
                                                        </td>

                                                        {columnOrder.map((col_key) => renderCell(col_key, product))}
                                                    </tr>
                                                );
                                            })}
                                            {paddingBottom > 0 && (
                                                <tr><td colSpan={30} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {allFilteredProducts.length > 0 && (
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 border-t border-white/[0.1] bg-[#111111]">
                                        <div className="text-sm text-gray-300">
                                            Showing <span className="font-bold text-gray-100">{filteredProducts.length}</span> of <span className="font-bold text-gray-100">{allFilteredProducts.length}</span> products
                                            {selectedIds.size > 0 && (
                                                <span className="ml-4">
                                                    (<span className="font-bold text-orange-500">{selectedIds.size}</span> selected)
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
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
                            <div className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full border border-white/[0.1] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                                <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-4 sm:p-6">
                                    <h2 className="text-lg sm:text-2xl font-bold">Calculation Constants Configuration</h2>
                                    <p className="text-purple-100 mt-1 opacity-80">Update global constants for automatic calculations</p>
                                </div>

                                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Dollar Rate (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.dollar_rate ?? ''}
                                            onChange={(e) => { const val = parseFloat(e.target.value); setConstants({ ...constants, dollar_rate: isNaN(val) ? 0 : val }); }}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Bank Fee (%)</label>
                                        <input
                                            type="number"
                                            value={constants.bank_conversion_rate != null && !isNaN(constants.bank_conversion_rate) ? constants.bank_conversion_rate * 100 : ''}
                                            onChange={(e) => { const val = parseFloat(e.target.value); setConstants({ ...constants, bank_conversion_rate: isNaN(val) ? 0 : val / 100 }); }}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Shipping per 1000g (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.shipping_charge_per_kg ?? ''}
                                            onChange={(e) => { const val = parseFloat(e.target.value); setConstants({ ...constants, shipping_charge_per_kg: isNaN(val) ? 0 : val }); }}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Packing Cost (₹)</label>
                                        <input
                                            type="number"
                                            value={constants.packing_cost ?? ''}
                                            onChange={(e) => { const val = parseFloat(e.target.value); setConstants({ ...constants, packing_cost: isNaN(val) ? 0 : val }); }}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="0.01"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">Target Profit % (India)</label>
                                        <input
                                            type="number"
                                            value={constants.target_profit_percent ?? 10}
                                            onChange={(e) => { const val = parseFloat(e.target.value); setConstants({ ...constants, target_profit_percent: isNaN(val) ? 10 : val }); }}
                                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                            step="1"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6 border-t border-white/[0.1] bg-[#1a1a1a] flex items-center justify-end gap-3">
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

            {/* REJECT REASON MODAL */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Reject {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}</h3>
                            <button
                                onClick={() => { setIsRejectModalOpen(false); setRejectReason(''); }}
                                className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">Please provide a reason for rejection:</p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            rows={4}
                            autoFocus
                            className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 placeholder-slate-600 transition-all resize-none"
                        />
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                onClick={() => { setIsRejectModalOpen(false); setRejectReason(''); }}
                                className="px-5 py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] font-medium transition-colors border border-white/[0.1]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmReject}
                                disabled={!rejectReason.trim()}
                                className="px-5 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 font-medium transition-all shadow-lg shadow-violet-900/20 border border-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* REMARK VIEWER MODAL */}
            {selectedRemark !== null && (
                <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4" onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}>
                    <div className="bg-[#111111] border border-indigo-700/50 rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 sm:px-6 sm:pt-6">
                            <h3 className="text-xl font-bold text-orange-400">Remark</h3>
                            <button onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }} className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg">×</button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                            <div className="bg-[#1a1a1a]/50 rounded-xl p-5 border border-white/[0.1]">
                                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.1]">
                                    <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Validation Remark</span>
                                </div>
                                <textarea
                                    value={editingRemarkText}
                                    onChange={(e) => setEditingRemarkText(e.target.value)}
                                    className="w-full bg-transparent text-gray-100 text-sm leading-relaxed resize-none focus:outline-none min-h-[100px] placeholder:text-gray-500"
                                    placeholder="Enter remark..."
                                    rows={4}
                                />
                                <div className="mt-4 pt-3 border-t border-white/[0.1] flex items-center justify-between text-xs text-gray-300">
                                    <span>{editingRemarkText.length} characters</span>
                                    <span>{editingRemarkText.split('\n').length} lines</span>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-[#1a1a1a]/50 border-t border-white/[0.1] flex items-center justify-between">
                            <div className="text-xs text-gray-300">
                                Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded text-gray-500">Esc</kbd> to close
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => (() => { try { navigator.clipboard?.writeText(editingRemarkText); } catch { const t = document.createElement('textarea'); t.value = editingRemarkText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } })()}
                                    className="px-4 py-2 bg-[#1a1a1a] hover:bg-slate-600 text-gray-100 rounded-lg font-medium transition-colors text-sm"
                                >
                                    Copy
                                </button>
                                {editingRemarkText.trim() !== (selectedRemark || '').trim() && editingRemarkProductId && (
                                    <button
                                        onClick={async () => {
                                            if (!editingRemarkProductId) return;
                                            await handleCellEdit(editingRemarkProductId, 'remark', editingRemarkText.trim() || null);
                                            setSelectedRemark(null);
                                            setEditingRemarkText('');
                                            setEditingRemarkProductId(null);
                                        }}
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-emerald-900/20"
                                    >
                                        Save
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                                    className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* REJECT REASON VIEWER MODAL */}
            {selectedRejectReason !== null && (
                <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4" onClick={() => setSelectedRejectReason(null)}>
                    <div className="bg-[#111111] border border-violet-700/50 rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-violet-300">Reject Reason</h3>
                            <button onClick={() => setSelectedRejectReason(null)} className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg">×</button>
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap">{selectedRejectReason}</p>
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

            <PurchaseHistoryDialog
                asin={selectedHistoryAsin}
                marketplace="dropy"
                onClose={() => setSelectedHistoryAsin(null)}
            />
        </>
    )
}
