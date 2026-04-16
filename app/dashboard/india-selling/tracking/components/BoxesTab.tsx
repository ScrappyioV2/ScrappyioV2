"use client";

import { supabase } from "@/lib/supabaseClient";
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getFunnelBadgeStyle } from "@/lib/utils";
import GenericRollbackModal from "@/components/india-selling/GenericRollbackModal";
import VyaparBoxForm from './VyaparBoxForm';

// ============================================
// TOAST NOTIFICATION
// ============================================
type ToastType = "success" | "error" | "warning";

function Toast({
    message,
    type,
    onClose,
}: {
    message: string;
    type: ToastType;
    onClose: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const styles: Record<ToastType, string> = {
        success: "bg-emerald-600 border-emerald-400",
        error: "bg-red-600 border-red-400",
        warning: "bg-amber-600 border-amber-400",
    };

    const icons: Record<ToastType, string> = {
        success: "✅",
        error: "❌",
        warning: "⚠️",
    };

    return (
        <div
            className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border shadow-2xl text-white text-xs sm:text-sm font-medium animate-slide-in max-w-[calc(100vw-2rem)] ${styles[type]}`}
            style={{
                animation: "slideIn 0.3s ease-out",
            }}
        >
            <span className="text-lg">{icons[type]}</span>
            <span>{message}</span>
            <button
                onClick={onClose}
                className="ml-2 text-white/70 hover:text-white text-lg leading-none"
            >
                ×
            </button>
        </div>
    );
}

// ============================================
// CONFIRMATION MODAL
// ============================================
function ConfirmModal({
    open,
    title,
    message,
    confirmLabel,
    confirmColor,
    showReason,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmColor?: string;
    showReason?: boolean;
    onConfirm: (reason?: string) => void;
    onCancel: () => void;
}) {
    const [reason, setReason] = useState("");

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111111]/60 p-3 sm:p-4">
            <div className="w-full max-w-md bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-2">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>

                {/* Body */}
                <div className="px-6 pb-5">
                    <p className="text-sm text-gray-300 leading-relaxed">{message}</p>

                    {showReason && (
                        <div className="mt-3">
                            <label className="block text-xs text-gray-400 mb-1">
                                Reason for deletion
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim()) { onConfirm(reason); } }}
                                placeholder="e.g. Wrong items, duplicate box..."
                                className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#1a1a1a] border-t border-white/[0.1]">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#111111] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason || undefined)}
                        disabled={showReason && !reason.trim()}
                        className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${confirmColor || "bg-orange-500 hover:bg-orange-400"
                            }`}
                    >
                        {confirmLabel || "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function BoxSummaryModal({
    open,
    boxId,
    totalWeight,
    items,
    quantities,
    weights,
    onQuantityChange,
    onWeightChange,
    onTotalWeightChange,
    onRemoveItem,
    onConfirm,
    onCancel,
    submitting,
}: {
    open: boolean;
    boxId: string;
    totalWeight: number | null;
    items: any[];
    quantities: Record<string, number>;
    weights: Record<string, number>;
    onQuantityChange: (id: string, val: number) => void;
    onWeightChange: (id: string, val: number) => void;
    onTotalWeightChange: (val: number | null) => void;
    onRemoveItem: (id: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    submitting: boolean;
}) {
    if (!open) return null;

    const totalQty = items.reduce(
        (s: number, i: any) => s + (quantities[i.id] ?? 0),
        0,
    );

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111111]/60 p-2 sm:p-4">
            <div className="w-full max-w-5xl max-h-[90vh] bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/[0.1] flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            📦 Box Summary — {boxId}
                        </h2>
                        <p className="text-xs text-gray-400 mt-1">
                            {items.length} items · {totalQty} total qty — Review
                            before saving
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        &times;
                    </button>
                </div>

                {/* Items table */}
                <div className="flex-1 overflow-auto px-5 py-4">
                    <table className="w-full text-sm">
                        <thead className="bg-[#111111]/60">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400">
                                    ASIN
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400">
                                    Product
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400">
                                    Price
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400">
                                    Qty
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400">
                                    Weight
                                </th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.06]">
                            {items.map((item: any) => {
                                const rawPending =
                                    (item as any).pending_quantity ??
                                    item.buying_quantity ??
                                    0;
                                const maxQty = Math.max(rawPending, quantities[item.id] ?? 0);
                                return (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-white/[0.05]"
                                    >
                                        <td className="px-6 py-4 font-mono text-gray-300">
                                            {item.asin}
                                        </td>
                                        <td className="px-6 py-4 text-gray-100 max-w-[200px]">
                                            <div className="flex items-center">
                                                <span className="truncate">{item.product_name || "-"}</span>
                                                {item.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-300">
                                            {item.buying_price
                                                ? `₹${item.buying_price}`
                                                : "-"}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                max={maxQty}
                                                value={
                                                    quantities[item.id] ?? 0
                                                }
                                                onChange={e =>
                                                    onQuantityChange(
                                                        item.id,
                                                        Math.min(
                                                            Number(
                                                                e.target.value,
                                                            ) || 0,
                                                            maxQty,
                                                        ),
                                                    )
                                                }
                                                className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={weights[item.id] ?? 0}
                                                onChange={e =>
                                                    onWeightChange(
                                                        item.id,
                                                        Number(
                                                            e.target.value,
                                                        ) || 0,
                                                    )
                                                }
                                                className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() =>
                                                    onRemoveItem(item.id)
                                                }
                                                className="text-rose-400 hover:text-rose-300 text-xs"
                                            >
                                                ✕
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/[0.1] flex items-center justify-between">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-[#111111]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={submitting || items.length === 0}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                        {submitting
                            ? "Saving..."
                            : `✓ Confirm & Save (${items.length} items)`}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// TYPES
// ============================================
type BoxProduct = {
    id: string;
    asin: string;
    journey_id: string | null;
    product_name: string | null;
    brand: string | null;
    sku: string | null;
    seller_tag: string | null;
    funnel: string | null;
    origin: string | null;
    origin_india: boolean;
    origin_china: boolean;
    origin_us: boolean;
    product_link: string | null;
    inr_purchase_link: string | null;
    usd_price: number | null;
    inr_purchase: number | null;
    target_price: number | null;
    admin_target_price: number | null;
    target_quantity: number | null;
    funnel_quantity: number | null;
    funnel_seller: string | null;
    buying_price: number | null;
    buying_quantity: number | null;
    quantity_assigned: number | null;   // ← ADD THIS
    ordered_quantity: number | null;
    seller_link: string | null;
    seller_phone: string | null;
    payment_method: string | null;
    tracking_details: string | null;
    delivery_date: string | null;
    order_date: string | null;
    product_weight: number | null;
    box_number: string | null;
    box_status: string;
    booking_date: string | null;
    moved_from_inbound_at: string | null;
    created_at: string | null;
    shipment_id?: string | null;
    box_created_at?: string | null;
    total_box_weight?: number | null;
    inbound_tracking_id?: string | null;
    sns_active?: boolean;
};

type GroupedBox = {
    box_number: string;
    items: BoxProduct[];
    total_items: number;
    total_quantity: number;
    status: string;
};

interface BoxesTabProps {
    onCountsChange: () => void;
    refreshKey?: number;
}


// ============================================
// COMPONENT
// ============================================
export default function BoxesTab({ onCountsChange, refreshKey }: BoxesTabProps) {
    const [products, setProducts] = useState<BoxProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [moving, setMoving] = useState(false);
    const [expandedBoxes, setExpandedBoxes] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
    const [isAddingBox, setIsAddingBox] = useState(() => {
        try {
            return !!sessionStorage.getItem('vyapar-box-form-create');
        } catch { return false; }
    });
    const [newBoxId, setNewBoxId] = useState("");
    const [boxBookingDate, setBoxBookingDate] = useState("");
    const [addSearch, setAddSearch] = useState("");
    const [addItems, setAddItems] = useState<BoxProduct[]>([]);
    const [addQuantities, setAddQuantities] = useState<Record<string, number>>({});
    const [addWeights, setAddWeights] = useState<Record<string, number>>({});
    const [savingBox, setSavingBox] = useState(false);
    const [rollbackOpen, setRollbackOpen] = useState(false);
    const [inboundDelivered, setInboundDelivered] = useState<any[]>([]);
    const [boxTotalWeight, setBoxTotalWeight] = useState<number | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [editBoxData, setEditBoxData] = useState<GroupedBox | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from("india_box_history")
                .select("*")
                .order("archived_at", { ascending: false });
            if (error) throw error;
            setHistoryData(data || []);
        } catch (err) {
            console.error("Error fetching box history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };
    const searchRef = useRef<HTMLDivElement>(null);
    // Toast state
    const [toast, setToast] = useState<{
        message: string;
        type: ToastType;
    } | null>(null);

    const showToast = useCallback((message: string, type: ToastType) => {
        setToast({ message, type });
    }, []);

    // Confirm modal state
    const [confirmModal, setConfirmModal] = useState<{
        title: string;
        message: string;
        confirmLabel?: string;
        confirmColor?: string;
        showReason?: boolean;
        onConfirm: (reason?: string) => void;
    } | null>(null);

    const showConfirm = useCallback(
        (opts: {
            title: string;
            message: string;
            confirmLabel?: string;
            confirmColor?: string;
            showReason?: boolean;
            onConfirm: (reason?: string) => void;
        }) => {
            setConfirmModal(opts);
        },
        [],
    );

    // FETCH
    const fetchProducts = async () => {
        try {
            setLoading(true);
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from("india_inbound_boxes")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .range(from, from + batchSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    from += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            setProducts(allData);
        } catch (error) {
            console.error("Error fetching box products:", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshSilently = async () => {
        try {
            const { data, error } = await supabase
                .from("india_inbound_boxes")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error("Error refreshing box products:", error);
        }
    };

    const fetchInboundDelivered = async () => {
        try {
            const { data, error } = await supabase
                .from("india_inbound_tracking")
                .select("*")
                .eq("status", "delivered")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setInboundDelivered(data || []);
        } catch (error) {
            console.error("Error fetching inbound delivered:", error);
        }
    };

    // REALTIME
    useEffect(() => {
        fetchProducts();
        fetchInboundDelivered();

        const channel = supabase
            .channel("box-tracking-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "india_inbound_boxes" },
                () => {
                    refreshSilently();
                    onCountsChange();
                },
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "india_inbound_tracking" },
                () => {
                    fetchInboundDelivered();
                },
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (refreshKey) { refreshSilently(); fetchInboundDelivered(); }
    }, [refreshKey]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDeleteBox = (boxNumber: string) => {
        const boxItems = products.filter(p => p.box_number === boxNumber);
        if (boxItems.length === 0) return;

        showConfirm({
            title: "Delete Box",
            message: `Delete box ${boxNumber} and remove it from ${boxItems.length} items? Quantities will be returned to Inbound pending.`,
            confirmLabel: "Delete Box",
            confirmColor: "bg-red-600 hover:bg-red-500",
            showReason: true,
            onConfirm: async (reason?: string) => {
                setConfirmModal(null);

                try {
                    // 1) Fetch all rows for this box (ensure we have latest qty + inbound ids)
                    const { data: rows, error: fetchError } = await supabase
                        .from("india_inbound_boxes")
                        .select("id, inbound_tracking_id, asin, quantity_assigned")
                        .eq("box_number", boxNumber);

                    if (fetchError) throw fetchError;

                    if (!rows || rows.length === 0) {
                        showToast("No items found for this box.", "warning");
                        return;
                    }

                    // 2) Roll back quantities to inbound tracking
                    // 2) Roll back quantities to inbound tracking
                    // Group box rows by ASIN first (so multi-seller ASINs restore as one row)
                    const byAsinTag = new Map<string, { rows: any[]; totalQty: number; asin: string; sellerTag: string }>();
                    for (const row of rows as any[]) {
                        const qty = row.quantity_assigned ?? 0;
                        if (qty <= 0) continue;
                        const key = `${row.asin}|${row.seller_tag || ''}`;
                        const existing = byAsinTag.get(key) || { rows: [], totalQty: 0, asin: row.asin, sellerTag: row.seller_tag || '' };
                        existing.rows.push(row);
                        existing.totalQty += qty;
                        byAsinTag.set(key, existing);
                    }

                    for (const [_key, group] of byAsinTag) {
                        const asin = group.asin;
                        const firstRow = group.rows[0];
                        const totalQty = group.totalQty;
                        const inboundId = firstRow.inbound_tracking_id ?? null;

                        let inboundRow: any = null;

                        if (inboundId) {
                            const { data } = await supabase
                                .from("india_inbound_tracking")
                                .select("id, assigned_quantity, pending_quantity")
                                .eq("id", inboundId)
                                .limit(1);
                            inboundRow = data?.[0];
                        }

                        if (!inboundRow) {
                            const { data } = await supabase
                                .from("india_inbound_tracking")
                                .select("id, assigned_quantity, pending_quantity")
                                .eq("asin", asin)
                                .eq("seller_tag", group.sellerTag || group.rows[0]?.seller_tag || '')
                                .limit(1);
                            inboundRow = data?.[0];
                        }

                        if (inboundRow) {
                            // Row exists — add qty back
                            const { error } = await supabase
                                .from("india_inbound_tracking")
                                .update({
                                    assigned_quantity: Math.max(0, (inboundRow.assigned_quantity ?? 0) - totalQty),
                                    pending_quantity: (inboundRow.pending_quantity ?? 0) + totalQty,
                                })
                                .eq("id", inboundRow.id);
                            if (error) console.error("Failed to rollback inbound tracking", error);
                        } else {
                            // ✅ Row was deleted — re-create as single row with combined seller tags
                            const { data: boxRow } = await supabase
                                .from("india_inbound_boxes")
                                .select("*")
                                .eq("id", firstRow.id)
                                .single();

                            if (boxRow) {
                                const singleTag = group.sellerTag || group.rows[0]?.seller_tag || '';
                                const { error: insertErr } = await supabase
                                    .from("india_inbound_tracking")
                                    .insert({
                                        asin: boxRow.asin,
                                        product_name: boxRow.product_name,
                                        sku: boxRow.sku,
                                        seller_tag: singleTag,
                                        funnel: boxRow.funnel,
                                        origin: boxRow.origin,
                                        origin_india: boxRow.origin_india ?? false,
                                        origin_china: boxRow.origin_china ?? false,
                                        origin_us: boxRow.origin_us ?? false,
                                        buying_price: boxRow.buying_price,
                                        buying_quantity: totalQty,
                                        product_weight: boxRow.product_weight,
                                        product_link: boxRow.product_link,
                                        seller_link: boxRow.seller_link,
                                        pending_quantity: totalQty,
                                        assigned_quantity: 0,
                                        status: 'tracking',
                                        moved_at: new Date().toISOString(),
                                    });
                                if (insertErr) console.error(`Failed to re-create inbound for ${asin}:`, insertErr);
                            }
                        }
                    }

                    const { data: fullBoxRows } = await supabase
                        .from("india_inbound_boxes")
                        .select("*")
                        .eq("box_number", boxNumber);

                    if (fullBoxRows && fullBoxRows.length > 0) {
                        const historyRows = fullBoxRows.map((r: any) => ({
                            box_number: r.box_number,
                            inbound_tracking_id: r.inbound_tracking_id ?? null,
                            asin: r.asin ?? null,
                            product_name: r.product_name ?? null,
                            sku: r.sku ?? null,
                            seller_tag: r.seller_tag ?? null,
                            funnel: r.funnel ?? null,
                            origin: r.origin ?? null,
                            origin_india: r.origin_india ?? false,
                            origin_china: r.origin_china ?? false,
                            origin_us: r.origin_us ?? false,
                            buying_price: r.buying_price ?? null,
                            buying_quantity: r.buying_quantity ?? null,
                            quantity_assigned: r.quantity_assigned ?? null,
                            product_weight: r.product_weight ?? null,
                            total_box_weight: r.total_box_weight ?? null,
                            box_status: r.box_status ?? null,
                            box_booking_date: r.box_booking_date ?? null,
                            tracking_details: r.tracking_details ?? null,
                            delivery_date: r.delivery_date ?? null,
                            order_date: r.order_date ?? null,
                            product_link: r.product_link ?? null,
                            seller_link: r.seller_link ?? null,
                            journey_id: r.journey_id ?? null,
                            action: 'deleted',
                            reason: reason || null,
                            original_created_at: r.created_at ?? null,
                        }));

                        await supabase.from("india_box_history").insert(historyRows);
                    }

                    // 3) Delete the box rows themselves
                    const boxIds = (rows as any[]).map(r => r.id);

                    const { error: deleteError } = await supabase
                        .from("india_inbound_boxes")
                        .delete()
                        .in("id", boxIds);

                    if (deleteError) throw deleteError;

                    // 4) Refresh UI and notify
                    await refreshSilently();
                    onCountsChange();

                    showToast(
                        `Box ${boxNumber} deleted${reason ? ` — ${reason}. Quantities returned to Inbound.` : ". Quantities returned to Inbound."}`,
                        "success",
                    );
                } catch (error) {
                    console.error("Error deleting box with rollback:", error);
                    showToast("Failed to delete box.", "error");
                }
            },
        });
    };

    // MOVE TO CHECKING
    const handleMoveToChecking = (boxNumber: string) => {
        const boxItems = products.filter(p => p.box_number === boxNumber);
        if (boxItems.length === 0) return;

        showConfirm({
            title: "✅ Move to Checking",
            message: `Move box "${boxNumber}" (${boxItems.length} items) to Checking? Items will be removed from Boxes and added to the Checking stage.`,
            confirmLabel: "Move to Checking",
            confirmColor: "bg-emerald-600 hover:bg-emerald-500",
            onConfirm: async () => {
                setConfirmModal(null);
                setMoving(true);
                try {
                    const dataToInsert = boxItems.map(p => ({
                        // 1. Maintain database linkage for history & rollbacks
                        inbound_tracking_id: (p as any).inbound_tracking_id ?? null,
                        inbound_box_id: p.id,

                        // 2. Standard identifiers
                        asin: p.asin,
                        journey_id: p.journey_id,
                        product_name: p.product_name,
                        brand: p.brand,
                        sku: p.sku,
                        seller_tag: p.seller_tag,
                        funnel: p.funnel,
                        origin: p.origin,
                        origin_india: p.origin_india,
                        origin_china: p.origin_china,
                        origin_us: p.origin_us,
                        product_link: p.product_link,
                        inr_purchase_link: p.inr_purchase_link,
                        usd_price: p.usd_price,
                        inr_purchase: p.inr_purchase,
                        target_price: p.target_price,
                        admin_target_price: p.admin_target_price,
                        target_quantity: p.target_quantity,
                        funnel_quantity: p.funnel_quantity,
                        funnel_seller: p.funnel_seller,
                        buying_price: p.buying_price,
                        buying_quantity: p.buying_quantity,

                        // 3. CRITICAL: Pass the specifically assigned box quantities
                        expected_quantity: p.ordered_quantity ?? p.buying_quantity ?? 0,
                        actual_quantity: p.quantity_assigned ?? p.buying_quantity ?? 0,
                        good_quantity: p.quantity_assigned ?? p.buying_quantity ?? 0,
                        damaged_quantity: 0,

                        // 4. Tracking and delivery data
                        seller_link: p.seller_link,
                        seller_phone: p.seller_phone,
                        payment_method: p.payment_method,
                        tracking_details: p.tracking_details,
                        delivery_date: p.delivery_date,
                        order_date: p.order_date,
                        product_weight: p.product_weight,
                        box_number: p.box_number,

                        // 5. Checking Stage initial states
                        status: "pending",
                        check_status: "pending",
                        check_brand: false,
                        check_item_expire: false,
                        check_small_size: false,
                        check_multi_seller: false,
                        moved_from_boxes_at: new Date().toISOString(),
                    }));

                    const { error: insertError } = await supabase
                        .from("india_box_checking")
                        .insert(dataToInsert);
                    if (insertError) throw insertError;

                    const { data: fullBoxRows } = await supabase
                        .from("india_inbound_boxes")
                        .select("*")
                        .eq("box_number", boxNumber);

                    if (fullBoxRows && fullBoxRows.length > 0) {
                        const historyRows = fullBoxRows.map((r: any) => ({
                            box_number: r.box_number,
                            inbound_tracking_id: r.inbound_tracking_id ?? null,
                            asin: r.asin ?? null,
                            product_name: r.product_name ?? null,
                            sku: r.sku ?? null,
                            seller_tag: r.seller_tag ?? null,
                            funnel: r.funnel ?? null,
                            origin: r.origin ?? null,
                            origin_india: r.origin_india ?? false,
                            origin_china: r.origin_china ?? false,
                            origin_us: r.origin_us ?? false,
                            buying_price: r.buying_price ?? null,
                            buying_quantity: r.buying_quantity ?? null,
                            quantity_assigned: r.quantity_assigned ?? null,
                            product_weight: r.product_weight ?? null,
                            total_box_weight: r.total_box_weight ?? null,
                            box_status: r.box_status ?? null,
                            box_booking_date: r.booking_date ?? null,
                            tracking_details: r.tracking_details ?? null,
                            delivery_date: r.delivery_date ?? null,
                            order_date: r.order_date ?? null,
                            product_link: r.product_link ?? null,
                            seller_link: r.seller_link ?? null,
                            journey_id: r.journey_id ?? null,
                            action: 'moved_to_checking',
                            reason: null,
                            original_created_at: r.created_at ?? null,
                        }));

                        await supabase.from("india_box_history").insert(historyRows);
                    }

                    const ids = boxItems.map(p => p.id);
                    const { error: deleteError } = await supabase
                        .from("india_inbound_boxes")
                        .delete()
                        .in("id", ids);
                    if (deleteError) throw deleteError;

                    await refreshSilently();
                    onCountsChange();
                    showToast(
                        `Box "${boxNumber}" (${boxItems.length} items) moved to Checking!`,
                        "success",
                    );
                } catch (error: any) {
                    console.error("Error moving to checking:", error);
                    showToast(`Failed: ${error.message}`, "error");
                } finally {
                    setMoving(false);
                }
            },
        });
    };

    // FILTERING
    const filteredProducts = products.filter(p => {
        return !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.box_number?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // GROUPED VIEW
    const groupedBoxes = useMemo((): GroupedBox[] => {
        const groups: Record<string, BoxProduct[]> = {};

        filteredProducts.forEach(p => {
            if (p.box_number) {
                if (!groups[p.box_number]) groups[p.box_number] = [];
                groups[p.box_number].push(p);
            }
        });

        const result: GroupedBox[] = [];

        Object.entries(groups).forEach(([boxNum, items]) => {
            result.push({
                box_number: boxNum,
                items,
                total_items: items.length,
                total_quantity: items.reduce((sum, i) => sum + (i.quantity_assigned ?? i.buying_quantity ?? 0), 0),
                status: 'assigned',
            });
        });

        return result;
    }, [filteredProducts]);

    const toggleExpand = (boxNumber: string) => {
        setExpandedBoxes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(boxNumber)) newSet.delete(boxNumber);
            else newSet.add(boxNumber);
            return newSet;
        });
    };

    const statusColors: Record<string, string> = {
        assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    const statusIcons: Record<string, string> = {
        assigned: '📦',
    };

    // Remove single item from box (used by BoxSummaryModal)
    const handleRemoveFromBox = (id: string) => {
        setAddItems((prev: any[]) => prev.filter((i: any) => i.id !== id));
        setAddQuantities((prev) => { const c = { ...prev }; delete c[id]; return c; });
        setAddWeights((prev) => { const c = { ...prev }; delete c[id]; return c; });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-400">Loading boxes...</div>
            </div>
        );
    }

    const getItemQty = (item: BoxProduct) => {
        const override = addQuantities[item.id];
        if (override !== undefined) return override;

        // base source: pending quantity first, then fallbacks
        const base =
            (item as any).pending_quantity ??
            item.quantity_assigned ??
            item.buying_quantity ??
            item.ordered_quantity ??
            0;

        return base;
    };

    const getItemWeight = (item: BoxProduct) => {
        const override = addWeights[item.id];
        if (override !== undefined) return override;
        return item.product_weight ?? 0;
    };

    const handleSaveNewBox = async () => {
        if (!newBoxId.trim() || addItems.length === 0) return;
        const boxNum = newBoxId.trim().toUpperCase();

        try {
            setSavingBox(true);

            const inserts: any[] = [];

            for (const item of addItems) {
                if (!item.asin) continue;

                // use inbound pending as the source
                const originalQty =
                    (item as any).pending_quantity ??
                    item.buying_quantity ??
                    item.ordered_quantity ??
                    0;

                const boxQty = getItemQty(item);
                const qty = Math.min(Math.max(boxQty, 0), originalQty);
                if (qty <= 0) continue;

                // 1) insert the boxed portion into india_inbound_boxes
                inserts.push({
                    asin: item.asin,
                    sku: item.sku ?? null,
                    product_name: item.product_name ?? null,
                    brand: item.brand ?? null,
                    journey_id: item.journey_id ?? null,
                    order_date: item.order_date ?? null,
                    origin: item.origin ?? null,
                    origin_india: item.origin_india ?? false,
                    origin_china: item.origin_china ?? false,
                    origin_us: item.origin_us ?? false,
                    product_link: item.product_link ?? null,
                    inr_purchase_link: item.inr_purchase_link ?? null,
                    usd_price: item.usd_price ?? null,
                    inr_purchase: item.inr_purchase ?? null,
                    target_price: item.target_price ?? null,
                    admin_target_price: item.admin_target_price ?? null,
                    target_quantity: item.target_quantity ?? null,
                    funnel: item.funnel ?? null,
                    funnel_quantity: item.funnel_quantity ?? null,
                    funnel_seller: item.funnel_seller ?? null,
                    seller_tag: item.seller_tag ?? null,
                    buying_price: item.buying_price ?? null,
                    buying_quantity: qty,
                    quantity_assigned: qty,
                    ordered_quantity: item.buying_quantity ?? item.ordered_quantity ?? qty,
                    seller_link: item.seller_link ?? null,
                    seller_phone: item.seller_phone ?? null,
                    payment_method: item.payment_method ?? null,
                    tracking_details: item.tracking_details ?? null,
                    delivery_date: item.delivery_date ?? null,
                    product_weight: getItemWeight(item),
                    box_number: boxNum,
                    box_status: "assigned",
                    booking_date: boxBookingDate || null,
                    moved_from_inbound_at: new Date().toISOString(),
                    total_box_weight: boxTotalWeight,
                    inbound_tracking_id: item.id,
                });

                // 2) reduce pending in india_inbound_tracking
                const remaining = originalQty - qty;
                const currentAssigned = (item as any).assigned_quantity ?? 0;

                if (remaining <= 0) {
                    // Pending is 0 — delete this seller's row from inbound tracking
                    const { error: deleteError } = await supabase
                        .from("india_inbound_tracking")
                        .delete()
                        .eq("id", item.id);
                    if (deleteError) console.error("Failed to delete inbound tracking row:", deleteError);
                } else {
                    const { error: trackingError } = await supabase
                        .from("india_inbound_tracking")
                        .update({
                            assigned_quantity: currentAssigned + qty,
                            pending_quantity: remaining,
                        })
                        .eq("id", item.id);
                    if (trackingError) console.error("Failed to update inbound tracking:", trackingError);
                }
            }

            if (inserts.length === 0) {
                setSavingBox(false);
                return;
            }

            const { error: insertError } = await supabase
                .from("india_inbound_boxes")
                .insert(inserts);

            if (insertError) throw insertError;

            // Archive to history as 'created'
            const historyRows = inserts.map((r: any) => ({
                box_number: r.box_number,
                inbound_tracking_id: r.inbound_tracking_id ?? null,
                asin: r.asin ?? null,
                product_name: r.product_name ?? null,
                sku: r.sku ?? null,
                seller_tag: r.seller_tag ?? null,
                funnel: r.funnel ?? null,
                origin: r.origin ?? null,
                origin_india: r.origin_india ?? false,
                origin_china: r.origin_china ?? false,
                origin_us: r.origin_us ?? false,
                buying_price: r.buying_price ?? null,
                buying_quantity: r.buying_quantity ?? null,
                quantity_assigned: r.quantity_assigned ?? null,
                product_weight: r.product_weight ?? null,
                total_box_weight: r.total_box_weight ?? null,
                box_status: r.box_status ?? null,
                box_booking_date: r.booking_date ?? null,
                tracking_details: r.tracking_details ?? null,
                delivery_date: r.delivery_date ?? null,
                order_date: r.order_date ?? null,
                product_link: r.product_link ?? null,
                seller_link: r.seller_link ?? null,
                journey_id: r.journey_id ?? null,
                action: 'created',
                reason: null,
                original_created_at: new Date().toISOString(),
            }));
            await supabase.from("india_box_history").insert(historyRows);

            await refreshSilently();          // refresh boxes          // refresh boxes
            await fetchInboundDelivered();
            // if you added fetchInboundDelivered, call it here too to refresh inbound
            // await fetchInboundDelivered();
            onCountsChange();

            setIsAddingBox(false);
            setNewBoxId("");
            setBoxBookingDate("");
            setAddSearch("");
            setAddItems([]);
            setAddQuantities({});
            setAddWeights({});
            setBoxTotalWeight(null);

            showToast(
                `Box "${boxNum}" created with ${inserts.length} item(s).`,
                "success",
            );
            setShowSummary(false);
        } catch (err: any) {
            console.error("Error creating box in add panel:", err);
            showToast(err.message || "Failed to create box.", "error");
        } finally {
            setSavingBox(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toast */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                open={!!confirmModal}
                title={confirmModal?.title || ""}
                message={confirmModal?.message || ""}
                confirmLabel={confirmModal?.confirmLabel}
                confirmColor={confirmModal?.confirmColor}
                showReason={confirmModal?.showReason}
                onConfirm={(reason) => confirmModal?.onConfirm(reason)}
                onCancel={() => setConfirmModal(null)}
            />

            {editBoxData && (
                <div className="fixed inset-0 z-[100] bg-[#111111] p-4">
                    <VyaparBoxForm
                        mode="edit"
                        editBoxGroup={editBoxData}
                        onSave={() => { setEditBoxData(null); refreshSilently(); onCountsChange(); fetchInboundDelivered(); }}
                        onCancel={() => { setEditBoxData(null); fetchInboundDelivered(); }}
                        onCountsChange={onCountsChange}
                        showToast={showToast}
                    />
                </div>
            )}

            <BoxSummaryModal
                open={showSummary}
                boxId={newBoxId.trim().toUpperCase()}
                totalWeight={boxTotalWeight}
                items={addItems}
                quantities={addQuantities}
                weights={addWeights}
                onQuantityChange={(id, val) =>
                    setAddQuantities(prev => ({ ...prev, [id]: val }))
                }
                onWeightChange={(id, val) =>
                    setAddWeights(prev => ({ ...prev, [id]: val }))
                }
                onTotalWeightChange={setBoxTotalWeight}
                onRemoveItem={handleRemoveFromBox}
                onConfirm={handleSaveNewBox}
                onCancel={() => setShowSummary(false)}
                submitting={savingBox}
            />

            {/* Toolbar */}
            <div className="flex-none pt-6 pb-6 flex gap-4 items-center flex-wrap">
                <input
                    type="text"
                    placeholder="Search by ASIN, Name, SKU, or Box Number..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 max-w-md px-4 sm:px-6 py-2 sm:py-2.5 text-sm bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500"
                />

                <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
                    <button
                        onClick={() => setViewMode("grouped")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "grouped"
                            ? "bg-orange-500 text-white"
                            : "text-gray-500 hover:text-gray-200"
                            }`}
                    >
                        📦 Grouped
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "list"
                            ? "bg-orange-500 text-white"
                            : "text-gray-500 hover:text-gray-200"
                            }`}
                    >
                        📋 List
                    </button>
                </div>

                <div className="hidden sm:block h-8 w-px bg-[#1a1a1a]" />

                <button
                    onClick={() => {
                        setIsAddingBox(true);
                        fetchInboundDelivered(); // ← refresh delivered items
                    }}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg"
                >
                    <span className="sm:hidden">+ Add</span>
                    <span className="hidden sm:inline">+ Add Box Details</span>
                </button>

                <button
                    onClick={() => setRollbackOpen(true)}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2"
                >
                    <span className="sm:hidden">⏪ Rollback</span>
                    <span className="hidden sm:inline">⏪ Rollback from Checking</span>
                </button>
                <button
                    onClick={() => { setHistoryOpen(true); fetchHistory(); }}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#1a1a1a]/30 text-gray-500 border border-white/[0.1]/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#1a1a1a] hover:text-white transition-all flex items-center gap-2"
                >
                    <span className="sm:hidden">📜 History</span>
                    <span className="hidden sm:inline">📜 Box History</span>
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                {isAddingBox ? (
                    <VyaparBoxForm
                        mode="create"
                        onSave={() => { setIsAddingBox(false); refreshSilently(); fetchInboundDelivered(); }}
                        onCancel={() => { setIsAddingBox(false); setNewBoxId(""); setBoxBookingDate(""); setAddSearch(""); setAddItems([]); setAddQuantities({}); setAddWeights({}); }}
                        onCountsChange={onCountsChange}
                        showToast={showToast}
                    />
                ) : (
                    <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.1] h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            {/* GROUPED VIEW */}
                            {viewMode === "grouped" && (
                                <div className="p-4 space-y-3">
                                    {groupedBoxes.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            No items in boxes yet. Move delivered items from Inbound
                                            tab.
                                        </div>
                                    ) : (
                                        groupedBoxes.map((group, boxIdx) => {
                                            const isExpanded = expandedBoxes.has(group.box_number);
                                            return (
                                                <div
                                                    key={group.box_number}
                                                    className="border rounded-xl overflow-hidden transition-all border-blue-500/30 bg-blue-500/5"
                                                >
                                                    <div
                                                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.05] transition-colors"
                                                        onClick={() => toggleExpand(group.box_number)}
                                                    >
                                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                            <svg
                                                                className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""
                                                                    }`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M9 5l7 7-7 7"
                                                                />
                                                            </svg>

                                                            <span className="text-sm font-bold text-gray-500 w-6">{boxIdx + 1}.</span>
                                                            <span className="text-base sm:text-xl">
                                                                {statusIcons[group.status]}
                                                            </span>
                                                            <span className="font-bold text-sm sm:text-lg text-white">
                                                                {group.box_number}
                                                            </span>

                                                            <span
                                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColors[group.status]}`}
                                                            >
                                                                {group.status.toUpperCase()}
                                                            </span>

                                                            <span className="hidden sm:inline text-sm text-gray-300">
                                                                {new Set(group.items.map(i => i.asin)).size} ASINs · {group.total_quantity} qty · {group.items[0]?.total_box_weight ? `${group.items[0].total_box_weight} kg` : ''}
                                                            </span>
                                                            <span className="sm:hidden text-xs text-gray-400">
                                                                {new Set(group.items.map(i => i.asin)).size}A · {group.total_quantity}qty
                                                            </span>

                                                            {group.items[0]?.booking_date && (
                                                                <span className="hidden sm:inline text-xs text-gray-300">
                                                                    📅 {new Date(group.items[0].booking_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                                </span>
                                                            )}

                                                            {(group.items[0]?.box_created_at || group.items[0]?.moved_from_inbound_at) && (
                                                                <span className="hidden sm:inline text-xs text-gray-300">
                                                                    🕒 {new Date(group.items[0].box_created_at || group.items[0].moved_from_inbound_at!).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                                                                    {new Date(group.items[0].box_created_at || group.items[0].moved_from_inbound_at!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div
                                                            className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0"
                                                            onClick={e => e.stopPropagation()}
                                                        ><button
                                                            onClick={() => {
                                                                const headers = ['Sr No', 'ASIN', 'SKU', 'Product Name', 'Quantity', 'Weight (kg)', 'Buying Price', 'Box Number', 'Booking Date', 'Status'];
                                                                const csvRows = [headers.join(',')];
                                                                group.items.forEach((item: any, idx: number) => {
                                                                    const row = [
                                                                        idx + 1,
                                                                        item.asin || '',
                                                                        item.sku || '',
                                                                        `"${(item.product_name || '').replace(/"/g, '""')}"`,
                                                                        item.quantity_assigned ?? item.buying_quantity ?? 0,
                                                                        item.product_weight ?? 0,
                                                                        item.buying_price ?? 0,
                                                                        item.box_number || '',
                                                                        item.booking_date ? `"${item.booking_date}"` : '',
                                                                        item.box_status || '',
                                                                    ];
                                                                    csvRows.push(row.join(','));
                                                                });
                                                                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `Box-${group.box_number}.csv`;
                                                                a.click();
                                                                URL.revokeObjectURL(url);
                                                            }}
                                                            className="px-4 sm:px-6 py-1.5 sm:py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow"
                                                        >
                                                                <span className="hidden sm:inline">📥 Download</span><span className="sm:hidden">📥</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditBoxData(group)}
                                                                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded-lg text-xs font-bold hover:bg-white/[0.05]/100 hover:text-white transition-all shadow"
                                                            >
                                                                <span className="hidden sm:inline">✏️ Edit</span><span className="sm:hidden">✏️</span>
                                                            </button>
                                                            <button
                                                                disabled={moving}
                                                                onClick={() => handleMoveToChecking(group.box_number)}
                                                                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all disabled:opacity-50 shadow"
                                                            >
                                                                {moving ? '⏳' : '✅'}<span className="hidden sm:inline"> {moving ? 'Moving...' : 'Move to Checking'}</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBox(group.box_number)}
                                                                className="px-4 sm:px-6 py-1.5 sm:py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow"
                                                            >
                                                                <span className="hidden sm:inline">🗑 Delete</span><span className="sm:hidden">🗑</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="border-t border-white/[0.1]">
                                                            <table className="w-full">
                                                                <thead className="bg-[#1a1a1a]">
                                                                    <tr>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase w-14">
                                                                            Sr.
                                                                        </th>
                                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                                                                            ASIN
                                                                        </th>
                                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">
                                                                            Product Name
                                                                        </th>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                                            Funnel
                                                                        </th>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                                            Seller Tag
                                                                        </th>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                                            Origin
                                                                        </th>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                                            Qty
                                                                        </th>
                                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                                            Price
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-white/[0.06]">
                                                                    {group.items.map((item, idx) => (
                                                                            <tr
                                                                                key={item.id}
                                                                                className="hover:bg-white/[0.05] transition-colors"
                                                                            >
                                                                                <td className="px-6 py-4 text-sm text-gray-300 text-center font-bold">
                                                                                    {idx + 1}
                                                                                </td>
                                                                                <td className="px-6 py-4 font-mono text-sm text-gray-300">
                                                                                    <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 underline font-semibold flex items-center gap-1 w-fit truncate max-w-[120px]">
                                                                                        {item.asin} <span className="text-[10px]">↗</span>
                                                                                    </a>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-100">
                                                                                    <div className="flex items-center gap-1">
                                                                                        <div className="truncate max-w-[200px]">
                                                                                            {item.product_name || "-"}
                                                                                        </div>
                                                                                        {item.sns_active && <span className="px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    {(() => {
                                                                                        const { display, color } =
                                                                                            getFunnelBadgeStyle(item.funnel);
                                                                                        return display === "-" ? (
                                                                                            <span className="text-gray-500">
                                                                                                -
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span
                                                                                                className={`px-2 py-1 rounded-lg text-xs font-bold ${color}`}
                                                                                            >
                                                                                                {display}
                                                                                            </span>
                                                                                        );
                                                                                    })()}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_STYLES[item.seller_tag || '??'] || 'bg-[#1a1a1a] text-white'}`}>
                                                                                        {item.seller_tag || '??'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-center">
                                                                                    <div className="flex flex-col gap-0.5 items-center">
                                                                                        {item.origin_india && (
                                                                                            <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold">
                                                                                                IN
                                                                                            </span>
                                                                                        )}
                                                                                        {item.origin_china && (
                                                                                            <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold">
                                                                                                CN
                                                                                            </span>
                                                                                        )}
                                                                                        {item.origin_us && (
                                                                                            <span className="px-1.5 py-0.5 bg-sky-500 text-white rounded text-[10px] font-bold">
                                                                                                US
                                                                                            </span>
                                                                                        )}
                                                                                        {!item.origin_india &&
                                                                                            !item.origin_china &&
                                                                                            !item.origin_us && (
                                                                                                <span className="text-gray-500">
                                                                                                    -
                                                                                                </span>
                                                                                            )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-300 text-center font-bold">
                                                                                    {item.quantity_assigned ?? item.buying_quantity ?? 0}
                                                                                </td>
                                                                                <td className="px-6 py-4 text-sm text-gray-300 text-center">
                                                                                    {item.buying_price
                                                                                        ? `₹${item.buying_price}`
                                                                                        : "-"}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {/* LIST VIEW */}
                            {viewMode === "list" && (
                                <table
                                    className="w-full divide-y divide-white/[0.06]"
                                    style={{ minWidth: "1200px" }}
                                >
                                    <thead className="bg-[#111111] sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                                                Box ID
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                                                Total weight (kg)
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                                                Items
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                                                ASINs
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                        {groupedBoxes.map(group => {
                                            return (
                                                <tr
                                                    key={group.box_number}
                                                    className="hover:bg-white/[0.05]"
                                                >
                                                    <td className="px-6 py-4 text-sm text-gray-100 text-center">
                                                        {group.box_number}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-100 text-center">
                                                        -
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-100 text-center">
                                                        {group.total_items} items
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-100 text-center">
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {group.items.filter(i => i.asin).map((i, idx, arr) => (
                                                                <span key={i.id}>
                                                                    <a href={i.product_link || `https://www.amazon.in/dp/${i.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 underline">
                                                                        {i.asin}
                                                                    </a>
                                                                    {idx < arr.length - 1 ? ", " : ""}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-100 text-center">
                                                        {group.status === "assigned"
                                                            ? "Open"
                                                            : group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-center">
                                                        <div className="flex items-center gap-2 justify-center flex-wrap" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => {
                                                                    const headers = ['Sr No', 'ASIN', 'SKU', 'Product Name', 'Quantity', 'Weight (kg)', 'Buying Price', 'Box Number', 'Booking Date', 'Status'];
                                                                    const csvRows = [headers.join(',')];
                                                                    group.items.forEach((item: any, idx: number) => {
                                                                        const row = [
                                                                            idx + 1,
                                                                            item.asin || '',
                                                                            item.sku || '',
                                                                            `"${(item.product_name || '').replace(/"/g, '""')}"`,
                                                                            item.quantity_assigned ?? item.buying_quantity ?? 0,
                                                                            item.product_weight ?? 0,
                                                                            item.buying_price ?? 0,
                                                                            item.box_number || '',
                                                                            item.booking_date ? `"${item.booking_date}"` : '',
                                                                            item.box_status || '',
                                                                        ];
                                                                        csvRows.push(row.join(','));
                                                                    });
                                                                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                                                                    const url = URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `Box-${group.box_number}.csv`;
                                                                    a.click();
                                                                    URL.revokeObjectURL(url);
                                                                }}
                                                                className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
                                                            >
                                                                📥
                                                            </button>
                                                            <button
                                                                onClick={() => setEditBoxData(group)}
                                                                className="px-3 py-1.5 bg-orange-500/10 text-orange-500 border border-orange-500/30 rounded-lg text-xs font-bold hover:bg-white/[0.05]/100 hover:text-white transition-all"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                disabled={moving}
                                                                onClick={() => handleMoveToChecking(group.box_number)}
                                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all disabled:opacity-50"
                                                            >
                                                                {moving ? '⏳' : '✅'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBox(group.box_number)}
                                                                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-500 transition-all"
                                                            >
                                                                🗑
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* Box History Modal */}
            {historyOpen && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1a1a1a] p-3">
                    <div className="w-full max-w-6xl max-h-[90vh] bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl flex flex-col">
                        <div className="px-5 py-4 border-b border-white/[0.1] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">📜 Box History</h2>
                                <p className="text-xs text-gray-400 mt-1">All deleted and moved boxes are archived here</p>
                            </div>
                            <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="flex-1 overflow-auto px-5 py-4">
                            {historyLoading ? (
                                <div className="h-40 flex items-center justify-center text-gray-400">Loading history...</div>
                            ) : historyData.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-gray-500">No box history yet.</div>
                            ) : (() => {
                                const grouped: Record<string, { box_number: string; action: string; reason: string | null; archived_at: string; items: any[] }> = {};
                                historyData.forEach(row => {
                                    const key = `${row.box_number}__${row.archived_at}`;
                                    if (!grouped[key]) {
                                        grouped[key] = {
                                            box_number: row.box_number,
                                            action: row.action,
                                            reason: row.reason,
                                            archived_at: row.archived_at,
                                            items: [],
                                        };
                                    }
                                    grouped[key].items.push(row);
                                });

                                return (
                                    <div className="space-y-4">
                                        {Object.values(grouped).map((group, idx) => {
                                            const totalQty = group.items.reduce((s, i) => s + (i.quantity_assigned ?? 0), 0);
                                            const uniqueAsins = new Set(group.items.map(i => i.asin)).size;
                                            const actionColor = group.action === 'deleted'
                                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                                : group.action === 'created'
                                                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                                            const actionLabel = group.action === 'deleted' ? '🗑 Deleted'
                                                : group.action === 'created' ? '📦 Created'
                                                    : '✅ Moved to Checking';

                                            return (
                                                <div key={idx} className="border border-white/[0.1] rounded-xl overflow-hidden bg-[#111111]/30">
                                                    <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 bg-[#1a1a1a]">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="font-bold text-white text-base">📦 {group.box_number}</span>
                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${actionColor}`}>{actionLabel}</span>
                                                            <span className="text-xs text-gray-400">{uniqueAsins} ASINs · {totalQty} qty</span>
                                                            {group.reason && (
                                                                <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">Reason: {group.reason}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-300">
                                                            {new Date(group.archived_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                                                            {new Date(group.archived_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-[#1a1a1a]">
                                                            <tr>
                                                                <th className="px-6 py-4 text-left text-gray-400">ASIN</th>
                                                                <th className="px-6 py-4 text-left text-gray-400">Product</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Seller</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Funnel</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Qty</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Price</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Weight</th>
                                                                <th className="px-6 py-4 text-center text-gray-400">Origin</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/[0.06]/40">
                                                            {group.items.map((item, i) => (
                                                                <tr key={i} className="hover:bg-white/[0.05]">
                                                                    <td className="px-6 py-4 font-mono text-gray-100">{item.asin}</td>
                                                                    <td className="px-6 py-4 text-gray-300"><div className="flex items-center gap-1"><div className="truncate max-w-[200px]">{item.product_name || '-'}</div>{item.sns_active && <span className="px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}</div></td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        {item.seller_tag ? (
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_STYLES[item.seller_tag] || 'bg-[#1a1a1a] text-white'}`}>{item.seller_tag}</span>
                                                                        ) : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        {item.funnel ? (() => {
                                                                            const { display, color } = getFunnelBadgeStyle(item.funnel);
                                                                            return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>{display}</span>;
                                                                        })() : '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 text-center text-gray-100 font-bold">{item.quantity_assigned ?? 0}</td>
                                                                    <td className="px-6 py-4 text-center text-gray-300">{item.buying_price ? `₹${item.buying_price}` : '-'}</td>
                                                                    <td className="px-6 py-4 text-center text-gray-300">{item.product_weight ? `${item.product_weight} kg` : '-'}</td>
                                                                    <td className="px-6 py-4 text-center">
                                                                        <div className="flex gap-0.5 justify-center">
                                                                            {item.origin_india && <span className="px-1 py-0.5 bg-orange-500 text-white rounded text-[9px] font-bold">IN</span>}
                                                                            {item.origin_china && <span className="px-1 py-0.5 bg-red-500 text-white rounded text-[9px] font-bold">CN</span>}
                                                                            {item.origin_us && <span className="px-1 py-0.5 bg-sky-500 text-white rounded text-[9px] font-bold">US</span>}
                                                                            {!item.origin_india && !item.origin_china && !item.origin_us && <span className="text-gray-500">-</span>}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="px-5 py-3 border-t border-white/[0.1] flex justify-end">
                            <button onClick={() => setHistoryOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-[#111111]">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Rollback modal */}
            <GenericRollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                onSuccess={async () => {
                    await refreshSilently();
                    onCountsChange();
                    setRollbackOpen(false);
                }}
                direction="CHECKING_TO_BOXES"
                sellerId={0}
                sellerTag={null}
                sourceTableName="india_box_checking"
                targetTableName="india_inbound_boxes"
            />
        </div>
    );
}
