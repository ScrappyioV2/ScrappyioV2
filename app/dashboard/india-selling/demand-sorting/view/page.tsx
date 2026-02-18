"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from 'next/navigation';
import PageTransition from "@/components/layout/PageTransition";
import Toast from "@/components/Toast";
import Link from "next/link";
import {
    Loader2, ArrowLeft, Search, Filter, Download, ChevronDown,
    Package, TrendingUp, Truck, ArrowRight, X,
    Check, RotateCcw, History, Clock,
} from "lucide-react";

/* ================= CONFIG ================= */
// CONFIG
const TABLE_NAME = "india_demand_sorting";
const HISTORY_TABLE = "india_demand_sorting_movement_history";

const BC_TABLES_BY_FUNNEL: Record<string, string[]> = {
    HD: [
        "india_seller_1_high_demand", "india_seller_2_high_demand",
        "india_seller_3_high_demand", "india_seller_4_high_demand",
        "india_seller_5_high_demand", "india_seller_6_high_demand",
    ],
    DP: [
        "india_seller_1_dropshipping", "india_seller_2_dropshipping",
        "india_seller_3_dropshipping", "india_seller_4_dropshipping",
        "india_seller_5_dropshipping", "india_seller_6_dropshipping",
    ],
};

const ALL_BC_TABLES = [...BC_TABLES_BY_FUNNEL.HD, ...BC_TABLES_BY_FUNNEL.DP];

type FunnelTab = "restock" | "dropshipping";

const TAB_CONFIG: { id: FunnelTab; label: string; funnel_value: string; icon: any }[] = [
    { id: "restock", label: "Restock", funnel_value: "RS", icon: TrendingUp },
    { id: "dropshipping", label: "Dropshipping", funnel_value: "DP", icon: Truck },
];

const FUNNEL_STYLES: Record<string, string> = {
    RS: "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30",
    DP: "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30",
};

// Map Demand Sorting funnel → Brand Checking funnel
const DS_TO_BC_FUNNEL: Record<string, string> = {
    'RS': 'HD',   // Restock → High Demand
    'DP': 'DP',   // Dropshipping stays Dropshipping
};

/* ================= TYPES ================= */
interface ProductRow {
    id: string;
    source_id: string | null;
    tag: string;
    asin: string;
    display_number: number;
    link: string | null;
    product_name: string | null;
    brand: string | null;
    price: number | null;
    monthly_unit: number | null;
    monthly_sales: number | null;
    bsr: number | null;
    seller: number | null;
    category: string | null;
    dimensions: string | null;
    weight: number | null;
    weight_unit: string | null;
    funnel: string | null;
    amz_link: string | null;
    journey_number: number | null;
    remark: string | null;
    status: string | null;
    created_at: string | null;
    updated_at?: string | null;
}

interface Stats {
    total: number;
    restock: number;
    dropshipping: number;
}

/* ================= DEFAULT COLUMN WIDTHS ================= */
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
    asin: 125,
    product_name: 280,
    brand: 110,
    price: 80,
    monthly_unit: 90,
    monthly_sales: 105,
    bsr: 70,
    category: 110,
    weight: 75,
    funnel: 65,
    link: 70,
    amz_link: 70,
    remark: 100,
    created_at: 130,
};

const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
    asin: true,
    product_name: true,
    brand: true,
    price: true,
    monthly_unit: true,
    monthly_sales: true,
    bsr: true,
    category: false,
    weight: true,
    funnel: true,
    link: true,
    amz_link: true,
    remark: true,
    created_at: false,
};

const COLUMN_LABELS: Record<string, string> = {
    asin: "ASIN",
    product_name: "Product Name",
    brand: "Brand",
    price: "Price",
    monthly_unit: "Monthly Units",
    monthly_sales: "Monthly Sales",
    bsr: "BSR",
    category: "Category",
    weight: "Weight",
    funnel: "Funnel",
    link: "Product Link",
    amz_link: "AMZ Link",
    remark: "Remark",
    created_at: "Created At",
};

/* ================= PAGE ================= */
export default function DemandSortingSellerPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    /* ===== STATE ===== */
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [showSpinner, setShowSpinner] = useState(false);
    const spinnerTimeout = useRef<NodeJS.Timeout | null>(null);
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<FunnelTab>(
        (searchParams.get("tab") as FunnelTab) || "restock");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "warning" | "info";
    } | null>(null);
    const [stats, setStats] = useState<Stats>({ total: 0, restock: 0, dropshipping: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState({ brand: "", category: "" });
    const [isApproving, setIsApproving] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
    const [selectedRemark, setSelectedRemark] = useState<string | null>(null);
    const [recentMoves, setRecentMoves] = useState<{ id: string; asin: string; productname: string | null; moved_at: string }[]>([]);
    const [isRollbackOpen, setIsRollbackOpen] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
    const [approvingRowId, setApprovingRowId] = useState<string | null>(null);
    const rowsPerPage = 100;

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        if (typeof window === "undefined") return DEFAULT_COLUMN_WIDTHS;
        try {
            const saved = localStorage.getItem("india_demand_sorting_column_widths");
            if (saved) return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
            return DEFAULT_COLUMN_WIDTHS;
        } catch {
            return DEFAULT_COLUMN_WIDTHS;
        }
    });

    /* ===== COLUMN RESIZE ===== */
    const startResize = (key: string, startX: number) => {
        const startWidth = columnWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 120;
        const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(80, startWidth + (e.clientX - startX));
            setColumnWidths((prev) => {
                const updated = { ...prev, [key]: newWidth };
                localStorage.setItem(
                    "india_demand_sorting_column_widths",
                    JSON.stringify(updated)
                );
                return updated;
            });
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    /* ===== DATA FETCHING ===== */
    const fetchProducts = useCallback(async () => {
        spinnerTimeout.current = setTimeout(() => setShowSpinner(true), 400)
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error
            setProducts(data || [])
        } catch (err) {
            console.error('Fetch error:', err)
            setProducts([])
        } finally {
            if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current)
            setShowSpinner(false)
        }
    }, [])

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select("funnel");

            if (error) throw error;
            if (data) {
                setStats({
                    total: data.length,
                    restock: data.filter((d) => d.funnel === "RS").length,
                    dropshipping: data.filter((d) => d.funnel === "DP").length,
                });
            }
        } catch (err) {
            console.error("Stats error:", err);
        }
    };

    /* ===== FETCH RECENT MOVES (for rollback) ===== */
    const fetchRecentMoves = useCallback(async () => {
        try {
            const { data } = await supabase
                .from(HISTORY_TABLE)
                .select('id, asin, productname, moved_at')
                .order('moved_at', { ascending: false })
                .limit(50)
            setRecentMoves(data || [])
        } catch (err) {
            console.error('Failed to fetch movement history:', err)
        }
    }, [])

    /* ===== SAVE TO MOVEMENT HISTORY ===== */
    const saveToHistory = async (products: ProductRow[]) => {
        const historyRows = products.map((p) => ({
            asin: p.asin,
            productname: p.product_name,
            brand: p.brand,
            funnel: p.funnel,
            monthlyunit: p.monthly_unit,
            productlink: p.link,
            amzlink: p.amz_link,
            remark: p.remark,
            source_table: "india_demand_sorting",
            fullrow: JSON.parse(JSON.stringify(p)),
        }));
        await supabase.from(HISTORY_TABLE).insert(historyRows)
    };

    /* ===== SINGLE ROW APPROVE ===== */
    const handleApproveRow = async (product: ProductRow) => {
        setApprovingRowId(product.id)
        setProducts(prev => prev.filter(p => p.id !== product.id))

        try {
            const bcFunnel = DS_TO_BC_FUNNEL[product.funnel!] || product.funnel
            const targetTables = BC_TABLES_BY_FUNNEL[bcFunnel!] || []

            if (targetTables.length === 0) {
                throw new Error(`No target tables for funnel: ${bcFunnel}`)
            }

            const insertPayload = {
                asin: product.asin,
                product_name: product.product_name,
                brand: product.brand,
                funnel: product.funnel,
                monthly_unit: product.monthly_unit,
                product_link: product.link,
                amz_link: product.amz_link,
                remark: product.remark,
            }

            let insertedCount = 0
            let skippedCount = 0
            for (const bcTable of targetTables) {
                const { error } = await supabase.from(bcTable).insert(insertPayload)
                if (error) {
                    if (error.code === '23505') { skippedCount++; continue }
                    console.error(`Insert error for ${bcTable}:`, error)
                } else {
                    insertedCount++
                }
            }

            // Delete from original demand sorting table (not the view)
            await supabase.from(TABLE_NAME).delete().eq("id", product.id);
            await saveToHistory([product])
            await fetchStats()
            fetchRecentMoves()
            setToast({
                message: `✅ ${product.asin} → ${insertedCount} BC tables (${skippedCount} dupes skipped)`,
                type: 'success',
            })
        } catch (err: any) {
            setProducts(prev => [product, ...prev])
            setToast({ message: `Failed: ${err.message}`, type: 'error' })
        } finally {
            setApprovingRowId(null)
        }
    };

    /* ===== ROLLBACK ===== */
    const handleRollback = async (historyId: string, asin: string) => {
        setIsRollingBack(asin);

        // Optimistic UI — remove from recent moves immediately
        setRecentMoves((prev) => prev.filter((m) => m.id !== historyId));

        try {
            // 1. Get the full row from movement history
            const { data: historyRow, error: histErr } = await supabase
                .from(HISTORY_TABLE)
                .select("fullrow, source_table")
                .eq("id", historyId)
                .single();

            if (histErr || !historyRow?.fullrow) throw new Error("Movement history record not found");
            const originalRow = historyRow.fullrow as Record<string, any>;
            const sourceTable = "india_demand_sorting";

            // 2. Remove id, timestamps — let DB generate new ones
            const { id, created_at, updated_at, source_table: st, ...rowWithoutId } = originalRow;

            // 3. Do ALL operations in parallel: insert + delete from all BC tables + delete history
            const [insertResult] = await Promise.all([
                supabase.from(sourceTable).insert(rowWithoutId),
                ...ALL_BC_TABLES.map((bcTable) =>
                    supabase.from(bcTable).delete().eq("asin", asin)
                ),
                supabase.from(HISTORY_TABLE).delete().eq("id", historyId),
            ]);

            if (insertResult.error) {
                if (insertResult.error.code === "23505") {
                    throw new Error(`${asin} already exists in Demand Sorting`);
                }
                throw insertResult.error;
            }

            // 4. Refresh all data in parallel
            fetchProducts();
            fetchStats();
            fetchRecentMoves();

            setToast({ message: `${asin} rolled back to Demand Sorting`, type: "success" });
        } catch (err: any) {
            // Rollback optimistic UI
            fetchRecentMoves();
            setToast({ message: `Rollback failed: ${err.message}`, type: "error" });
        } finally {
            setIsRollingBack(null);
        }
    };

    useEffect(() => {
        if (authLoading || !user) return;

        fetchProducts();
        fetchStats();
        fetchRecentMoves();

        const channel = supabase
            .channel("demand-sorting-realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: TABLE_NAME }, () => {
                fetchProducts();
                fetchStats();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (spinnerTimeout.current) clearTimeout(spinnerTimeout.current);
        };
    }, [authLoading, user, fetchProducts, fetchRecentMoves]);

    /* ===== CLEAR ON TAB SWITCH ===== */
    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
        setSearchQuery("");
        setFilters({ brand: "", category: "" });
    }, [activeTab]);

    /* ===== FILTERING ===== */
    const activeFunnel = TAB_CONFIG.find((t) => t.id === activeTab)!.funnel_value;

    const allFilteredProducts = useMemo(() => {
        let result = products.filter((p) => p.funnel === activeFunnel);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (p) =>
                    p.asin?.toLowerCase().includes(query) ||
                    p.product_name?.toLowerCase().includes(query) ||
                    p.brand?.toLowerCase().includes(query)
            );
        }

        if (filters.brand) {
            result = result.filter((p) =>
                p.brand?.toLowerCase().includes(filters.brand.toLowerCase())
            );
        }
        if (filters.category) {
            result = result.filter((p) =>
                p.category?.toLowerCase().includes(filters.category.toLowerCase())
            );
        }

        return result;
    }, [products, activeFunnel, searchQuery, filters]);

    const paginatedProducts = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return allFilteredProducts.slice(startIndex, startIndex + rowsPerPage);
    }, [allFilteredProducts, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(allFilteredProducts.length / rowsPerPage);

    /* ===== SELECTION ===== */
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
        setSelectedIds(newSelected);
    };

    /* ===== APPROVE TO BRAND CHECKING ===== */
    const handleApproveToBrandChecking = async () => {
        if (selectedIds.size === 0) {
            setToast({ message: 'No items selected', type: 'warning' }); return
        }

        const confirmed = window.confirm(
            `Move ${selectedIds.size} items to ALL 6 Brand Checking tables?`
        )
        if (!confirmed) return

        setIsApproving(true)
        const idsArray = Array.from(selectedIds)
        const selectedProducts = products.filter(p => idsArray.includes(p.id))

        // Optimistic UI
        setProducts(prev => prev.filter(p => !selectedIds.has(p.id)))
        setSelectedIds(new Set())

        try {
            const byFunnel: Record<string, typeof selectedProducts> = {}
            for (const p of selectedProducts) {
                const bcFunnel = DS_TO_BC_FUNNEL[p.funnel!] || p.funnel!
                if (!byFunnel[bcFunnel]) byFunnel[bcFunnel] = []
                byFunnel[bcFunnel].push(p)
            }

            let totalInserted = 0
            let totalSkipped = 0

            for (const [bcFunnel, prods] of Object.entries(byFunnel)) {
                const targetTables = BC_TABLES_BY_FUNNEL[bcFunnel] || []
                const insertPayload = prods.map(p => ({
                    asin: p.asin,
                    product_name: p.product_name,
                    brand: p.brand,
                    funnel: p.funnel,
                    monthly_unit: p.monthly_unit,
                    product_link: p.link,
                    amz_link: p.amz_link,
                    remark: p.remark,
                }))

                for (const bcTable of targetTables) {
                    const { error: batchError } = await supabase.from(bcTable).insert(insertPayload)
                    if (batchError) {
                        if (batchError.code === '23505') {
                            for (const row of insertPayload) {
                                const { error: rowError } = await supabase.from(bcTable).insert(row)
                                if (rowError) {
                                    if (rowError.code === '23505') { totalSkipped++; continue }
                                } else { totalInserted++ }
                            }
                        } else {
                            console.error(`Batch error for ${bcTable}:`, batchError)
                        }
                    } else {
                        totalInserted += prods.length
                    }
                }
            }  // ← closes for-of byFunnel

            // Delete from source tables
            // Delete from demand sorting table
            const idsToDelete = selectedProducts.map((p) => p.id);
            await supabase.from(TABLE_NAME).delete().in("id", idsToDelete);

            await saveToHistory(selectedProducts)
            await fetchStats()
            await fetchRecentMoves()

            const parts: string[] = []
            if (totalInserted > 0) parts.push(`${totalInserted} inserted`)
            if (totalSkipped > 0) parts.push(`${totalSkipped} dupes skipped`)
            setToast({
                message: `✅ ${selectedProducts.length} ASINs → all 6 BC tables (${parts.join(', ')})`,
                type: totalSkipped > 0 && totalInserted === 0 ? 'warning' : 'success',
            })
        } catch (err: any) {
            console.error('Approve error:', err)
            setProducts(prev => [...selectedProducts, ...prev])
            setSelectedIds(new Set(idsArray))
            setToast({ message: `Failed: ${err.message}`, type: 'error' })
        } finally {
            setIsApproving(false)
        }
    }

    const renderFunnelBadge = (funnel: string | null) => {
        if (!funnel) return <span className="text-slate-600">-</span>;
        const tag = funnel.trim();
        return (
            <span
                className={`w-8 h-7 inline-flex items-center justify-center rounded-lg font-bold text-xs ${FUNNEL_STYLES[tag] ?? "bg-gray-400 text-white"
                    }`}
            >
                {tag}
            </span>
        );
    };

    return (
        <PageTransition>
            <div className="h-screen flex flex-col overflow-hidden bg-slate-950 p-6 text-slate-200 font-sans selection:bg-indigo-500/30">
                <div className="w-full flex flex-col flex-1 overflow-hidden">

                    {/* ===== HEADER (flex-none = fixed) ===== */}
                    <div className="flex-none">
                        <div className="mb-4">
                            <Link
                                href="/dashboard/india-selling/demand-sorting"
                                className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 mb-3 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Demand Sorting Dashboard
                            </Link>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                                <Package className="w-7 h-7 text-indigo-500" />
                                Demand Sorting
                            </h1>
                            <p className="text-slate-400 mt-1 text-sm">
                                Review and approve products — sends to all 6 Brand Checking tables
                            </p>
                        </div>

                        {/* Stats Cards */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <div className="flex items-center gap-2.5 bg-slate-800/80 rounded-lg px-3.5 py-2 border border-slate-700/50">
                                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total</span>
                                <span className="text-lg font-bold text-white">{stats.total}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-emerald-900/30 rounded-lg px-3.5 py-2 border border-emerald-500/20">
                                <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Restock</span>
                                <span className="text-lg font-bold text-emerald-300">{stats.restock}</span>
                            </div>
                            <div className="flex items-center gap-2.5 bg-amber-900/30 rounded-lg px-3.5 py-2 border border-amber-500/20">
                                <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Dropshipping</span>
                                <span className="text-lg font-bold text-amber-300">{stats.dropshipping}</span>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-4 p-1.5 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit backdrop-blur-sm">
                            {TAB_CONFIG.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-2 ${activeTab === tab.id
                                            ? "text-white bg-slate-800 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] border border-slate-700"
                                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent"
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id
                                            ? "bg-indigo-500/20 text-indigo-300"
                                            : "bg-slate-700 text-slate-400"
                                            }`}>
                                            {tab.id === "restock" ? stats.restock : stats.dropshipping}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Controls Row */}
                        <div className="mb-4 flex items-center justify-between gap-3">
                            {/* Left: Search + Filter + Column Selector */}
                            <div className="flex gap-3 flex-1 min-w-[300px]">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                                    <input
                                        type="text"
                                        placeholder="Search by ASIN, Product Name, or Brand..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-200 placeholder-slate-600 transition-all shadow-sm"
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Filter */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                                        className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 text-sm font-medium flex items-center gap-2 transition-colors"
                                    >
                                        <Filter className="w-4 h-4" />
                                        Filter
                                    </button>
                                    {isFilterOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                                            <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-64">
                                                <h3 className="font-semibold text-slate-200 mb-3">Filters</h3>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-400 mb-1">Brand</label>
                                                        <input type="text" value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-600" placeholder="Enter brand" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                                                        <input type="text" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-600" placeholder="Enter category" />
                                                    </div>
                                                    <button onClick={() => setFilters({ brand: "", category: "" })} className="w-full px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white font-medium text-sm transition-colors">
                                                        Clear Filters
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Column Selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsColumnSelectorOpen(!isColumnSelectorOpen)}
                                        className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 text-sm font-medium flex items-center gap-2 transition-colors"
                                    >
                                        Columns
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                    {isColumnSelectorOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsColumnSelectorOpen(false)} />
                                            <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-20 w-56 max-h-80 overflow-y-auto">
                                                {Object.keys(DEFAULT_VISIBLE_COLUMNS).map((col) => (
                                                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer text-xs text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns[col]}
                                                            onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col]: e.target.checked }))}
                                                            className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                                        />
                                                        {COLUMN_LABELS[col] || col}
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Right: Undo + Approve */}
                            <div className="flex items-center gap-3">
                                {/* Rollback Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsRollbackOpen(!isRollbackOpen)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors border ${recentMoves.length > 0
                                            ? "bg-amber-900/30 text-amber-300 border-amber-500/30 hover:bg-amber-900/50"
                                            : "bg-slate-800 text-slate-500 border-slate-700 cursor-default"
                                            }`}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Undo
                                        {recentMoves.length > 0 && (
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20">
                                                {recentMoves.length}
                                            </span>
                                        )}
                                    </button>
                                    {isRollbackOpen && recentMoves.length > 0 && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsRollbackOpen(false)} />
                                            <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 w-96 max-h-80 overflow-hidden">
                                                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                                                    <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                                                        <History className="w-4 h-4 text-amber-400" />
                                                        Recent Moves
                                                    </h3>
                                                    <span className="text-xs text-slate-500">Click to rollback</span>
                                                </div>
                                                <div className="overflow-y-auto max-h-64">
                                                    {recentMoves.map((move) => (
                                                        <div key={move.id} className="px-4 py-2.5 border-b border-slate-800/50 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-mono text-indigo-300 truncate">{move.asin}</p>
                                                                <p className="text-xs text-slate-500 truncate">{move.productname}</p>
                                                                <p className="text-[10px] text-slate-600 flex items-center gap-1 mt-0.5">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(move.moved_at).toLocaleString()}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleRollback(move.id, move.asin)}
                                                                disabled={isRollingBack === move.asin}
                                                                className="ml-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600/20 text-amber-300 hover:bg-amber-600/40 border border-amber-500/30 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                                                            >
                                                                {isRollingBack === move.asin ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                                Undo
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Bulk Approve Button */}
                                <button
                                    onClick={handleApproveToBrandChecking}
                                    disabled={selectedIds.size === 0 || isApproving}
                                    className={`px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition whitespace-nowrap shadow-lg ${selectedIds.size === 0
                                        ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700"
                                        : "bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500 shadow-indigo-900/20"
                                        }`}
                                >
                                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    Approve to Brand Checking ({selectedIds.size})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ===== TABLE (flex-1 = scrollable) ===== */}
                    <div className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-900/30 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        {showSpinner && products.length === 0 ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            </div>
                        ) : paginatedProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                <Package className="w-12 h-12 mb-3 opacity-50" />
                                <p className="text-lg font-medium">No items found in {activeTab}</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            <table className="w-full border-collapse table-fixed">
                                <thead className="sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950 text-center w-10">
                                            <input
                                                type="checkbox"
                                                checked={paginatedProducts.length > 0 && paginatedProducts.every((p) => selectedIds.has(p.id))}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950 text-center w-10">#</th>
                                        {Object.keys(DEFAULT_VISIBLE_COLUMNS).map(
                                            (col) =>
                                                visibleColumns[col] && (
                                                    <th
                                                        key={col}
                                                        style={{ minWidth: columnWidths[col] || DEFAULT_COLUMN_WIDTHS[col], width: columnWidths[col] || DEFAULT_COLUMN_WIDTHS[col] }}
                                                        className="relative px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950 text-left select-none"
                                                    >
                                                        <div className="truncate">{COLUMN_LABELS[col] || col}</div>
                                                        <span onMouseDown={(e) => startResize(col, e.clientX)} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" />
                                                    </th>
                                                )
                                        )}
                                        <th className="px-3 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-950 text-center w-24 sticky right-0">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map((product, index) => (
                                        <tr key={product.id} className={`border-b border-slate-800/50 transition-colors ${selectedIds.has(product.id) ? "bg-indigo-500/10" : "hover:bg-slate-800/30"}`}>
                                            <td className="px-3 py-2.5 text-center">
                                                <input type="checkbox" checked={selectedIds.has(product.id)} onChange={(e) => handleSelectRow(product.id, e.target.checked)} className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 w-4 h-4 cursor-pointer" />
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-xs text-slate-500">{(currentPage - 1) * rowsPerPage + index + 1}</td>
                                            {visibleColumns.asin && <td className="px-3 py-2.5 text-sm font-mono text-indigo-300 truncate overflow-hidden" style={{ maxWidth: columnWidths.asin }}>{product.asin}</td>}
                                            {visibleColumns.product_name && <td className="px-3 py-2.5 text-sm text-slate-300 truncate overflow-hidden" title={product.product_name} style={{ maxWidth: columnWidths.product_name }}>{product.product_name || "-"}</td>}
                                            {visibleColumns.brand && <td className="px-3 py-2.5 text-sm text-slate-300 truncate overflow-hidden">{product.brand || "-"}</td>}
                                            {visibleColumns.price && <td className="px-3 py-2.5 text-sm text-emerald-400 font-medium">{product.price != null ? `₹${Number(product.price).toLocaleString()}` : "-"}</td>}
                                            {visibleColumns.monthly_unit && <td className="px-3 py-2.5 text-sm text-slate-300 text-center">{product.monthly_unit ?? "-"}</td>}
                                            {visibleColumns.monthly_sales && <td className="px-3 py-2.5 text-sm text-slate-300">{product.monthly_sales != null ? `₹${Number(product.monthly_sales).toLocaleString()}` : "-"}</td>}
                                            {visibleColumns.bsr && <td className="px-3 py-2.5 text-sm text-slate-400 text-center">{product.bsr ?? "-"}</td>}
                                            {visibleColumns.category && <td className="px-3 py-2.5 text-sm text-slate-400 truncate overflow-hidden">{product.category || "-"}</td>}
                                            {visibleColumns.weight && <td className="px-3 py-2.5 text-sm text-slate-400 text-center">{product.weight != null ? `${product.weight} ${product.weight_unit || "kg"}` : "-"}</td>}
                                            {visibleColumns.funnel && <td className="px-3 py-2.5 text-center">{renderFunnelBadge(product.funnel)}</td>}
                                            {visibleColumns.link && <td className="px-3 py-2.5 text-center">{product.link ? <a href={product.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs font-medium">View</a> : <span className="text-slate-600">-</span>}</td>}
                                            {visibleColumns.amz_link && <td className="px-3 py-2.5 text-center">{product.amz_link ? <a href={product.amz_link} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 text-xs font-medium">Check</a> : <span className="text-slate-600">-</span>}</td>}
                                            {visibleColumns.remark && <td className="px-3 py-2.5 text-center">{product.remark ? <button onClick={() => setSelectedRemark(product.remark)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-md text-xs font-medium transition-colors">View</button> : <span className="text-slate-600">-</span>}</td>}
                                            {visibleColumns.created_at && <td className="px-3 py-2.5 text-xs text-slate-500 truncate">{product.created_at ? new Date(product.created_at).toLocaleDateString() : "-"}</td>}
                                            <td className="px-3 py-2.5 text-center sticky right-0 bg-slate-950/90 backdrop-blur-sm">
                                                <button
                                                    onClick={() => handleApproveRow(product)}
                                                    disabled={approvingRowId === product.id}
                                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30 transition-all disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                                                >
                                                    {approvingRowId === product.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    Approve
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ===== PAGINATION (flex-none = fixed at bottom) ===== */}
                    {allFilteredProducts.length > rowsPerPage && (
                        <div className="flex-none flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900">
                            <span className="text-sm text-slate-400">
                                Showing <span className="font-bold text-slate-200">{paginatedProducts.length}</span> of{" "}
                                <span className="font-bold text-slate-200">{allFilteredProducts.length}</span> products
                                {selectedIds.size > 0 && (
                                    <span className="ml-4">
                                        <span className="font-bold text-indigo-400">{selectedIds.size}</span> selected
                                    </span>
                                )}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">First</button>
                                <button onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">Previous</button>
                                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Page {currentPage} of {totalPages}</span>
                                <button onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">Next</button>
                                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700">Last</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== REMARK MODAL ===== */}
                {selectedRemark && (
                    <>
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setSelectedRemark(null)} />
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                            <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white p-5 flex justify-between items-center">
                                    <h2 className="text-lg font-bold">Remark</h2>
                                    <button onClick={() => setSelectedRemark(null)} className="hover:bg-white/20 rounded-lg p-1 transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6">
                                    <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{selectedRemark}</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </PageTransition>
    );
}