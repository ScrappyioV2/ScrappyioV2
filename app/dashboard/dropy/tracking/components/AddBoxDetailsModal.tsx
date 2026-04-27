"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";

type InboundProduct = {
    id: string;
    asin: string;
    product_name: string | null;
    sku: string | null;
    seller_tag: string | null;
    funnel: string | null;
    buying_quantity: number | null;
    pending_quantity: number | null;
    product_weight: number | null;
    // ADD THESE (match your dropy_inbound_tracking schema)
    origin: string | null;
    origin_india: boolean;
    origin_china: boolean;
    origin_us: boolean;
    buying_price: number | null;
    product_link: string | null;
    journey_id: string | null;
    order_date: string | null;
};

interface AddBoxDetailsModalProps {
    open: boolean;
    onClose: () => void;
    inboundItems: InboundProduct[];
    onSuccess: () => void;
}

type BoxItemDraft = {
    productId: string;
    asin: string;
    product_name: string | null;
    sku: string | null;
    seller_tag: string | null;
    funnel: string | null;
    ordered_quantity: number;
    qty_for_box: number;
    product_weight: number;
};

export default function AddBoxDetailsModal({
    open,
    onClose,
    inboundItems,
    onSuccess,
}: AddBoxDetailsModalProps) {
    const [boxNumber, setBoxNumber] = useState("");
    const [totalBoxWeight, setTotalBoxWeight] = useState<string>("");
    const [boxBookingDate, setBoxBookingDate] = useState(""); // ✅ Added Booking Date
    const [showDropdown, setShowDropdown] = useState(false); // ✅ Added Dropdown visibility
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    // Local draft state per item (only for items with pending > 0)
    const [drafts, setDrafts] = useState<Record<string, BoxItemDraft>>({});

    const itemsInThisBox = useMemo(() => {
        return inboundItems.filter((p) => drafts[p.id]?.qty_for_box !== undefined);
    }, [inboundItems, drafts]);

    const dropdownCandidates = useMemo(() => {
        const alreadyAddedIds = new Set(Object.keys(drafts));
        let filtered = inboundItems.filter((p) => !alreadyAddedIds.has(p.id) && (p.pending_quantity ?? p.buying_quantity ?? 0) > 0);
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter((p) => p.asin.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.product_name ?? "").toLowerCase().includes(q));
        }
        return filtered.slice(0, showDropdown && !search.trim() ? 5 : 50);
    }, [inboundItems, drafts, search, showDropdown]);

    const handleAddToBox = (product: InboundProduct) => {
        const pending = product.pending_quantity ?? product.buying_quantity ?? 0;
        setDrafts((prev) => ({
            ...prev,
            [product.id]: {
                productId: product.id, asin: product.asin, product_name: product.product_name, sku: product.sku,
                seller_tag: product.seller_tag, funnel: product.funnel, ordered_quantity: product.buying_quantity ?? 0,
                qty_for_box: pending, product_weight: Number(product.product_weight ?? 0),
            }
        }));
        setSearch("");
        setShowDropdown(false);
    };

    const handleQtyChange = (product: InboundProduct, raw: string) => {
        const pending = product.pending_quantity ?? product.buying_quantity ?? 0;
        const qty = Math.max(0, Number(raw) || 0);
        if (qty > pending) return; // ✅ cap to pending

        setDrafts((prev) => ({
            ...prev,
            [product.id]: {
                productId: product.id,
                asin: product.asin,
                product_name: product.product_name,
                sku: product.sku,
                seller_tag: product.seller_tag,
                funnel: product.funnel,
                ordered_quantity: product.buying_quantity ?? 0,
                qty_for_box: qty,
                product_weight:
                    prev[product.id]?.product_weight ??
                    Number(product.product_weight ?? 0),
            },
        }));
    };

    const handleWeightChange = (product: InboundProduct, raw: string) => {
        const weight = Math.max(0, Number(raw) || 0);
        setDrafts((prev) => ({
            ...prev,
            [product.id]: {
                productId: product.id,
                asin: product.asin,
                product_name: product.product_name,
                sku: product.sku,
                seller_tag: product.seller_tag,
                funnel: product.funnel,
                ordered_quantity: product.buying_quantity ?? 0,
                qty_for_box: prev[product.id]?.qty_for_box ?? 0,
                product_weight: weight,
            },
        }));
    };

    const handleRemoveRow = (id: string) => {
        setDrafts((prev) => {
            const copy = { ...prev };
            delete copy[id];
            return copy;
        });
    };

    const selectedDrafts = useMemo(
        () => Object.values(drafts).filter((d) => d.qty_for_box > 0),
        [drafts]
    );

    const handleSubmit = async () => {
        setErrorMsg(null);
        if (!boxNumber.trim()) {
            setErrorMsg("Box ID is required.");
            return;
        }
        const totalWeightNum = Number(totalBoxWeight || 0);
        if (!totalWeightNum || totalWeightNum <= 0) {
            setErrorMsg("Total box weight must be > 0.");
            return;
        }
        if (selectedDrafts.length === 0) {
            setErrorMsg("Add at least one item with quantity > 0 for this box.");
            return;
        }

        setSubmitting(true);
        try {
            const now = new Date().toISOString();
            const trimmedBoxNumber = boxNumber.trim();

            // 1) Build box rows (same as before)
            const boxRows = selectedDrafts.map((d) => {
                const src = inboundItems.find((p) => p.id === d.productId)!;
                return {
                    inbound_tracking_id: src.id,
                    asin: src.asin,
                    product_name: src.product_name,
                    sku: src.sku,
                    seller_tag: src.seller_tag,
                    funnel: src.funnel,
                    buying_quantity: src.buying_quantity,
                    // NEW: copy origin + price
                    origin: src.origin,
                    origin_india: src.origin_india ?? false,
                    origin_china: src.origin_china ?? false,
                    origin_us: src.origin_us ?? false,
                    buying_price: src.buying_price,
                    product_weight: d.product_weight,
                    box_number: trimmedBoxNumber,
                    box_status: "assigned", // Skip unassigned status
                    booking_date: boxBookingDate || null, // ✅ Insert Booking Date
                    total_box_weight: totalWeightNum,
                    ordered_quantity: d.ordered_quantity,
                    quantity_assigned: d.qty_for_box,
                    purchase_row_id: src.id,
                    box_created_at: now,
                    moved_from_inbound_at: now,
                };
            });

            // 2) Fetch latest inbound rows for all items being boxed
            const inboundIds = selectedDrafts.map((d) => d.productId);
            const { data: inboundRows, error: inboundErr } = await supabase
                .from("dropy_inbound_tracking")
                .select(`
                id,
                asin,
                product_name,
                sku,
                seller_tag,
                funnel,
                buying_quantity,
                pending_quantity,
                product_weight,
                origin,
                origin_india,
                origin_china,
                origin_us,
                buying_price
                `)
                .in("id", inboundIds);

            if (inboundErr) throw inboundErr;
            const inboundMap = new Map<string, any>(
                (inboundRows || []).map((r: any) => [r.id, r])
            );

            // 3) Insert into dropy_inbound_boxes and get ids
            const { data: insertedBoxes, error: boxError } = await supabase
                .from("dropy_inbound_boxes")
                .insert(boxRows)
                .select(
                    "id, inbound_tracking_id, asin, quantity_assigned, total_box_weight, box_number"
                );

            if (boxError) throw boxError;

            // Archive to history as 'created'
            if (insertedBoxes && insertedBoxes.length > 0) {
                const historyArchive = boxRows.map((r: any) => ({
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
                    box_status: 'assigned',
                    box_booking_date: r.booking_date ?? null,
                    tracking_details: null,
                    delivery_date: null,
                    order_date: r.order_date ?? null,
                    product_link: r.product_link ?? null,
                    seller_link: r.seller_link ?? null,
                    journey_id: r.journey_id ?? null,
                    action: 'created',
                    reason: null,
                    original_created_at: new Date().toISOString(),
                }));
                await supabase.from("dropy_box_history").insert(historyArchive);
            }

            // Group inserted rows by inbound_tracking_id
            const byInbound = new Map<string, any[]>();
            (insertedBoxes || []).forEach((row) => {
                const arr = byInbound.get(row.inbound_tracking_id) || [];
                arr.push(row);
                byInbound.set(row.inbound_tracking_id, arr);
            });

            // 4) For each inbound row: update assigned/pending and create history with pending_after
            for (const [inboundId, rows] of byInbound.entries()) {
                const inbound = inboundMap.get(inboundId);
                if (!inbound) continue;

                const buyingQty = inbound.buying_quantity ?? 0;
                const prevAssigned = inbound.assigned_quantity ?? 0;
                const prevPending =
                    inbound.pending_quantity ??
                    Math.max(buyingQty - prevAssigned, 0);

                const totalAssignedNow = rows.reduce(
                    (sum, r) => sum + (r.quantity_assigned ?? 0),
                    0
                );

                const newAssigned = prevAssigned + totalAssignedNow;
                const newPending = Math.max(buyingQty - newAssigned, 0);

                // 4a) update inbound row
                const { error: updError } = await supabase
                    .from("dropy_inbound_tracking")
                    .update({
                        assigned_quantity: newAssigned,
                        pending_quantity: newPending,
                    })
                    .eq("id", inboundId);

                if (updError) throw updError;

                // 4b) create history rows for EACH box row for this inbound
                let runningPending = prevPending;
                const historyRows = rows.map((r) => {
                    const qty = r.quantity_assigned ?? 0;
                    const pendingAfter = Math.max(runningPending - qty, 0);
                    const rowData = {
                        inbound_tracking_id: inboundId,
                        inbound_box_id: r.id,
                        box_number: r.box_number,
                        asin: r.asin,
                        quantity_assigned: qty,
                        total_box_weight: r.total_box_weight,
                        pending_after: pendingAfter,
                    };
                    runningPending = pendingAfter;
                    return rowData;
                });

                const { error: histError } = await supabase
                    .from("dropy_box_assignment_history")
                    .insert(historyRows);

                if (histError) throw histError;
            }

            onSuccess();
            setDrafts({});
            setBoxNumber("");
            setTotalBoxWeight("");
            setBoxBookingDate("");
        } catch (err: any) {
            console.error("Error saving box details:", err);
            setErrorMsg(err.message || "Failed to save box details.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#111111]/60">
            <div className="w-full max-w-5xl max-h-[90vh] bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl flex flex-col mx-2 sm:mx-0">
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/[0.1] flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-semibold text-white">
                        Add Box Details
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ×
                    </button>
                </div>

                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/[0.1] grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Box ID
                        </label>
                        <input
                            type="text"
                            value={boxNumber}
                            onChange={(e) => setBoxNumber(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="BOX-001"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Total Box Weight (kg)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={totalBoxWeight}
                            onChange={(e) => setTotalBoxWeight(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                            placeholder="e.g. 5.20"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                            Booking Date
                        </label>
                        <input
                            type="date"
                            value={boxBookingDate}
                            onChange={(e) => setBoxBookingDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                    </div>
                </div>

                <div className="px-3 sm:px-5 pt-3 space-y-2">
                    <label className="block text-xs font-semibold text-gray-400">
                        Add ASIN to this box
                    </label>

                    {/* Upgraded Dropdown Search UI */}
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Search by ASIN, SKU or Product name..."
                            className="w-full md:w-96 px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-gray-500"
                        />

                        {showDropdown && dropdownCandidates.length > 0 && (
                            <div className="absolute top-full left-0 z-50 w-full md:w-[650px] mt-1 bg-[#111111] border border-white/[0.1] rounded-xl shadow-2xl max-h-[350px] overflow-y-auto overflow-x-hidden">
                                {dropdownCandidates.map((p) => {
                                    const pending = p.pending_quantity ?? p.buying_quantity ?? 0;
                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setDrafts(prev => ({
                                                    ...prev,
                                                    [p.id]: {
                                                        productId: p.id, asin: p.asin, product_name: p.product_name, sku: p.sku,
                                                        seller_tag: p.seller_tag, funnel: p.funnel, ordered_quantity: p.buying_quantity ?? 0,
                                                        qty_for_box: pending, product_weight: Number(p.product_weight ?? 0)
                                                    }
                                                }));
                                                setShowDropdown(false);
                                                setSearch("");
                                            }}
                                            className="px-5 py-4 hover:bg-[#111111] border-b border-white/[0.1] last:border-0 cursor-pointer transition-colors"
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="text-base font-bold text-white font-mono">{p.asin}</span>
                                                        {p.sku && <span className="text-xs text-gray-100 bg-[#111111] px-2.5 py-0.5 rounded border border-white/[0.1] font-medium">SKU: {p.sku}</span>}
                                                    </div>
                                                    <div className="text-sm font-medium text-gray-100 line-clamp-1 mb-1.5">{p.product_name || '-'}</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded">{p.seller_tag || 'No Tag'}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="bg-amber-500/25 text-amber-300 px-2.5 py-1 rounded text-sm font-bold">{pending} Pending</div>
                                                    <div className="text-sm text-emerald-300 font-bold mt-1.5">₹{p.buying_price || '-'}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <p className="text-[11px] text-gray-500">
                        Only ASINs added here will be included in this box.
                    </p>
                </div>

                <div className="flex-1 overflow-auto px-3 sm:px-5 py-3 sm:py-4">
                    <table className="w-full text-xs border-separate border-spacing-y-1">
                        <thead>
                            <tr className="bg-[#111111]">
                                <th className="px-2 py-2 text-center text-gray-400 w-12">Sr.</th>
                                <th className="px-2 py-2 text-left text-gray-400">ASIN</th>
                                <th className="px-2 py-2 text-left text-gray-400">Product</th>
                                <th className="px-2 py-2 text-left text-gray-400">SKU</th>
                                <th className="px-2 py-2 text-center text-gray-400">Ordered</th>
                                <th className="px-2 py-2 text-center text-gray-400">Qty in Box</th>
                                <th className="px-2 py-2 text-center text-gray-400">Weight (kg)</th>
                                <th className="px-2 py-2 text-center text-gray-400"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemsInThisBox.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-2 py-6 text-center text-gray-300">
                                        No items added yet. Search above to add ASINs.
                                    </td>
                                </tr>
                            ) : (
                                itemsInThisBox.map((p, index) => {
                                    const draft = drafts[p.id];
                                    const ordered = p.buying_quantity ?? 0;
                                    const pending = p.pending_quantity ?? ordered;
                                    return (
                                        <tr key={p.id} className="bg-[#111111]/60 hover:bg-[#111111]">
                                            <td className="px-2 py-2 text-center text-gray-300">{index + 1}</td>
                                            <td className="px-2 py-2 font-mono text-gray-100">
                                                <a href={p.product_link || `https://www.amazon.in/dp/${p.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
                                                    {p.asin}
                                                </a>
                                            </td>

                                            {/* Product */}
                                            <td className="px-2 py-2 text-gray-100">
                                                <div className="truncate max-w-[200px]">
                                                    {p.product_name || "-"}
                                                </div>
                                            </td>

                                            {/* SKU */}
                                            <td className="px-2 py-2 font-mono text-gray-300">
                                                {p.sku || "-"}
                                            </td>

                                            {/* Ordered */}
                                            <td className="px-2 py-2 text-center text-gray-300">
                                                {ordered}
                                            </td>

                                            {/* Qty for this box */}
                                            <td className="px-2 py-2 text-center">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={pending}
                                                    value={draft?.qty_for_box ?? ""}
                                                    onChange={(e) => handleQtyChange(p, e.target.value)}
                                                    className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                />
                                                <div className="text-[10px] text-gray-500 mt-0.5">
                                                    pending {pending}
                                                </div>
                                            </td>

                                            {/* Product weight */}
                                            <td className="px-2 py-2 text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    value={
                                                        draft?.product_weight ?? (p.product_weight ?? "")
                                                    }
                                                    onChange={(e) => handleWeightChange(p, e.target.value)}
                                                    className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                />
                                            </td>

                                            {/* Remove */}
                                            <td className="px-2 py-2 text-center">
                                                {draft && (
                                                    <button
                                                        onClick={() => handleRemoveRow(p.id)}
                                                        className="text-rose-400 hover:text-rose-300 text-xs"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {errorMsg && (
                    <div className="px-3 sm:px-5 pb-2 text-xs text-rose-400">
                        {errorMsg}
                    </div>
                )}

                <div className="px-3 sm:px-5 py-3 border-t border-white/[0.1] flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-500 hover:text-white hover:bg-[#111111]"
                        disabled={submitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {submitting ? "Saving..." : "Submit Box"}
                    </button>
                </div>
            </div>
        </div>
    );
}