'use client';
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { getFunnelBadgeStyle } from '@/lib/utils';
import GenericRollbackModal from '@/components/india-selling/GenericRollbackModal';

// ============================================
// TYPES
// ============================================
type ToastType = "success" | "error" | "warning";

function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void; }) {
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
            style={{ animation: "slideIn 0.3s ease-out" }}
        >
            <span className="text-lg">{icons[type]}</span>
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 text-white/70 hover:text-white text-lg leading-none">
                ×
            </button>
        </div>
    );
}
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
    seller_link: string | null;
    seller_phone: string | null;
    payment_method: string | null;
    tracking_details: string | null;
    delivery_date: string | null;
    order_date: string | null;
    product_weight: number | null;
    box_number: string | null;
    box_status: string; // 'unassigned' | 'assigned' | 'sealed'
    booking_date: string | null;
    total_box_weight: number | null;
    moved_from_inbound_at: string | null;
    inbound_tracking_id?: string | null;
    quantity_assigned?: number | null;
    created_at: string | null;
};

type GroupedBox = {
    box_number: string;
    items: BoxProduct[];
    total_items: number;
    total_quantity: number;
    status: string; // determined by items
};

interface BoxTrackingTableProps {
    onCountsChange: () => void;
}

// ============================================
// EDIT BOX MODAL
// ============================================
function EditBoxModal({ open, boxGroup, onClose, onSuccess, showToast }: any) {
    const [boxNum, setBoxNum] = useState("");
    const [bookingDate, setBookingDate] = useState("");
    const [totalWeight, setTotalWeight] = useState<number | "">("");
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [saving, setSaving] = useState(false);

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
        }
    }, [boxGroup]);

    if (!open || !boxGroup) return null;

    const activeItems = boxGroup.items.filter((i: any) => (quantities[i.id] ?? 0) > 0);

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
                    await supabase.from('india_inbound_boxes').delete().eq('id', item.id);
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
                        await supabase.from('india_inbound_tracking').update({
                            assigned_quantity: Math.max(0, (trackData.assigned_quantity || 0) + delta),
                            pending_quantity: Math.max(0, (trackData.pending_quantity || 0) - delta)
                        }).eq('id', trackingId);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] mx-2 sm:mx-0">
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-base sm:text-xl font-bold text-white">✏️ Edit Box Details</h2>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">Modify box metadata or item quantities. Removed items will return to the Inbound queue.</p>
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
                        <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Total Weight (kg)</label>
                        <input type="number" step="0.01" value={totalWeight} onChange={e => setTotalWeight(e.target.value ? Number(e.target.value) : "")} className="w-32 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-indigo-500 focus:outline-none" />
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-3 sm:p-5">
                    {activeItems.length === 0 ? (
                        <div className="text-center py-10 text-rose-400 font-medium">All items removed. Saving will delete the box entirely.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-400">
                                <tr>
                                    <th className="px-3 py-2 text-left">ASIN</th>
                                    <th className="px-3 py-2 text-left">Product</th>
                                    <th className="px-3 py-2 text-center">Box Qty</th>
                                    <th className="px-3 py-2 text-center">Weight (kg)</th>
                                    <th className="px-3 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {boxGroup.items.map((item: any) => {
                                    if ((quantities[item.id] ?? 0) <= 0) return null;
                                    const trackingPending = item.pending_quantity ?? 0;
                                    const currentBoxQty = item.quantity_assigned ?? 0;
                                    const maxAllowed = currentBoxQty + trackingPending;

                                    return (
                                        <tr key={item.id} className="hover:bg-slate-800/40">
                                            <td className="px-3 py-3 font-mono text-slate-200">
                                                <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1">
                                                    {item.asin} <span className="text-[10px]">↗</span>
                                                </a>
                                            </td>
                                            <td className="px-3 py-3 text-slate-300 truncate max-w-[200px]">{item.product_name || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <input type="number" min={0} max={maxAllowed} value={quantities[item.id] ?? 0}
                                                    onChange={e => setQuantities(prev => ({ ...prev, [item.id]: Math.min(Number(e.target.value) || 0, maxAllowed) }))}
                                                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-white" />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <input type="number" min={0} step={0.01} value={weights[item.id] ?? 0}
                                                    onChange={e => setWeights(prev => ({ ...prev, [item.id]: Number(e.target.value) || 0 }))}
                                                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-white" />
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                <button onClick={() => setQuantities(prev => ({ ...prev, [item.id]: 0 }))} className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-1 rounded bg-rose-400/10">✕ Remove</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/30">
                    <button onClick={onClose} className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2">
                        {saving ? "Saving..." : "💾 Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================
// COMPONENT
// ============================================
export default function BoxTrackingTable({ onCountsChange }: BoxTrackingTableProps) {
    const [products, setProducts] = useState<BoxProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [moving, setMoving] = useState(false);

    // Box assignment
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [boxInput, setBoxInput] = useState('');

    // Expanded boxes in group view
    const [expandedBoxes, setExpandedBoxes] = useState<Set<string>>(new Set());

    // View mode
    const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
    const [rollbackOpen, setRollbackOpen] = useState(false);
    const [editBoxData, setEditBoxData] = useState<GroupedBox | null>(null);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const showToast = useCallback((message: string, type: ToastType) => {
        setToast({ message, type });
    }, []);

    // ============================================
    // FETCH
    // ============================================
    const fetchProducts = async () => {
        try {
            setLoading(true);
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('india_inbound_boxes')
                    .select('*')
                    .order('created_at', { ascending: false })
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
            console.error('Error fetching box products:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshSilently = async () => {
        try {
            const { data, error } = await supabase
                .from('india_inbound_boxes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error refreshing box products:', error);
        }
    };

    // ============================================
    // REALTIME
    // ============================================
    useEffect(() => {
        fetchProducts();

        const channel = supabase
            .channel('box-tracking-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'india_inbound_boxes',
            }, () => {
                refreshSilently();
                onCountsChange();
            })
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, []);

    // ============================================
    // ASSIGN BOX NUMBER
    // ============================================
    const handleAssignBox = async (productId: string) => {
        if (!boxInput.trim()) return;

        try {
            const { error } = await supabase
                .from('india_inbound_boxes')
                .update({
                    box_number: boxInput.trim().toUpperCase(),
                    box_status: 'assigned',
                })
                .eq('id', productId);

            if (error) throw error;

            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? { ...p, box_number: boxInput.trim().toUpperCase(), box_status: 'assigned' }
                    : p
            ));
            setAssigningId(null);
            setBoxInput('');
        } catch (error) {
            console.error('Error assigning box:', error);
        }
    };

    // Bulk assign: assign multiple unassigned items to a box
    const handleBulkAssign = async (ids: string[], boxNum: string) => {
        try {
            const { error } = await supabase
                .from('india_inbound_boxes')
                .update({
                    box_number: boxNum.trim().toUpperCase(),
                    box_status: 'assigned',
                })
                .in('id', ids);

            if (error) throw error;
            await refreshSilently();
        } catch (error) {
            console.error('Error bulk assigning:', error);
        }
    };

    // ============================================
    // MOVE TO INBOUND
    // ============================================
    const handleMoveToInbound = async (item: BoxProduct) => {
        if (!confirm(`Move "${item.asin}" back to Inbound Tracking?`)) return;

        try {
            // 1. Insert into india_inbound_tracking
            const { error: insertError } = await supabase
                .from('india_inbound_tracking')
                .insert({
                    asin: item.asin,
                    journey_id: item.journey_id,
                    product_name: item.product_name,
                    brand: item.brand,
                    sku: item.sku,
                    seller_tag: item.seller_tag,
                    funnel: item.funnel,
                    origin: item.origin,
                    origin_india: item.origin_india,
                    origin_china: item.origin_china,
                    origin_us: item.origin_us,
                    product_link: item.product_link,
                    inr_purchase_link: item.inr_purchase_link,
                    usd_price: item.usd_price,
                    inr_purchase: item.inr_purchase,
                    target_price: item.target_price,
                    admin_target_price: item.admin_target_price,
                    target_quantity: item.target_quantity,
                    funnel_quantity: item.funnel_quantity,
                    funnel_seller: item.funnel_seller,
                    buying_price: item.buying_price,
                    buying_quantity: item.buying_quantity,
                    pending_quantity: item.buying_quantity,
                    seller_link: item.seller_link,
                    seller_phone: item.seller_phone,
                    payment_method: item.payment_method,
                    tracking_details: item.tracking_details,
                    delivery_date: item.delivery_date,
                    order_date: item.order_date,
                    product_weight: item.product_weight,
                    status: 'pending',
                });

            if (insertError) throw insertError;

            // 2. Delete from india_inbound_boxes
            const { error: deleteError } = await supabase
                .from('india_inbound_boxes')
                .delete()
                .eq('id', item.id);

            if (deleteError) throw deleteError;

            // 3. Refresh
            await refreshSilently();
            onCountsChange();
        } catch (error: any) {
            console.error('Error moving to inbound:', error);
            alert(`Failed: ${error.message}`);
        }
    };

    // ============================================
    // MOVE TO CHECKING
    // ============================================
    const handleMoveToChecking = async (boxNumber: string) => {
        const boxItems = products.filter(p => p.box_number === boxNumber);
        if (boxItems.length === 0) return;

        if (!confirm(`Move box "${boxNumber}" (${boxItems.length} items) to Checking?`)) return;

        setMoving(true);
        try {
            // 1. Prepare data for checking table
            const dataToInsert = boxItems.map(p => ({
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
                seller_link: p.seller_link,
                seller_phone: p.seller_phone,
                payment_method: p.payment_method,
                tracking_details: p.tracking_details,
                delivery_date: p.delivery_date,
                order_date: p.order_date,
                product_weight: p.product_weight,
                box_number: p.box_number,
                check_status: 'pending',
                moved_from_boxes_at: new Date().toISOString(),
            }));

            // 2. Insert into checking table
            const { error: insertError } = await supabase
                .from('india_box_checking')
                .insert(dataToInsert);

            if (insertError) throw insertError;

            // 3. Delete from boxes table
            const ids = boxItems.map(p => p.id);
            const { error: deleteError } = await supabase
                .from('india_inbound_boxes')
                .delete()
                .in('id', ids);

            if (deleteError) throw deleteError;

            // 4. Refresh
            await refreshSilently();
            onCountsChange();
            alert(`✅ Box "${boxNumber}" (${boxItems.length} items) moved to Checking!`);
        } catch (error: any) {
            console.error('Error moving to checking:', error);
            alert(`Failed: ${error.message}`);
        } finally {
            setMoving(false);
        }
    };

    // ============================================
    // DELETE BOX
    // ============================================
    const handleDeleteBox = async (boxNumber: string) => {
        const boxItems = products.filter(p => p.box_number === boxNumber);
        if (boxItems.length === 0) return;

        if (!confirm(`Delete box "${boxNumber}" and return ${boxItems.length} items to Inbound?`)) return;

        try {
            const { data: rows, error: fetchError } = await supabase.from("india_inbound_boxes").select("id, inbound_tracking_id, asin, quantity_assigned").eq("box_number", boxNumber);
            if (fetchError) throw fetchError;
            if (!rows || rows.length === 0) return;

            for (const row of rows as any[]) {
                const qty = row.quantity_assigned ?? 0;
                if (qty <= 0) continue;
                const inboundId = row.inbound_tracking_id ?? null;
                if (!inboundId) continue;

                const { data } = await supabase.from("india_inbound_tracking").select("id, assigned_quantity, pending_quantity").eq("id", inboundId).limit(1);
                if (data && data[0]) {
                    await supabase.from("india_inbound_tracking").update({
                        assigned_quantity: Math.max(0, (data[0].assigned_quantity ?? 0) - qty),
                        pending_quantity: (data[0].pending_quantity ?? 0) + qty,
                    }).eq("id", data[0].id);
                }
            }

            const boxIds = (rows as any[]).map(r => r.id);
            const { error: deleteError } = await supabase.from("india_inbound_boxes").delete().in("id", boxIds);
            if (deleteError) throw deleteError;

            await refreshSilently();
            onCountsChange();
            showToast(`Box ${boxNumber} deleted successfully!`, "success");
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Failed to delete box.", "error");
        }
    };

    // ============================================
    // FILTERING
    // ============================================
    const filteredProducts = products.filter(p => {
        return !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.box_number?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // ============================================
    // GROUPED VIEW
    // ============================================
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

    // ============================================
    // STATUS COLORS
    // ============================================
    const statusColors: Record<string, string> = {
        assigned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };

    const statusIcons: Record<string, string> = {
        assigned: '📦',
    };

    const SELLER_TAG_COLORS: Record<string, string> = {
        GR: 'bg-yellow-400 text-black',
        RR: 'bg-gray-400 text-black',
        UB: 'bg-pink-500 text-white',
        VV: 'bg-purple-600 text-white',
        DE: 'bg-orange-500 text-white',
        CV: 'bg-green-600 text-white',
    };

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

    // ============================================
    // LOADING
    // ============================================
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-slate-400">Loading boxes...</div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="h-full flex flex-col relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <EditBoxModal open={!!editBoxData} boxGroup={editBoxData} onClose={() => setEditBoxData(null)} onSuccess={() => { setEditBoxData(null); refreshSilently(); onCountsChange(); }} showToast={showToast} />
            {/* Toolbar */}
            <div className="flex-none pt-3 sm:pt-5 pb-3 sm:pb-4 flex gap-2 sm:gap-4 items-center flex-wrap">
                {/* Search */}
                <input
                    type="text"
                    placeholder="Search by ASIN, Name, SKU, or Box Number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 max-w-md px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-500 text-sm"
                />

                {/* View Toggle */}
                <div className="flex items-center bg-slate-800/50 rounded-xl border border-slate-700 p-1">
                    <button
                        onClick={() => setViewMode('grouped')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'grouped' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        📦 Grouped
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        📋 List
                    </button>
                </div>

                {/* Divider */}
                <div className="h-8 w-px bg-slate-700" />

                {/* ⏪ Rollback from Checking */}
                <button
                    onClick={() => setRollbackOpen(true)}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2"
                >
                    <span className="hidden sm:inline">⏪ Rollback from Checking</span><span className="sm:hidden">⏪ Rollback</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <div className="bg-slate-900 rounded-lg border border-slate-800 h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto">

                        {/* GROUPED VIEW */}
                        {viewMode === 'grouped' && (
                            <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
                                {groupedBoxes.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        No items in boxes yet. Move delivered items from Inbound tab.
                                    </div>
                                ) : (
                                    groupedBoxes.map(group => {
                                        const isExpanded = expandedBoxes.has(group.box_number);
                                        const isUnassigned = group.box_number === 'UNASSIGNED';

                                        return (
                                            <div
                                                key={group.box_number}
                                                className="border rounded-xl overflow-hidden transition-all border-blue-500/30 bg-blue-500/5"
                                            >
                                                {/* Box Header */}
                                                <div
                                                    className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 cursor-pointer hover:bg-slate-800/30 transition-colors flex-wrap gap-2"
                                                    onClick={() => toggleExpand(group.box_number)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {/* Expand Icon */}
                                                        <svg
                                                            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>

                                                        {/* Box Icon + Name */}
                                                        <span className="text-xl">📦</span>
                                                        <div className="flex flex-col">
                                                            <span className="font-extrabold text-sm sm:text-lg text-white tracking-wide">
                                                                {isUnassigned ? '📋 Unassigned Items' : group.box_number}
                                                            </span>
                                                            {/* ✅ UI FIX: Shows Booking and Saved Dates */}
                                                            {group.items.length > 0 && (
                                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-medium">
                                                                    <span className="bg-slate-800 px-2 py-0.5 rounded whitespace-nowrap">📅 Booked: <span className="text-slate-200">{group.items[0]?.booking_date ? new Date(group.items[0].booking_date).toLocaleDateString('en-IN') : 'N/A'}</span></span>
                                                                    <span className="bg-slate-800 px-2 py-0.5 rounded whitespace-nowrap">🕒 Saved: <span className="text-slate-200">{new Date(group.items[0]?.created_at || Date.now()).toLocaleString('en-IN')}</span></span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Status Badge */}
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ml-1 sm:ml-4 ${statusColors[group.status]}`}>
                                                            {group.status.toUpperCase()}
                                                        </span>

                                                        {/* Item Count */}
                                                        <span className="text-xs sm:text-sm text-slate-300 font-medium bg-slate-900 px-2 sm:px-3 py-1 rounded-lg border border-slate-800 ml-1 sm:ml-2">
                                                            {new Set(group.items.map(i => i.asin)).size} ASINs · {group.total_quantity} qty
                                                        </span>
                                                    </div>

                                                    {/* Box Actions */}
                                                    <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => setEditBoxData(group)} className="px-2 sm:px-4 py-1.5 sm:py-2 bg-sky-600/20 text-sky-400 border border-sky-500/30 rounded-lg text-xs font-bold hover:bg-sky-600 hover:text-white transition-all shadow">
                                                            ✏️ Edit Box
                                                        </button>

                                                        <button
                                                            disabled={moving}
                                                            onClick={() => handleMoveToChecking(group.box_number)}
                                                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all disabled:opacity-50 shadow"
                                                        >
                                                            {moving ? '⏳ Moving...' : '✅ Move to Checking'}
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeleteBox(group.box_number)}
                                                            className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all shadow"
                                                        >
                                                            🗑 Delete
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expanded Items */}
                                                {isExpanded && (
                                                    <div className="border-t border-slate-800 overflow-x-auto">
                                                        <table className="w-full" style={{ tableLayout: 'fixed' }}>
                                                            <colgroup>
                                                                <col style={{ width: '12%' }} />   {/* ASIN */}
                                                                <col style={{ width: '10%' }} /> {/* SKU - new */}
                                                                <col style={{ width: '15%' }} />   {/* Product Name */}
                                                                <col style={{ width: '7%' }} />    {/* Funnel */}
                                                                <col style={{ width: '8%' }} />    {/* Seller Tag */}
                                                                <col style={{ width: '6%' }} />    {/* Origin */}
                                                                <col style={{ width: '5%' }} />    {/* Qty */}
                                                                <col style={{ width: '8%' }} />    {/* Price */}
                                                            </colgroup>
                                                            <thead className="bg-slate-950/50">
                                                                <tr>
                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase">ASIN</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">
                                                                        SKU
                                                                    </th>
                                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase">Product Name</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">Funnel</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">Seller Tag</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">Origin</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">Qty</th>
                                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase">Price</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/50">
                                                                {mergeBoxItems(group.items).map((merged, idx) => {
                                                                    const item = merged.representative;
                                                                    const totalQty = merged.sellers.reduce((s, x) => s + x.qty, 0);
                                                                    return (
                                                                        <tr key={item.asin + '-' + idx} className="hover:bg-slate-800/30 transition-colors">
                                                                            <td className="px-3 py-2 font-mono text-sm text-slate-300">
                                                                                <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1 w-fit">
                                                                                    {item.asin} <span className="text-[10px]">↗</span>
                                                                                </a>
                                                                            </td>
                                                                            <td className="px-3 py-2 font-mono text-sm text-slate-400">
                                                                                <div className="truncate max-w-[100px]" title={item.sku || '-'}>
                                                                                    {item.sku || '-'}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-sm text-slate-200">
                                                                                <div className="truncate max-w-[200px]" title={item.product_name || ''}>{item.product_name || '-'}</div>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-center">
                                                                                {(() => {
                                                                                    const { display, color } = getFunnelBadgeStyle(item.funnel);
                                                                                    return display === '-'
                                                                                        ? <span className="text-slate-600">-</span>
                                                                                        : <span className={`px-2 py-1 rounded-lg text-xs font-bold ${color}`}>{display}</span>;
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
                                                                                    {item.origin_india && <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold">IN</span>}
                                                                                    {item.origin_china && <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold">CN</span>}
                                                                                    {item.origin_us && <span className="px-1.5 py-0.5 bg-sky-500 text-white rounded text-[10px] font-bold">US</span>}
                                                                                    {!item.origin_india && !item.origin_china && !item.origin_us && <span className="text-slate-600">-</span>}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-2 text-sm text-slate-300 text-center font-bold">
                                                                                {totalQty}
                                                                            </td>
                                                                            <td className="px-3 py-2 text-sm text-slate-300 text-center">
                                                                                {item.buying_price ? `₹${item.buying_price}` : '-'}
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
                        {viewMode === 'list' && (
                            <table className="w-full divide-y divide-slate-800" style={{ minWidth: '1200px' }}>
                                <thead className="bg-slate-950 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">ASIN</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                                            SKU
                                        </th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Product Name</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Funnel</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Seller Tag</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Qty</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Price</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">Box Number</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Box Number</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                                                No items in boxes yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                                                <td className="px-3 py-2 font-mono text-sm text-slate-300 border-r border-slate-800/50">
                                                    <a href={p.product_link || `https://www.amazon.in/dp/${p.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1 w-fit truncate max-w-[120px]">
                                                        {p.asin} <span className="text-[10px]">↗</span>
                                                    </a>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-sm text-slate-400 border-r border-slate-800/50">
                                                    <div className="truncate max-w-[100px]">{p.sku || '-'}</div>
                                                </td>
                                                <td className="px-3 py-2 text-sm text-slate-200 border-r border-slate-800/50">
                                                    <div className="truncate max-w-[200px]">{p.product_name || '-'}</div>
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-slate-800/50 text-sm">
                                                    {(() => {
                                                        const { display, color } = getFunnelBadgeStyle(p.funnel);
                                                        return display === '-'
                                                            ? <span className="text-slate-600">-</span>
                                                            : <span className={`px-2 py-1 rounded-lg text-xs font-bold ${color}`}>{display}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-slate-800/50 text-sm">
                                                    {p.seller_tag || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-slate-800/50 text-sm text-slate-300">
                                                    {p.buying_quantity || '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center border-r border-slate-800/50 text-sm text-slate-300">
                                                    {p.buying_price ? `₹${p.buying_price}` : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold">
                                                        {p.box_number}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex-none border-t border-slate-800 bg-slate-950 px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs sm:text-sm text-slate-400">
                            <span>
                                {filteredProducts.length} items · {groupedBoxes.length} boxes
                            </span>
                            <div className="flex gap-4">
                                <span className="text-blue-400 font-semibold">📦 {products.length} Assigned items</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* ⏪ Rollback Modal: Checking → Boxes */}
            <GenericRollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                onSuccess={() => { refreshSilently(); onCountsChange(); }}
                direction="CHECKING_TO_BOXES"
                sellerId={0}
                sellerTag=""
                sourceTableName="india_box_checking"
                targetTableName="india_inbound_boxes"
            />
        </div>
    );
}