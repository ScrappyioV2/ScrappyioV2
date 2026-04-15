"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import { Search, Trash2, Plus, X, GripVertical, Package, ArrowLeft, Save, Loader2 } from "lucide-react";

// ─── CONSTANTS ──────────────────────────────────────────

// ─── TYPES ──────────────────────────────────────────────
type FormRow = {
    rowId: string;
    inboundItem: any | null; // null = empty row
    asin: string;
    productName: string;
    sku: string;
    sellerEntries: { id: string; tag: string; qty: number; maxQty: number; inboundItem: any }[];
    weight: number;
    price: number;
    isNew?: boolean; // true for rows added to edit box
};

type VyaparBoxFormProps = {
    mode: "create" | "edit";
    editBoxGroup?: any; // GroupedBox for edit mode
    onSave: () => void;
    onCancel: () => void;
    onCountsChange: () => void;
    showToast: (msg: string, type: "success" | "error" | "warning") => void;
};

let rowCounter = 0;
function nextRowId() {
    return `row-${++rowCounter}-${Date.now()}`;
}

// ─── COMPONENT ──────────────────────────────────────────
export default function VyaparBoxForm({ mode, editBoxGroup, onSave, onCancel, onCountsChange, showToast }: VyaparBoxFormProps) {
    // ── Header state ──
    const [boxId, setBoxId] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [totalWeight, setTotalWeight] = useState<string>("");

    // ── Row state ──
    const [rows, setRows] = useState<FormRow[]>([]);
    const [saving, setSaving] = useState(false);

    // ── Search state ──
    const [activeSearchRowId, setActiveSearchRowId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [inboundDelivered, setInboundDelivered] = useState<any[]>([]);
    const [inboundLoading, setInboundLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // ── Fetch inbound delivered items ──
    const fetchInbound = useCallback(async () => {
        setInboundLoading(true);
        try {
            const { data, error } = await supabase
                .from("india_inbound_tracking")
                .select("*")
                .eq("status", "delivered")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setInboundDelivered(data || []);
        } catch (err) {
            console.error("Error fetching inbound:", err);
        } finally {
            setInboundLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInbound();
    }, [fetchInbound]);

    // ── Persist form state to sessionStorage ──
    const STORAGE_KEY = `vyapar-box-form-${mode}`;

    // Save state on every change
    useEffect(() => {
        if (rows.length === 0 && !boxId) return; // don't save empty initial state
        const state = { boxId, bookingDate, totalWeight, rows };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch { }
    }, [boxId, bookingDate, totalWeight, rows]);

    // Clear on successful save or cancel
    const clearSessionState = () => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch { }
    };

    // ── Initialize for EDIT mode ──
    useEffect(() => {
        if (mode === "edit" && editBoxGroup) {
            setBoxId(editBoxGroup.box_number || "");
            setBookingDate(editBoxGroup.items[0]?.booking_date || "");
            setTotalWeight(editBoxGroup.items[0]?.total_box_weight?.toString() || "");

            // One FormRow per item (no ASIN grouping)
            const formRows: FormRow[] = editBoxGroup.items.map((item: any) => ({
                rowId: nextRowId(),
                inboundItem: item,
                asin: item.asin,
                productName: item.product_name || "",
                sku: item.sku || "",
                sellerEntries: [{
                    id: item.id,
                    tag: item.seller_tag || "??",
                    qty: item.quantity_assigned ?? item.buying_quantity ?? 0,
                    maxQty: (item.quantity_assigned ?? 0) + (item._trackingPending ?? 0),
                    inboundItem: item,
                }],
                weight: item.product_weight ?? 0,
                price: item.buying_price ?? 0,
            }));

            setRows(formRows);

            // Fetch tracking pending for max-allowed calculation
            const trackingIds = editBoxGroup.items.map((i: any) => i.inbound_tracking_id).filter(Boolean);
            if (trackingIds.length > 0) {
                supabase
                    .from("india_inbound_tracking")
                    .select("id, pending_quantity")
                    .in("id", trackingIds)
                    .then(({ data }) => {
                        if (data) {
                            const pendingMap: Record<string, number> = {};
                            data.forEach((r: any) => { pendingMap[r.id] = r.pending_quantity ?? 0; });
                            setRows(prev => prev.map(row => ({
                                ...row,
                                sellerEntries: row.sellerEntries.map(se => ({
                                    ...se,
                                    maxQty: (se.qty) + (pendingMap[se.inboundItem?.inbound_tracking_id] ?? 0),
                                })),
                            })));
                        }
                    });
            }
        } else if (mode === "create") {
            // Only set empty row if no session state was restored
            try {
                const saved = sessionStorage.getItem(`vyapar-box-form-create`);
                if (saved) {
                    const state = JSON.parse(saved);
                    if (state.rows?.length > 0 && state.rows.some((r: any) => r.asin)) {
                        setRows(state.rows);
                        if (state.boxId) setBoxId(state.boxId);
                        if (state.bookingDate) setBookingDate(state.bookingDate);
                        if (state.totalWeight) setTotalWeight(state.totalWeight);
                        return;
                    }
                }
            } catch { }
            setRows([{ rowId: nextRowId(), inboundItem: null, asin: "", productName: "", sku: "", sellerEntries: [], weight: 0, price: 0 }]);
        }
    }, [mode, editBoxGroup]);

    // ── Close search dropdown on outside click ──
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setActiveSearchRowId(null);
                setSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Item IDs already added ──
    const addedItemIds = useMemo(() => new Set(rows.flatMap(r => r.sellerEntries.map(se => se.id)).filter(Boolean)), [rows]);

    // ── Search candidates (individual items) ──
    const searchCandidates = useMemo(() => {
        let filtered = inboundDelivered.filter((p: any) =>
            !addedItemIds.has(p.id) && (p.pending_quantity ?? 0) > 0
        );
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter((p: any) =>
                p.asin?.toLowerCase().includes(q) ||
                p.product_name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q)
            );
        }
        return filtered.slice(0, 10).map(p => ({
            item: p,
            tag: p.seller_tag || "??",
            pending: p.pending_quantity ?? 0,
        }));
    }, [inboundDelivered, addedItemIds, searchQuery]);

    // ── Select an item from dropdown ──
    const handleSelectItem = (rowId: string, candidate: { item: any; tag: string; pending: number }) => {
        const p = candidate.item;
        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            return {
                ...row,
                inboundItem: p,
                asin: p.asin,
                productName: p.product_name || "",
                sku: p.sku || "",
                sellerEntries: [{
                    id: p.id,
                    tag: candidate.tag,
                    qty: candidate.pending,
                    maxQty: candidate.pending,
                    inboundItem: p,
                }],
                weight: p.product_weight ?? 0,
                price: p.buying_price ?? 0,
                isNew: mode === "edit",
            };
        }));
        setActiveSearchRowId(null);
        setSearchQuery("");
    };

    // ── Add empty row ──
    const handleAddRow = () => {
        setRows(prev => [...prev, {
            rowId: nextRowId(),
            inboundItem: null,
            asin: "",
            productName: "",
            sku: "",
            sellerEntries: [],
            weight: 0,
            price: 0,
        }]);
    };

    // ── Remove row ──
    const handleRemoveRow = (rowId: string) => {
        setRows(prev => prev.filter(r => r.rowId !== rowId));
    };

    // ── Update seller qty ──
    const handleSellerQtyChange = (rowId: string, sellerIdx: number, newQty: number) => {
        setRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;
            const entries = [...row.sellerEntries];
            entries[sellerIdx] = { ...entries[sellerIdx], qty: Math.min(Math.max(0, newQty), entries[sellerIdx].maxQty) };
            return { ...row, sellerEntries: entries };
        }));
    };

    // ── Update weight ──
    const handleWeightChange = (rowId: string, val: number) => {
        setRows(prev => prev.map(row => row.rowId === rowId ? { ...row, weight: val } : row));
    };

    // ── Keyboard navigation between cells ──
    const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colName: string) => {
        const input = e.currentTarget;
        const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>('.vyapar-cell'));
        const currentIdx = allInputs.indexOf(input);
        if (currentIdx === -1) return;

        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            const next = allInputs[currentIdx + 1];
            if (next) next.focus();
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const prev = allInputs[currentIdx - 1];
            if (prev) prev.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const cols = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-col="${colName}"]`));
            const colIdx = cols.indexOf(input);
            if (colIdx < cols.length - 1) cols[colIdx + 1].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const cols = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-col="${colName}"]`));
            const colIdx = cols.indexOf(input);
            if (colIdx > 0) cols[colIdx - 1].focus();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = allInputs[currentIdx + 1];
            if (next) next.focus();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = allInputs[currentIdx - 1];
            if (prev) prev.focus();
        }
    };

    // ── Totals ──
    const totalQty = rows.reduce((sum, row) => sum + row.sellerEntries.reduce((s, se) => s + se.qty, 0), 0);
    const totalItems = rows.filter(r => r.asin).length;

    // ══════════════════════════════════════════════════════
    // SAVE — CREATE MODE
    // ══════════════════════════════════════════════════════
    const handleSaveCreate = async () => {
        if (!boxId.trim()) return showToast("Box ID is required", "error");
        const filledRows = rows.filter(r => r.asin && r.sellerEntries.some(se => se.qty > 0));
        if (filledRows.length === 0) return showToast("Add at least one item", "error");

        setSaving(true);
        try {
            const boxNum = boxId.trim().toUpperCase();
            const weightNum = totalWeight ? Number(totalWeight) : null;
            const inserts: any[] = [];

            for (const row of filledRows) {
                for (const se of row.sellerEntries) {
                    if (se.qty <= 0) continue;
                    const item = se.inboundItem;
                    const originalQty = item.pending_quantity ?? item.buying_quantity ?? 0;
                    const qty = Math.min(se.qty, originalQty);
                    if (qty <= 0) continue;

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
                        ordered_quantity: item.buying_quantity ?? qty,
                        seller_link: item.seller_link ?? null,
                        seller_phone: item.seller_phone ?? null,
                        payment_method: item.payment_method ?? null,
                        tracking_details: item.tracking_details ?? null,
                        delivery_date: item.delivery_date ?? null,
                        product_weight: row.weight,
                        box_number: boxNum,
                        box_status: "assigned",
                        booking_date: bookingDate || null,
                        moved_from_inbound_at: new Date().toISOString(),
                        total_box_weight: weightNum,
                        inbound_tracking_id: item.id,
                        sns_active: item.sns_active ?? false,
                    });

                    // Update inbound tracking
                    const remaining = originalQty - qty;
                    const currentAssigned = item.assigned_quantity ?? 0;
                    if (remaining <= 0) {
                        await supabase.from("india_inbound_tracking").delete().eq("id", item.id);
                    } else {
                        await supabase.from("india_inbound_tracking").update({
                            assigned_quantity: currentAssigned + qty,
                            pending_quantity: remaining,
                        }).eq("id", item.id);
                    }
                }
            }

            if (inserts.length === 0) { setSaving(false); return; }

            const { error: insertError } = await supabase.from("india_inbound_boxes").insert(inserts);
            if (insertError) throw insertError;

            // Archive to history
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
                action: "created",
                reason: null,
                original_created_at: new Date().toISOString(),
            }));
            await supabase.from("india_box_history").insert(historyRows);

            showToast(`Box "${boxNum}" created with ${inserts.length} item(s).`, "success");
            clearSessionState();
            onCountsChange();
            onSave();
        } catch (err: any) {
            console.error("Error creating box:", err);
            showToast(err.message || "Failed to create box.", "error");
        } finally {
            setSaving(false);
        }
    };

    // ══════════════════════════════════════════════════════
    // SAVE — EDIT MODE
    // ══════════════════════════════════════════════════════
    const handleSaveEdit = async () => {
        if (!boxId.trim()) return showToast("Box ID cannot be empty", "error");
        setSaving(true);
        try {
            const boxNum = boxId.trim().toUpperCase();
            const weightNum = totalWeight ? Number(totalWeight) : null;

            for (const row of rows) {
                for (const se of row.sellerEntries) {
                    const item = se.inboundItem;
                    if (!item) continue;

                    const oldQty = item.quantity_assigned ?? item.buying_quantity ?? 0;
                    const newQty = se.qty;
                    const trackingId = item.inbound_tracking_id || (row.isNew ? item.id : null);
                    const itemId = item.id;

                    if (newQty <= 0) {
                        // Remove from box
                        if (itemId && !String(itemId).startsWith("new-")) {
                            await supabase.from("india_inbound_boxes").delete().eq("id", itemId);
                        }
                    } else if (row.isNew || String(itemId).startsWith("new-")) {
                        // New item
                        await supabase.from("india_inbound_boxes").insert({
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
                            product_weight: row.weight,
                            box_number: boxNum,
                            box_status: "assigned",
                            booking_date: bookingDate || null,
                            total_box_weight: weightNum,
                            inbound_tracking_id: trackingId || item.id,
                            box_created_at: new Date().toISOString(),
                            moved_from_inbound_at: new Date().toISOString(),
                            sns_active: item.sns_active ?? false,
                        });
                    } else {
                        // Update existing
                        await supabase.from("india_inbound_boxes").update({
                            box_number: boxNum,
                            booking_date: bookingDate || null,
                            total_box_weight: weightNum,
                            quantity_assigned: newQty,
                            ordered_quantity: newQty,
                            product_weight: row.weight,
                        }).eq("id", itemId);
                    }

                    // Update tracking quantities
                    const delta = newQty - oldQty;
                    if (delta !== 0 && trackingId) {
                        const { data: trackData } = await supabase.from("india_inbound_tracking")
                            .select("assigned_quantity, pending_quantity").eq("id", trackingId).single();
                        if (trackData) {
                            const newPending = Math.max(0, (trackData.pending_quantity || 0) - delta);
                            const newAssigned = Math.max(0, (trackData.assigned_quantity || 0) + delta);
                            if (newPending <= 0) {
                                await supabase.from("india_inbound_tracking").delete().eq("id", trackingId);
                            } else {
                                await supabase.from("india_inbound_tracking").update({
                                    assigned_quantity: newAssigned,
                                    pending_quantity: newPending,
                                }).eq("id", trackingId);
                            }
                        }
                    }
                }
            }

            // Handle removed rows (rows in edit group but not in current rows)
            if (editBoxGroup) {
                const currentItemIds = new Set(rows.flatMap(r => r.sellerEntries.map(se => se.id)));
                for (const item of editBoxGroup.items) {
                    if (!currentItemIds.has(item.id) && !String(item.id).startsWith("new-")) {
                        await supabase.from("india_inbound_boxes").delete().eq("id", item.id);
                        // Restore qty to tracking
                        const qty = item.quantity_assigned ?? 0;
                        if (qty > 0 && item.inbound_tracking_id) {
                            const { data: td } = await supabase.from("india_inbound_tracking")
                                .select("assigned_quantity, pending_quantity").eq("id", item.inbound_tracking_id).single();
                            if (td) {
                                await supabase.from("india_inbound_tracking").update({
                                    assigned_quantity: Math.max(0, (td.assigned_quantity ?? 0) - qty),
                                    pending_quantity: (td.pending_quantity ?? 0) + qty,
                                }).eq("id", item.inbound_tracking_id);
                            }
                        }
                    }
                }
            }

            showToast(`Box ${boxNum} updated successfully!`, "success");
            clearSessionState();
            onCountsChange();
            onSave();
        } catch (err: any) {
            console.error("Error saving box:", err);
            showToast("Failed to save: " + err.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // ══════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════
    return (
        <div className="h-full flex flex-col bg-[#111111] rounded-xl border border-white/[0.1] overflow-hidden">
            <style>{`
                .vyapar-input::-webkit-inner-spin-button,
                .vyapar-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
                .vyapar-input[type=number] { -moz-appearance: textfield; }
            `}</style>
            {/* ── HEADER ───────────────────────────────── */}
            <div className="flex-none border-b border-white/[0.1] bg-[#1a1a1a]">
                {/* Top bar */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { clearSessionState(); onCancel(); }} className="p-2 rounded-lg hover:bg-[#111111] text-gray-400 hover:text-white transition-all" title="Back">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-white flex items-center gap-2">
                                <Package className="w-5 h-5 text-orange-500" />
                                {mode === "create" ? "Create New Box" : `Edit Box — ${editBoxGroup?.box_number || ""}`}
                            </h1>
                            <p className="text-xs text-gray-300 mt-0.5">
                                {mode === "create" ? "Add items from inbound tracking to create a box" : "Modify items, quantities, or box metadata"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{totalItems}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Items</div>
                        </div>
                        <div className="w-px h-10 bg-[#1a1a1a]" />
                        <div className="text-right">
                            <div className="text-2xl font-bold text-orange-500">{totalQty}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Qty</div>
                        </div>
                    </div>
                </div>

                {/* Box metadata fields */}
                <div className="px-6 pb-4 flex items-end gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Box ID *</label>
                        <input
                            type="text"
                            value={boxId}
                            onChange={e => setBoxId(e.target.value)}
                            placeholder="e.g. 66024430"
                            className="vyapar-input w-44 px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none placeholder:text-gray-500"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Booking Date</label>
                        <input
                            type="date"
                            max="9999-12-31"
                            value={bookingDate}
                            onChange={e => setBookingDate(e.target.value)}
                            className="w-44 px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Weight (kg)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={totalWeight}
                            onChange={e => setTotalWeight(e.target.value)}
                            placeholder="e.g. 12.5"
                            className="vyapar-input w-36 px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none placeholder:text-gray-500"
                        />
                    </div>
                </div>
            </div>

            {/* ── TABLE ──────────────────────────────────── */}
            <div className="flex-1 overflow-auto" ref={searchRef}>
                <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                    <thead className="bg-[#111111] sticky top-0 z-20">
                        <tr className="border-b-2 border-white/[0.1]">
                            <th className="w-12 px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase">#</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase min-w-[160px]">ASIN / Item</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase">Product Name</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase w-28">SKU</th>
                            <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase min-w-[200px]">Seller Qty</th>
                            <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Weight (g)</th>
                            <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Price</th>
                            <th className="px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase w-24">Amount</th>
                            <th className="w-14 px-6 py-4"></th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row, idx) => {
                            const rowTotal = row.sellerEntries.reduce((s, se) => s + se.qty, 0);
                            const amount = rowTotal * (row.price || 0);
                            const isSearching = activeSearchRowId === row.rowId;

                            return (
                                <tr key={row.rowId} className={`group transition-colors border-b-2 border-white/[0.1] ${row.asin ? "hover:bg-white/[0.05] bg-[#111111]/30" : "bg-orange-500/5"}`}>
                                    {/* # */}
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-xs font-bold text-gray-500">{idx + 1}</span>
                                    </td>

                                    {/* ASIN / Item search */}
                                    <td className="px-6 py-4 relative">
                                        {row.asin ? (
                                            <div>
                                                <a
                                                    href={row.inboundItem?.product_link || `https://www.amazon.in/dp/${row.asin}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-sm text-orange-500 hover:text-orange-400 underline"
                                                >
                                                    {row.asin}
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    ref={el => { searchInputRefs.current[row.rowId] = el; }}
                                                    type="text"
                                                    value={isSearching ? searchQuery : ""}
                                                    onChange={e => { setSearchQuery(e.target.value); setActiveSearchRowId(row.rowId); }}
                                                    onFocus={() => setActiveSearchRowId(row.rowId)}
                                                    placeholder="Search ASIN or product..."
                                                    className="w-full px-3 py-1.5 bg-[#111111] border border-dashed border-white/[0.1] rounded-lg text-sm text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none placeholder:text-gray-500"
                                                />
                                                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />

                                                {/* Search dropdown */}
                                                {isSearching && searchCandidates.length > 0 && (
                                                    <div className="absolute top-full left-0 mt-1 bg-[#111111] border border-white/[0.1] rounded-xl shadow-2xl z-50 max-h-[400px] overflow-y-auto w-[650px]">
                                                        {searchCandidates.map(candidate => (
                                                            <div
                                                                key={candidate.item.id}
                                                                onClick={() => handleSelectItem(row.rowId, candidate)}
                                                                className="px-4 py-3 hover:bg-[#111111] cursor-pointer border-b border-white/[0.1] last:border-0 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="font-mono text-sm font-bold text-white">{candidate.item.asin}</span>
                                                                    <span className="text-xs text-amber-400 font-bold bg-amber-500/15 px-2 py-0.5 rounded">{candidate.pending} pending</span>
                                                                </div>
                                                                <div className="text-xs text-gray-300 truncate mb-1.5">{candidate.item.product_name || "-"}</div>
                                                                <div className="flex gap-1.5">
                                                                    <span className="flex items-center gap-1 text-[10px]">
                                                                        <span className={`px-1.5 py-0.5 rounded font-bold ${SELLER_STYLES[candidate.tag] || "bg-[#1a1a1a] text-white"}`}>{candidate.tag}</span>
                                                                        {candidate.item.sns_active && <span className="px-1.5 py-0.5 bg-teal-900/50 text-teal-300 rounded font-medium">S&S</span>}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {isSearching && searchCandidates.length === 0 && searchQuery.trim() && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl z-50 px-4 py-3 text-xs text-gray-300">
                                                        No matching items found.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </td>

                                    {/* Product Name */}
                                    <td className="px-6 py-4 text-sm text-gray-300" title={row.productName}>
                                        <div className="flex items-center">
                                            <span className="truncate max-w-[200px]">{row.productName || <span className="text-gray-500 italic">—</span>}</span>
                                            {row.inboundItem?.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}
                                        </div>
                                    </td>

                                    {/* SKU */}
                                    <td className="px-6 py-4 text-xs text-gray-300 font-mono">
                                        {row.sku || <span className="text-gray-500">—</span>}
                                    </td>

                                    {/* Seller Qty */}
                                    <td className="px-6 py-4 text-center">
                                        {row.sellerEntries.length > 0 ? (
                                            <div className="flex flex-col gap-1.5 items-center">
                                                {row.sellerEntries.map((se, si) => (
                                                    <div key={se.id || si} className="flex items-center gap-1.5">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold min-w-[26px] text-center ${SELLER_STYLES[se.tag] || "bg-[#1a1a1a] text-white"}`}>
                                                            {se.tag}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={se.maxQty}
                                                            value={se.qty}
                                                            onChange={e => handleSellerQtyChange(row.rowId, si, Number(e.target.value) || 0)}
                                                            onKeyDown={e => handleCellKeyDown(e, idx, `qty-${si}`)}
                                                            data-col={`qty-${si}`}
                                                            className="vyapar-input vyapar-cell w-16 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white text-center focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                                        />
                                                        {mode === "create" && (
                                                            <span className="text-[9px] text-gray-500 w-8">/{se.maxQty}</span>
                                                        )}
                                                    </div>
                                                ))}
                                                {row.sellerEntries.length > 1 && (
                                                    <div className="text-[10px] text-gray-500 font-semibold border-t border-white/[0.1] pt-1 w-full text-center">
                                                        Total: {rowTotal}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 text-xs">—</span>
                                        )}
                                    </td>

                                    {/* Weight */}
                                    <td className="px-6 py-4 text-center">
                                        {row.asin ? (
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={row.weight}
                                                onChange={e => handleWeightChange(row.rowId, Number(e.target.value) || 0)}
                                                onKeyDown={e => handleCellKeyDown(e, idx, "weight")}
                                                data-col="weight"
                                                className="vyapar-input vyapar-cell w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white text-center focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                            />
                                        ) : <span className="text-gray-500 text-xs">—</span>}
                                    </td>

                                    {/* Price */}
                                    <td className="px-6 py-4 text-center text-xs text-gray-300">
                                        {row.price ? `₹${row.price}` : <span className="text-gray-500">—</span>}
                                    </td>

                                    {/* Amount */}
                                    <td className="px-6 py-4 text-center text-xs font-semibold text-emerald-400">
                                        {amount > 0 ? `₹${amount.toFixed(0)}` : <span className="text-gray-500">—</span>}
                                    </td>

                                    {/* Delete */}
                                    <td className="px-6 py-4 text-center">
                                        {row.asin && (
                                            <button
                                                onClick={() => handleRemoveRow(row.rowId)}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="Remove item"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* ADD ROW button */}
                        <tr>
                            <td colSpan={9} className="px-6 py-4">
                                <button
                                    onClick={handleAddRow}
                                    className="flex items-center gap-2 text-orange-500 hover:text-orange-400 text-xs font-semibold py-2 px-3 rounded-lg hover:bg-white/[0.08] transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    ADD ROW
                                </button>
                            </td>
                        </tr>

                        {/* TOTALS row */}
                        {rows.some(r => r.asin) && (
                            <tr className="bg-[#1a1a1a] border-t-2 border-white/[0.1]">
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4 text-xs font-bold text-gray-300 uppercase">TOTAL</td>
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-sm font-bold text-white bg-orange-500/10 px-3 py-1 rounded-lg border border-orange-500/30">
                                        {totalQty} qty
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center text-xs font-bold text-gray-300">
                                    {rows.reduce((s, r) => s + r.weight * r.sellerEntries.reduce((sq, se) => sq + se.qty, 0), 0).toFixed(0)}g
                                </td>
                                <td className="px-6 py-4"></td>
                                <td className="px-6 py-4 text-center text-sm font-bold text-emerald-400">
                                    ₹{rows.reduce((s, r) => s + r.sellerEntries.reduce((sq, se) => sq + se.qty, 0) * (r.price || 0), 0).toFixed(0)}
                                </td>
                                <td className="px-6 py-4"></td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── FOOTER ─────────────────────────────────── */}
            <div className="flex-none border-t border-white/[0.1] bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
                <div className="text-xs text-gray-300">
                    {totalItems} item{totalItems !== 1 ? "s" : ""} · {totalQty} total qty
                    {totalWeight && ` · ${totalWeight} kg`}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { clearSessionState(); onCancel(); }}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-[#111111] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={mode === "create" ? handleSaveCreate : handleSaveEdit}
                        disabled={saving || !boxId.trim() || totalItems === 0}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-900/30 transition-all"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {mode === "create" ? "Save Box" : "Save Changes"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}