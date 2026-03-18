"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getFunnelBadgeStyle } from "@/lib/utils";
import GenericRollbackModal from "@/components/india-selling/GenericRollbackModal";

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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-2">
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>

                {/* Body */}
                <div className="px-6 pb-5">
                    <p className="text-sm text-slate-300 leading-relaxed">{message}</p>

                    {showReason && (
                        <div className="mt-3">
                            <label className="block text-xs text-slate-400 mb-1">
                                Reason for deletion
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim()) { onConfirm(reason); } }}
                                placeholder="e.g. Wrong items, duplicate box..."
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-950/50 border-t border-slate-800">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(reason || undefined)}
                        disabled={showReason && !reason.trim()}
                        className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${confirmColor || "bg-indigo-600 hover:bg-indigo-500"
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
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
            <div className="w-full max-w-5xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white">
                            📦 Box Summary — {boxId}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {items.length} items · {totalQty} total qty — Review
                            before saving
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-slate-400 hover:text-slate-100 text-xl"
                    >
                        &times;
                    </button>
                </div>

                {/* Items table */}
                <div className="flex-1 overflow-auto px-5 py-4">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900/60">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">
                                    ASIN
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">
                                    Product
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400">
                                    Price
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400">
                                    Qty
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400">
                                    Weight
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {items.map((item: any) => {
                                const rawPending =
                                    (item as any).pending_quantity ??
                                    item.buying_quantity ??
                                    0;
                                const maxQty = Math.max(rawPending, quantities[item.id] ?? 0);
                                return (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-800/40"
                                    >
                                        <td className="px-3 py-2 font-mono text-slate-300">
                                            {item.asin}
                                        </td>
                                        <td className="px-3 py-2 text-slate-200 truncate max-w-[200px]">
                                            {item.product_name || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-300">
                                            {item.buying_price
                                                ? `₹${item.buying_price}`
                                                : "-"}
                                        </td>
                                        <td className="px-3 py-2 text-center">
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
                                                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
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
                                                className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
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
                <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
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
}

const SELLER_TAG_COLORS: Record<string, string> = {
    GR: 'bg-yellow-400 text-black',
    RR: 'bg-gray-400 text-black',
    UB: 'bg-pink-500 text-white',
    VV: 'bg-purple-600 text-white',
    DE: 'bg-orange-500 text-white',
    CV: 'bg-green-600 text-white',
};

// ============================================
// ✅ NEW: EDIT BOX MODAL
// ============================================
function EditBoxModal({ open, boxGroup, onClose, onSuccess, showToast, inboundDelivered }: any) {
    const [boxNum, setBoxNum] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [totalWeight, setTotalWeight] = useState<number | "">("");
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);
    const [editSearch, setEditSearch] = useState("");
    const [editShowDropdown, setEditShowDropdown] = useState(false);
    const editSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (boxGroup) {
            setBoxNum(boxGroup.box_number);
            setBookingDate(boxGroup.items[0]?.booking_date || "");
            setTotalWeight(boxGroup.items[0]?.total_box_weight ?? "");

            const q: Record<string, number> = {};
            const w: Record<string, number> = {};
            boxGroup.items.forEach((i: any) => {
                q[i.id] = i.quantity_assigned ?? i.buying_quantity ?? 0;
                w[i.id] = i.product_weight ?? 0;
            });
            setQuantities(q);
            setWeights(w);

            // Fetch pending quantities from inbound tracking for max-allowed calculation
            const trackingIds = boxGroup.items
                .map((i: any) => i.inbound_tracking_id)
                .filter(Boolean);
            if (trackingIds.length > 0) {
                supabase
                    .from('india_inbound_tracking')
                    .select('id, pending_quantity')
                    .in('id', trackingIds)
                    .then(({ data }) => {
                        if (data) {
                            const pendingMap: Record<string, number> = {};
                            data.forEach((row: any) => { pendingMap[row.id] = row.pending_quantity ?? 0; });
                            boxGroup.items.forEach((i: any) => {
                                i._trackingPending = pendingMap[i.inbound_tracking_id] ?? 0;
                            });
                        }
                    });
            }
        }
    }, [boxGroup]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (editSearchRef.current && !editSearchRef.current.contains(e.target as Node))
                setEditShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const editDropdownCandidates = useMemo(() => {
        if (!inboundDelivered || !boxGroup) return [];
        const alreadyInBoxAsins = new Set(boxGroup.items?.filter((i: any) => (quantities[i.id] ?? 0) > 0).map((i: any) => i.asin) || []);
        let filtered = inboundDelivered.filter((p: any) =>
            !alreadyInBoxAsins.has(p.asin) && (p.pending_quantity ?? p.buying_quantity ?? 0) > 0
        );
        if (editSearch.trim()) {
            const q = editSearch.toLowerCase();
            filtered = filtered.filter((p: any) =>
                p.asin?.toLowerCase().includes(q) ||
                p.product_name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q)
            );
        }

        // Group by ASIN
        const grouped: Record<string, { representative: any; sellers: { id: string; tag: string; pending: number; inboundItem: any }[] }> = {};
        filtered.forEach((p: any) => {
            const key = p.asin;
            if (!grouped[key]) {
                grouped[key] = { representative: p, sellers: [] };
            }
            grouped[key].sellers.push({
                id: p.id,
                tag: p.seller_tag || '??',
                pending: p.pending_quantity ?? p.buying_quantity ?? 0,
                inboundItem: p,
            });
        });
        const result = Object.values(grouped).map(g => ({
            ...g,
            sellers: g.sellers.filter(s => s.pending > 0),
        })).filter(g => g.sellers.length > 0);
        return result.slice(0, editShowDropdown && !editSearch.trim() ? 5 : 50);
    }, [inboundDelivered, boxGroup, editSearch, editShowDropdown, quantities]);

    if (!open || !boxGroup) return null;

    const activeItems = boxGroup.items.filter((i: any) => quantities[i.id] !== -1);

    // Group active items by ASIN for display
    const groupedEditItems = (() => {
        const grouped: Record<string, { representative: any; sellerRows: any[] }> = {};
        activeItems.forEach((item: any) => {
            const key = item.asin;
            if (!grouped[key]) {
                grouped[key] = { representative: item, sellerRows: [] };
            }
            grouped[key].sellerRows.push(item);
        });
        return Object.values(grouped);
    })();

    const handleAddToEditBox = (group: { representative: any; sellers: { id: string; tag: string; pending: number; inboundItem: any }[] }) => {
        const newQtys: Record<string, number> = {};
        const newWts: Record<string, number> = {};
        group.sellers.forEach(s => {
            const newItem = {
                ...s.inboundItem,
                inbound_tracking_id: s.id,
                id: `new-${s.id}`,
                quantity_assigned: s.pending,
                product_weight: s.inboundItem.product_weight ?? 0,
                _isNew: true,
            };
            boxGroup.items.push(newItem);
            newQtys[newItem.id] = s.pending;
            newWts[newItem.id] = s.inboundItem.product_weight ?? 0;
        });
        setQuantities(prev => ({ ...prev, ...newQtys }));
        setWeights(prev => ({ ...prev, ...newWts }));
        setEditSearch("");
        setEditShowDropdown(false);
    };

    const handleRemoveSellerFromEditBox = (itemId: string) => {
        setQuantities(prev => ({ ...prev, [itemId]: -1 }));
    };

    const handleRemoveAsinFromEditBox = (asin: string) => {
        const idsToRemove: Record<string, number> = {};
        boxGroup.items.filter((i: any) => i.asin === asin).forEach((i: any) => { idsToRemove[i.id] = -1; });
        setQuantities(prev => ({ ...prev, ...idsToRemove }));
    };

    const handleSave = async () => {
        if (!boxNum.trim()) return showToast("Box ID cannot be empty", "error");
        setSaving(true);
        try {
            for (const item of boxGroup.items) {
                const oldQty = item.quantity_assigned ?? item.buying_quantity ?? 0;
                const newQty = quantities[item.id] ?? 0;
                const newWeight = weights[item.id] ?? 0;
                const trackingId = (item as any).inbound_tracking_id;

                if (newQty <= 0) {
                    if (!item.id.startsWith('new-')) {
                        await supabase.from('india_inbound_boxes').delete().eq('id', item.id);
                    }
                } else if (item.id.startsWith('new-')) {
                    // New item — insert
                    await supabase.from('india_inbound_boxes').insert({
                        asin: item.asin,
                        product_name: item.product_name,
                        sku: item.sku,
                        seller_tag: item.seller_tag,
                        funnel: item.funnel,
                        origin: item.origin,
                        origin_india: item.origin_india ?? false,
                        origin_china: item.origin_china ?? false,
                        origin_us: item.origin_us ?? false,
                        product_link: item.product_link,
                        buying_price: item.buying_price,
                        buying_quantity: newQty,
                        quantity_assigned: newQty,
                        ordered_quantity: newQty,
                        product_weight: newWeight,
                        box_number: boxNum.trim().toUpperCase(),
                        box_status: "assigned",
                        booking_date: bookingDate || null,
                        total_box_weight: totalWeight === "" ? null : Number(totalWeight),
                        inbound_tracking_id: item.inbound_tracking_id,
                        box_created_at: new Date().toISOString(),
                        moved_from_inbound_at: new Date().toISOString(),
                    });
                } else {
                    await supabase.from('india_inbound_boxes').update({
                        box_number: boxNum.trim().toUpperCase(),
                        booking_date: bookingDate || null,
                        total_box_weight: totalWeight === "" ? null : Number(totalWeight),
                        quantity_assigned: newQty,
                        ordered_quantity: newQty,
                        product_weight: newWeight
                    }).eq('id', item.id);
                }

                const delta = newQty - oldQty;
                if (delta !== 0 && trackingId) {
                    const { data: trackData } = await supabase.from('india_inbound_tracking')
                        .select('assigned_quantity, pending_quantity').eq('id', trackingId).single();

                    if (trackData) {
                        const newPending = Math.max(0, (trackData.pending_quantity || 0) - delta);
                        const newAssigned = Math.max(0, (trackData.assigned_quantity || 0) + delta);
                        if (newPending <= 0 && newAssigned <= 0) {
                            // Nothing left — delete from inbound tracking
                            await supabase.from('india_inbound_tracking').delete().eq('id', trackingId);
                        } else {
                            await supabase.from('india_inbound_tracking').update({
                                assigned_quantity: newAssigned,
                                pending_quantity: newPending,
                            }).eq('id', trackingId);
                        }
                    }
                }
            }
            showToast(`Box ${boxNum} successfully updated!`, "success");
            onSuccess();
        } catch (err: any) {
            showToast("Failed to edit box: " + err.message, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
            <div className="w-full max-w-7xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white">✏️ Edit Box Details</h2>
                        <p className="text-sm text-slate-400 mt-1">Modify box metadata or item quantities. Removed items will return to the Inbound queue.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
                </div>

                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/50 flex flex-wrap gap-3 sm:gap-6">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Box ID</label>
                        <input type="text" value={boxNum} onChange={e => setBoxNum(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Booking Date</label>
                        <input type="date" max="9999-12-31" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Total Weight (kg)</label>
                        <input type="number" step="0.01" value={totalWeight} onChange={e => setTotalWeight(e.target.value ? Number(e.target.value) : "")} className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5" ref={editSearchRef}>
                        <label className="text-xs font-semibold text-slate-400 uppercase">Add ASIN</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={editSearch}
                                onChange={(e) => { setEditSearch(e.target.value); setEditShowDropdown(true); }}
                                onFocus={() => setEditShowDropdown(true)}
                                placeholder="Search ASIN or Product to add..."
                                className="w-full sm:w-80 px-3 py-2 bg-slate-950 border border-indigo-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                            />
                            {editShowDropdown && editDropdownCandidates.length > 0 && (
                                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-[300px] overflow-y-auto w-full sm:w-[600px]">
                                    {editDropdownCandidates.map((group: any) => {
                                        const item = group.representative;
                                        const totalPending = group.sellers.reduce((s: number, x: any) => s + x.pending, 0);
                                        return (
                                            <div key={item.asin} className="flex items-start justify-between px-5 py-3 hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-0 cursor-pointer" onClick={() => handleAddToEditBox(group)}>
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                        <span className="font-mono text-base font-bold text-white">{item.asin}</span>
                                                        {item.sku && <span className="text-xs text-slate-200 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-600 font-medium">SKU: {item.sku}</span>}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-200 mb-1.5">{item.product_name || '-'}</div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {group.sellers.map((s: any) => (
                                                            <div key={s.id} className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_TAG_COLORS[s.tag] || 'bg-slate-700 text-white'}`}>{s.tag}</span>
                                                                <span className="text-xs text-amber-300 font-semibold">{s.pending} pending</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <span className="bg-amber-500/25 text-amber-300 px-2.5 py-1 rounded text-sm font-bold">{totalPending} total</span>
                                                    <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 shrink-0">+ Add</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-5">
                    {groupedEditItems.length === 0 ? (
                        <div className="text-center py-10 text-rose-400 font-medium">All items removed. Saving will delete the box entirely.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400">
                                <tr>
                                    <th className="px-3 py-2 text-left">ASIN</th>
                                    <th className="px-3 py-2 text-left">Product</th>
                                    <th className="px-3 py-2 text-center" style={{ minWidth: '280px' }}>Box Qty (per seller)</th>
                                    <th className="px-3 py-2 text-center">Weight (kg)</th>
                                    <th className="px-3 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {groupedEditItems.map((group: any) => {
                                    const item = group.representative;
                                    const totalQty = group.sellerRows.reduce((sum: number, r: any) => sum + (quantities[r.id] ?? 0), 0);
                                    return (
                                        <tr key={item.asin} className="hover:bg-slate-800/40">
                                            <td className="px-3 py-3 font-mono text-slate-200 align-top">
                                                <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1">
                                                    {item.asin} <span className="text-[10px]">↗</span>
                                                </a>
                                            </td>
                                            <td className="px-3 py-3 text-slate-300 align-top">{item.product_name || '-'}</td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex flex-col gap-2">
                                                    {group.sellerRows.map((sellerItem: any) => {
                                                        const trackingPending = sellerItem._trackingPending ?? 0;
                                                        const currentBoxQty = sellerItem.quantity_assigned ?? 0;
                                                        const maxAllowed = currentBoxQty + trackingPending;
                                                        const sellerTag = sellerItem.seller_tag || '??';
                                                        return (
                                                            <div key={sellerItem.id} className="flex items-center justify-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold min-w-[28px] text-center ${SELLER_TAG_COLORS[sellerTag] || 'bg-slate-700 text-white'}`}>{sellerTag}</span>
                                                                <input type="number" min={1} max={maxAllowed} value={quantities[sellerItem.id] ?? 0}
                                                                    onChange={e => { const val = Number(e.target.value); if (val >= 0) setQuantities(prev => ({ ...prev, [sellerItem.id]: Math.min(val, maxAllowed) })); }}
                                                                    className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-white" />
                                                                <button onClick={() => handleRemoveSellerFromEditBox(sellerItem.id)} className="text-rose-400 hover:text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-400/10" title={`Remove ${sellerTag}`}>✕</button>
                                                            </div>
                                                        );
                                                    })}
                                                    {group.sellerRows.length > 1 && (
                                                        <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-800 pt-1 mt-1">Total: {totalQty}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center align-top">
                                                <input type="number" min={0} step={0.01} value={weights[group.sellerRows?.id] ?? 0}
                                                    onChange={e => {
                                                        const val = Number(e.target.value) || 0;
                                                        setWeights(prev => {
                                                            const updated = { ...prev };
                                                            group.sellerRows.forEach((r: any) => { updated[r.id] = val; });
                                                            return updated;
                                                        });
                                                    }}
                                                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-white" />
                                            </td>
                                            <td className="px-3 py-2 text-center align-top">
                                                <button onClick={() => handleRemoveAsinFromEditBox(item.asin)} className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-1 rounded bg-rose-400/10">✕ Remove All</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-slate-800 flex justify-end gap-2 sm:gap-3 bg-slate-900/30">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2">
                        {saving ? "Saving..." : "💾 Save Changes"}
                    </button>
                </div>
            </div>
        </div >
    );
}

// ============================================
// COMPONENT
// ============================================
export default function BoxesTab({ onCountsChange }: BoxesTabProps) {
    const [products, setProducts] = useState<BoxProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [moving, setMoving] = useState(false);
    const [expandedBoxes, setExpandedBoxes] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
    const [isAddingBox, setIsAddingBox] = useState(false);
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
                    for (const row of rows as any[]) {
                        const qty = row.quantity_assigned ?? 0;
                        if (qty <= 0) continue;

                        const inboundId = row.inbound_tracking_id ?? null;

                        let inboundRow: any = null;

                        if (inboundId) {
                            // Direct lookup by stored ID
                            const { data } = await supabase
                                .from("india_inbound_tracking")
                                .select("id, assigned_quantity, pending_quantity")
                                .eq("id", inboundId)
                                .limit(1);
                            inboundRow = data?.[0];
                        }

                        if (!inboundRow && row.asin) {
                            // Fallback: match by ASIN + delivered status
                            const { data } = await supabase
                                .from("india_inbound_tracking")
                                .select("id, assigned_quantity, pending_quantity")
                                .eq("asin", row.asin)
                                .eq("status", "delivered")
                                .limit(1);
                            inboundRow = data?.[0];
                        }

                        if (!inboundRow) continue;

                        const currentAssigned = inboundRow.assigned_quantity ?? 0;
                        const currentPending = inboundRow.pending_quantity ?? 0;

                        const { error } = await supabase
                            .from("india_inbound_tracking")
                            .update({
                                assigned_quantity: Math.max(0, currentAssigned - qty),
                                pending_quantity: currentPending + qty,
                            })
                            .eq("id", inboundRow.id);

                        if (error) {
                            console.error("Failed to rollback inbound tracking", error);
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
                        `Box ${boxNumber} deleted${reason
                            ? ` — ${reason}. Quantities returned to Inbound.`
                            : ". Quantities returned to Inbound."
                        }`,
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

    // Merge box items by ASIN for display
    const mergeBoxItems = (items: BoxProduct[]) => {
        const grouped: Record<string, { representative: BoxProduct; sellers: { tag: string; qty: number; id: string }[] }> = {};
        items.forEach(item => {
            const key = item.asin;
            if (!grouped[key]) {
                grouped[key] = { representative: item, sellers: [] };
            }
            grouped[key].sellers.push({
                tag: item.seller_tag || '??',
                qty: item.quantity_assigned ?? item.buying_quantity ?? 0,
                id: item.id,
            });
        });
        return Object.values(grouped);
    };

    // Dropdown candidates — shows 5 on focus, more when searching
    // Dropdown candidates — grouped by ASIN so one ASIN shows once with all seller tags
    const groupedDropdownCandidates = useMemo(() => {
        // Collect ASINs already added to the box
        const alreadyAddedAsins = new Set(addItems.map((i: any) => i.asin));

        // Filter out already-added ASINs, then apply search
        let filtered = inboundDelivered.filter((p: any) => !alreadyAddedAsins.has(p.asin));
        if (addSearch.trim()) {
            const q = addSearch.toLowerCase();
            filtered = filtered.filter((p: any) =>
                p.asin?.toLowerCase().includes(q) ||
                p.product_name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q)
            );
        }

        // Group by ASIN
        const grouped: Record<string, { representative: any; sellers: { id: string; tag: string; pending: number; price: number | null; inboundItem: any }[] }> = {};
        filtered.forEach((p: any) => {
            const key = p.asin;
            if (!grouped[key]) {
                grouped[key] = { representative: p, sellers: [] };
            }
            grouped[key].sellers.push({
                id: p.id,
                tag: p.seller_tag || '??',
                pending: p.pending_quantity ?? p.buying_quantity ?? 0,
                price: p.buying_price,
                inboundItem: p,
            });
        });

        // Only show ASINs where at least one seller has pending > 0
        const result = Object.values(grouped).map(g => ({
            ...g,
            sellers: g.sellers.filter(s => s.pending > 0),
        })).filter(g => g.sellers.length > 0);
        return result.slice(0, showDropdown && !addSearch.trim() ? 5 : 50);
    }, [inboundDelivered, addItems, addSearch, showDropdown]);

    // Add grouped ASIN to box — adds ALL seller rows for this ASIN at once
    const handleAddGroupedAsin = (group: { representative: any; sellers: { id: string; tag: string; pending: number; price: number | null; inboundItem: any }[] }) => {
        // Skip if this ASIN is already added
        if (addItems.some((i: any) => i.asin === group.representative.asin)) return;

        // Add all inbound rows for this ASIN
        const newItems = group.sellers.map(s => s.inboundItem);
        setAddItems((prev: any[]) => [...prev, ...newItems]);

        // Set qty per seller row (each seller gets its own pending qty)
        const newQtys: Record<string, number> = {};
        const newWeights: Record<string, number> = {};
        group.sellers.forEach(s => {
            newQtys[s.id] = s.pending;
            newWeights[s.id] = s.inboundItem.product_weight ?? 0;
        });
        setAddQuantities((prev) => ({ ...prev, ...newQtys }));
        setAddWeights((prev) => ({ ...prev, ...newWeights }));
        setAddSearch('');
        setShowDropdown(false);
    };

    // Remove single item from box (used by BoxSummaryModal)
    const handleRemoveFromBox = (id: string) => {
        setAddItems((prev: any[]) => prev.filter((i: any) => i.id !== id));
        setAddQuantities((prev) => { const c = { ...prev }; delete c[id]; return c; });
        setAddWeights((prev) => { const c = { ...prev }; delete c[id]; return c; });
    };

    // Remove entire ASIN from box (all seller rows)
    const handleRemoveAsinFromBox = (asin: string) => {
        const idsToRemove = new Set(addItems.filter((i: any) => i.asin === asin).map((i: any) => i.id));
        setAddItems((prev: any[]) => prev.filter((i: any) => !idsToRemove.has(i.id)));
        setAddQuantities((prev) => {
            const c = { ...prev };
            idsToRemove.forEach(id => delete c[id]);
            return c;
        });
        setAddWeights((prev) => {
            const c = { ...prev };
            idsToRemove.forEach(id => delete c[id]);
            return c;
        });
    };

    const groupedAddItems = useMemo(() => {
        const grouped: Record<string, { representative: any; sellerRows: any[] }> = {};
        addItems.forEach((item: any) => {
            const key = item.asin;
            if (!grouped[key]) {
                grouped[key] = { representative: item, sellerRows: [] };
            }
            grouped[key].sellerRows.push(item);
        });
        return Object.values(grouped);
    }, [addItems]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-slate-400">Loading boxes...</div>
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

            <EditBoxModal open={!!editBoxData} boxGroup={editBoxData} onClose={() => { setEditBoxData(null); fetchInboundDelivered(); }} onSuccess={() => { setEditBoxData(null); refreshSilently(); onCountsChange(); fetchInboundDelivered(); }} showToast={showToast} inboundDelivered={inboundDelivered} />

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
            <div className="flex-none pt-4 sm:pt-5 pb-3 sm:pb-4 flex gap-2 sm:gap-4 items-center flex-wrap">
                <input
                    type="text"
                    placeholder="Search by ASIN, Name, SKU, or Box Number..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 max-w-md px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-500"
                />

                <div className="flex items-center bg-slate-800/50 rounded-xl border border-slate-700 p-1">
                    <button
                        onClick={() => setViewMode("grouped")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "grouped"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        📦 Grouped
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "list"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        📋 List
                    </button>
                </div>

                <div className="hidden sm:block h-8 w-px bg-slate-700" />

                <button
                    onClick={() => {
                        setIsAddingBox(true);
                        fetchInboundDelivered(); // ← refresh delivered items
                    }}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg"
                >
                    <span className="sm:hidden">+ Add</span>
                    <span className="hidden sm:inline">+ Add Box Details</span>
                </button>

                <button
                    onClick={() => setRollbackOpen(true)}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2"
                >
                    <span className="sm:hidden">⏪ Rollback</span>
                    <span className="hidden sm:inline">⏪ Rollback from Checking</span>
                </button>
                <button
                    onClick={() => { setHistoryOpen(true); fetchHistory(); }}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-700/30 text-slate-300 border border-slate-600/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-slate-700 hover:text-white transition-all flex items-center gap-2"
                >
                    <span className="sm:hidden">📜 History</span>
                    <span className="hidden sm:inline">📜 Box History</span>
                </button>
            </div>

            <div className="flex-1 overflow-hidden">
                {isAddingBox ? (
                    <div className="bg-slate-900 rounded-lg border border-slate-800 h-full flex flex-col">
                        {/* Panel header */}
                        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-start sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base sm:text-lg font-semibold text-white">
                                    Add Box Details
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">
                                    Enter a box ID, pick delivered items, then save to create/update the box.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsAddingBox(false);
                                    setNewBoxId("");
                                    setBoxBookingDate("");
                                    setAddSearch("");
                                    setAddItems([]);
                                    setAddQuantities({});
                                    setAddWeights({});
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 shrink-0"
                            >
                                ← Back to Boxes
                            </button>
                        </div>

                        {/* Controls row */}
                        <div className="px-3 sm:px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 sm:items-center">
                            {/* Top row: Box ID, Weight, Date */}
                            <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-4 sm:items-center">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs text-slate-400">Box ID</span>
                                    <input type="text" value={newBoxId} onChange={(e) => setNewBoxId(e.target.value)} placeholder="BOX-001"
                                        className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-w-0" />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Wgt (kg)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={boxTotalWeight ?? ""}
                                        onChange={(e) => setBoxTotalWeight(e.target.value ? Number(e.target.value) : null)}
                                        placeholder="e.g. 12"
                                        className="w-full sm:w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide whitespace-nowrap">Booking</span>
                                    <input type="date" max="9999-12-31" value={boxBookingDate} onChange={(e) => setBoxBookingDate(e.target.value)} className="w-full px-2 sm:px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0" />
                                </div>
                            </div>

                            {/* Search ASIN — full width on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 sm:flex-1 sm:min-w-[300px] relative" ref={searchRef}>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide shrink-0">Search ASIN</span>
                                <div className="relative flex-1 min-w-0">
                                    <input type="text" value={addSearch}
                                        onChange={(e) => { setAddSearch(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder="Type to search ASIN or Product..."
                                        className="w-full px-3 sm:px-4 py-2 bg-slate-950 border border-indigo-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 shadow-inner" />

                                    {showDropdown && groupedDropdownCandidates.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-600 rounded-xl shadow-2xl z-50 max-h-[350px] sm:max-h-[400px] overflow-y-auto">
                                            {groupedDropdownCandidates.map((group) => {
                                                const item = group.representative;
                                                const totalPending = group.sellers.reduce((s, x) => s + x.pending, 0);
                                                return (
                                                    <div key={item.asin} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-5 py-3 sm:py-4 hover:bg-slate-800 transition-colors border-b border-slate-700 last:border-0 cursor-pointer" onClick={() => handleAddGroupedAsin(group)}>
                                                        <div className="flex-1 min-w-0 sm:pr-4">
                                                            <div className="flex items-center gap-2 sm:gap-3 mb-1">
                                                                <span className="font-mono text-sm sm:text-base font-bold text-white">{item.asin}</span>
                                                                {item.sku && <span className="text-[10px] sm:text-xs text-slate-200 bg-slate-800 px-1.5 sm:px-2.5 py-0.5 rounded border border-slate-600 font-medium truncate">SKU: {item.sku}</span>}
                                                            </div>
                                                            <div className="text-xs sm:text-sm font-medium text-slate-200 truncate mb-1.5">{item.product_name || '-'}</div>
                                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                                                                {group.sellers.map(s => (
                                                                    <div key={s.id} className="flex items-center gap-1 sm:gap-1.5 bg-slate-800 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                                                                        <span className={`px-1 sm:px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_TAG_COLORS[s.tag] || 'bg-slate-700 text-white'}`}>{s.tag}</span>
                                                                        <span className="text-[10px] sm:text-xs text-amber-300 font-semibold">{s.pending} pending</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center sm:flex-col sm:items-end gap-2 mt-2 sm:mt-0 shrink-0">
                                                            <span className="bg-amber-500/25 text-amber-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-xs sm:text-sm font-bold">{totalPending} pending</span>
                                                            <span className="text-emerald-300 font-bold text-xs sm:text-sm">₹{item.buying_price ?? '-'}</span>
                                                            <button onClick={(e) => { e.stopPropagation(); handleAddGroupedAsin(group); }}
                                                                className="px-3 sm:px-5 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-bold hover:bg-emerald-500 shadow-lg transition-all">
                                                                + Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {showDropdown && groupedDropdownCandidates.length === 0 && addSearch.trim() && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 px-4 py-3 text-sm text-slate-500">
                                            No matching items found.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Save Box button */}
                            <div className="flex sm:ml-auto items-center gap-2 sm:gap-4">
                                <button onClick={() => setShowSummary(true)}
                                    disabled={!newBoxId.trim() || addItems.length === 0}
                                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                                    💾 Save Box {groupedAddItems.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{groupedAddItems.length}</span>}
                                </button>
                            </div>
                        </div>

                        {/* Items table */}
                        <div className="flex-1 overflow-auto px-3 sm:px-5 py-3 sm:py-4">
                            {groupedAddItems.length === 0 ? (
                                <div className="h-full flex items-center justify-center flex-col gap-3">
                                    <span className="text-4xl">📭</span>
                                    <p className="text-slate-500 text-sm">No items added to this box yet.</p>
                                    <p className="text-slate-600 text-xs">Use the search bar above to find and add ASINs.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
                                    <thead className="bg-slate-950/60">
                                        <tr>
                                            <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase w-16">Sr. No</th>
                                            <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase">ASIN</th>
                                            <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase">Product</th>
                                            <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Price</th>
                                            <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Qty for this box (per seller)</th>
                                            <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Weight (kg)</th>
                                            <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase w-24">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {groupedAddItems.map((group, index) => {
                                            const item = group.representative;
                                            const totalQtyForBox = group.sellerRows.reduce((sum: number, r: any) => sum + (addQuantities[r.id] ?? 0), 0);
                                            return (
                                                <tr key={item.asin} className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border-l-2 border-l-emerald-500">
                                                    <td className="px-3 py-3 text-center text-slate-400 font-bold align-top">{index + 1}</td>
                                                    <td className="px-3 py-3 font-mono text-slate-300 align-top">
                                                        <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1">
                                                            {item.asin} <span className="text-[10px]">↗</span>
                                                        </a>
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-200 align-top"><div className="truncate max-w-[250px]">{item.product_name || '-'}</div></td>
                                                    <td className="px-3 py-3 text-center text-emerald-400 font-semibold align-top">{item.buying_price ? `₹${item.buying_price}` : '-'}</td>
                                                    {/* Per-seller qty inputs */}
                                                    <td className="px-3 py-2 text-center">
                                                        <div className="flex flex-col gap-2">
                                                            {group.sellerRows.map((sellerItem: any) => {
                                                                const sellerPending = sellerItem.pending_quantity ?? sellerItem.buying_quantity ?? sellerItem.ordered_quantity ?? 0;
                                                                const sellerTag = sellerItem.seller_tag || '??';
                                                                return (
                                                                    <div key={sellerItem.id} className="flex items-center justify-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold min-w-[28px] text-center ${SELLER_TAG_COLORS[sellerTag] || 'bg-slate-700 text-white'}`}>{sellerTag}</span>
                                                                        <input type="number" min={0} max={sellerPending} value={addQuantities[sellerItem.id] ?? 0}
                                                                            onChange={(e) => { const val = Math.min(Number(e.target.value) || 0, sellerPending); setAddQuantities((prev) => ({ ...prev, [sellerItem.id]: val })); }}
                                                                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                                        <span className="text-[10px] text-slate-500 w-16">{sellerPending} pending</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {group.sellerRows.length > 1 && (
                                                                <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-800 pt-1 mt-1">Total: {totalQtyForBox}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {/* Shared weight per ASIN */}
                                                    <td className="px-3 py-2 text-center align-top">
                                                        <input type="number" min={0} step={0.01} value={addWeights[group.sellerRows[0]?.id] ?? item.product_weight ?? 0}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value) || 0;
                                                                // Set same weight for all seller rows of this ASIN
                                                                setAddWeights((prev) => {
                                                                    const updated = { ...prev };
                                                                    group.sellerRows.forEach((r: any) => { updated[r.id] = val; });
                                                                    return updated;
                                                                });
                                                            }}
                                                            className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </td>
                                                    <td className="px-3 py-2 text-center align-top">
                                                        <button onClick={() => handleRemoveAsinFromBox(item.asin)} className="text-rose-400 hover:text-rose-300 text-xs font-medium">✕ Remove</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900 rounded-lg border border-slate-800 h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            {/* GROUPED VIEW */}
                            {viewMode === "grouped" && (
                                <div className="p-4 space-y-3">
                                    {groupedBoxes.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500">
                                            No items in boxes yet. Move delivered items from Inbound
                                            tab.
                                        </div>
                                    ) : (
                                        groupedBoxes.map(group => {
                                            const isExpanded = expandedBoxes.has(group.box_number);
                                            return (
                                                <div
                                                    key={group.box_number}
                                                    className="border rounded-xl overflow-hidden transition-all border-blue-500/30 bg-blue-500/5"
                                                >
                                                    <div
                                                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                                                        onClick={() => toggleExpand(group.box_number)}
                                                    >
                                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                            <svg
                                                                className={`w-4 h-4 sm:w-5 sm:h-5 text-slate-400 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""
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

                                                            <span className="hidden sm:inline text-sm text-slate-400">
                                                                {new Set(group.items.map(i => i.asin)).size} ASINs · {group.total_quantity} qty · {group.items[0]?.total_box_weight ? `${group.items[0].total_box_weight} kg` : ''}
                                                            </span>
                                                            <span className="sm:hidden text-xs text-slate-400">
                                                                {new Set(group.items.map(i => i.asin)).size}A · {group.total_quantity}qty
                                                            </span>

                                                            {group.items[0]?.booking_date && (
                                                                <span className="hidden sm:inline text-xs text-slate-500">
                                                                    📅 {new Date(group.items[0].booking_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                                </span>
                                                            )}

                                                            {(group.items[0]?.box_created_at || group.items[0]?.moved_from_inbound_at) && (
                                                                <span className="hidden sm:inline text-xs text-slate-500">
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
                                                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold hover:bg-blue-600 hover:text-white transition-all shadow"
                                                        >
                                                                <span className="hidden sm:inline">📥 Download</span><span className="sm:hidden">📥</span>
                                                            </button>
                                                            <button
                                                                onClick={() => setEditBoxData(group)}
                                                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all shadow"
                                                            >
                                                                <span className="hidden sm:inline">✏️ Edit</span><span className="sm:hidden">✏️</span>
                                                            </button>
                                                            <button
                                                                disabled={moving}
                                                                onClick={() => handleMoveToChecking(group.box_number)}
                                                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all disabled:opacity-50 shadow"
                                                            >
                                                                {moving ? '⏳' : '✅'}<span className="hidden sm:inline"> {moving ? 'Moving...' : 'Move to Checking'}</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteBox(group.box_number)}
                                                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow"
                                                            >
                                                                <span className="hidden sm:inline">🗑 Delete</span><span className="sm:hidden">🗑</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="border-t border-slate-800">
                                                            <table className="w-full">
                                                                <thead className="bg-slate-950/50">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase w-14">
                                                                            Sr.
                                                                        </th>
                                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase">
                                                                            ASIN
                                                                        </th>
                                                                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase">
                                                                            Product Name
                                                                        </th>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                            Funnel
                                                                        </th>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                            Seller Tag
                                                                        </th>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                            Origin
                                                                        </th>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                            Qty
                                                                        </th>
                                                                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                            Price
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-800/50">
                                                                    {mergeBoxItems(group.items).map((merged, idx) => {
                                                                        const item = merged.representative;
                                                                        const totalQty = merged.sellers.reduce((s, x) => s + x.qty, 0);
                                                                        return (
                                                                            <tr
                                                                                key={item.asin + '-' + idx}
                                                                                className="hover:bg-slate-800/30 transition-colors"
                                                                            >
                                                                                <td className="px-3 py-2 text-sm text-slate-500 text-center font-bold">
                                                                                    {idx + 1}
                                                                                </td>
                                                                                <td className="px-3 py-2 font-mono text-sm text-slate-300">
                                                                                    <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1 w-fit truncate max-w-[120px]">
                                                                                        {item.asin} <span className="text-[10px]">↗</span>
                                                                                    </a>
                                                                                </td>
                                                                                <td className="px-3 py-2 text-sm text-slate-200">
                                                                                    <div className="truncate max-w-[200px]">
                                                                                        {item.product_name || "-"}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    {(() => {
                                                                                        const { display, color } =
                                                                                            getFunnelBadgeStyle(item.funnel);
                                                                                        return display === "-" ? (
                                                                                            <span className="text-slate-600">
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
                                                                                <td className="px-3 py-2 text-center">
                                                                                    <div className="flex flex-wrap gap-1.5 justify-center items-center">
                                                                                        {merged.sellers.map(s => (
                                                                                            <div key={s.id} className="flex items-center gap-1">
                                                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_TAG_COLORS[s.tag] || 'bg-slate-700 text-white'}`}>
                                                                                                    {s.tag}
                                                                                                </span>
                                                                                                <span className="text-xs text-slate-300 font-semibold">{s.qty}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">
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
                                                                                                <span className="text-slate-600">
                                                                                                    -
                                                                                                </span>
                                                                                            )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-3 py-2 text-sm text-slate-300 text-center font-bold">
                                                                                    {totalQty}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-sm text-slate-300 text-center">
                                                                                    {item.buying_price
                                                                                        ? `₹${item.buying_price}`
                                                                                        : "-"}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
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
                                    className="w-full divide-y divide-slate-800"
                                    style={{ minWidth: "1200px" }}
                                >
                                    <thead className="bg-slate-950 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                Box ID
                                            </th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                Total weight (kg)
                                            </th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                Items
                                            </th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                ASINs
                                            </th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                                Status
                                            </th>
                                            <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {groupedBoxes.map(group => {
                                            return (
                                                <tr
                                                    key={group.box_number}
                                                    className="hover:bg-slate-800/40"
                                                >
                                                    <td className="px-3 py-2 text-sm text-slate-200 text-center">
                                                        {group.box_number}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-200 text-center">
                                                        -
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-200 text-center">
                                                        {group.total_items} items
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-200 text-center">
                                                        <div className="flex flex-wrap justify-center gap-1">
                                                            {group.items.filter(i => i.asin).map((i, idx, arr) => (
                                                                <span key={i.id}>
                                                                    <a href={i.product_link || `https://www.amazon.in/dp/${i.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                                                                        {i.asin}
                                                                    </a>
                                                                    {idx < arr.length - 1 ? ", " : ""}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-slate-200 text-center">
                                                        {group.status === "assigned"
                                                            ? "Open"
                                                            : group.status.charAt(0).toUpperCase() + group.status.slice(1)}
                                                    </td>
                                                    <td className="px-3 py-2 text-sm text-center">
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
                                                                className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all"
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
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
                    <div className="w-full max-w-6xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-white">📜 Box History</h2>
                                <p className="text-xs text-slate-400 mt-1">All deleted and moved boxes are archived here</p>
                            </div>
                            <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-white text-2xl">×</button>
                        </div>

                        <div className="flex-1 overflow-auto px-5 py-4">
                            {historyLoading ? (
                                <div className="h-40 flex items-center justify-center text-slate-400">Loading history...</div>
                            ) : historyData.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-slate-500">No box history yet.</div>
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
                                                <div key={idx} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/30">
                                                    <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 bg-slate-900/50">
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            <span className="font-bold text-white text-base">📦 {group.box_number}</span>
                                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${actionColor}`}>{actionLabel}</span>
                                                            <span className="text-xs text-slate-400">{uniqueAsins} ASINs · {totalQty} qty</span>
                                                            {group.reason && (
                                                                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Reason: {group.reason}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(group.archived_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                                                            {new Date(group.archived_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    </div>
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-slate-950/50">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left text-slate-400">ASIN</th>
                                                                <th className="px-3 py-2 text-left text-slate-400">Product</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Seller</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Funnel</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Qty</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Price</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Weight</th>
                                                                <th className="px-3 py-2 text-center text-slate-400">Origin</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800/40">
                                                            {group.items.map((item, i) => (
                                                                <tr key={i} className="hover:bg-slate-800/30">
                                                                    <td className="px-3 py-2 font-mono text-slate-200">{item.asin}</td>
                                                                    <td className="px-3 py-2 text-slate-300"><div className="truncate max-w-[200px]">{item.product_name || '-'}</div></td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {item.seller_tag ? (
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_TAG_COLORS[item.seller_tag] || 'bg-slate-700 text-white'}`}>{item.seller_tag}</span>
                                                                        ) : '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        {item.funnel ? (() => {
                                                                            const { display, color } = getFunnelBadgeStyle(item.funnel);
                                                                            return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>{display}</span>;
                                                                        })() : '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-slate-200 font-bold">{item.quantity_assigned ?? 0}</td>
                                                                    <td className="px-3 py-2 text-center text-slate-300">{item.buying_price ? `₹${item.buying_price}` : '-'}</td>
                                                                    <td className="px-3 py-2 text-center text-slate-300">{item.product_weight ? `${item.product_weight} kg` : '-'}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <div className="flex gap-0.5 justify-center">
                                                                            {item.origin_india && <span className="px-1 py-0.5 bg-orange-500 text-white rounded text-[9px] font-bold">IN</span>}
                                                                            {item.origin_china && <span className="px-1 py-0.5 bg-red-500 text-white rounded text-[9px] font-bold">CN</span>}
                                                                            {item.origin_us && <span className="px-1 py-0.5 bg-sky-500 text-white rounded text-[9px] font-bold">US</span>}
                                                                            {!item.origin_india && !item.origin_china && !item.origin_us && <span className="text-slate-600">-</span>}
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

                        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
                            <button onClick={() => setHistoryOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800">Close</button>
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
                direction="BOXES_TO_INBOUND"
                sellerId={0}
                sellerTag={null}               // no filter → show ALL sellers
                sourceTableName="india_box_checking"
                targetTableName="india_inbound_tracking"
            />
        </div>
    );
}
