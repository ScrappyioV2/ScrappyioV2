// FILE: components/india-selling/GenericRollbackModal.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Undo2, Search } from 'lucide-react';

// ─── ROLLBACK DIRECTION CONFIG ───
// Each tab pulls items BACK from the next stage
//
// Inbound  ← pulls from Boxes           (india_inbound_boxes)
// Boxes    ← pulls from Checking         (india_checking_seller_X / india_box_checking)
// Checking ← pulls from Restock     (india_seller_distribution)
// Restock ← pulls from Restock      (india_restock_seller_X)

export type RollbackDirection =
    | 'BOXES_TO_INBOUND'
    | 'CHECKING_TO_BOXES'
    | 'DISTRIBUTION_TO_CHECKING'
    | 'RESTOCK_TO_DISTRIBUTION'
    | 'LISTING_ERROR_TO_CHECKING';

interface RollbackItem {
    id: string;
    asin: string;
    product_name?: string | null;
    seller_tag?: string | null;
    buying_price?: number | null;
    buying_quantity?: number | null;
    box_number?: string | null;
    invoice_number?: string | null;
    status?: string | null;
    created_at?: string | null;
    [key: string]: any;
}

interface GenericRollbackModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    direction: RollbackDirection;
    sellerId: number;
    sellerTag: string;
    sourceTableName: string;
    targetTableName: string;

    // Optional: when the source lives in the unified `tracking_ops` table,
    // pass these filters so fetch/delete queries are scoped correctly.
    sourceMarketplace?: string;
    sourceSellerId?: number;
    sourceOpsType?: string;

    // ✅ NEW
    overrideLabel?: {
        label?: string;
        sourceLabel?: string;
        targetLabel?: string;
    };
}

// Field mappings: what to copy when rolling back
const getFieldMapping = (direction: RollbackDirection) => {
    switch (direction) {
        case 'BOXES_TO_INBOUND':
            return {
                label: 'Checking → Inbound',
                sourceLabel: 'Checking',
                targetLabel: 'Inbound',
                mapFields: (item: any) => ({
                    asin: item.asin ?? null,
                    journey_id: item.journey_id ?? null,
                    product_name: item.product_name ?? null,
                    brand: item.brand ?? null,
                    sku: item.sku ?? null,
                    seller_tag: item.seller_tag ?? null,
                    funnel: item.funnel ?? null,
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
                    funnel_quantity: item.funnel_quantity ?? null,
                    funnel_seller: item.funnel_seller ?? null,
                    buying_price: item.buying_price ?? null,
                    buying_quantity: item.actual_quantity ?? item.buying_quantity ?? null,
                    pending_quantity: item.actual_quantity ?? item.buying_quantity ?? null,
                    assigned_quantity: 0,
                    seller_link: item.seller_link ?? null,
                    seller_phone: item.seller_phone ?? null,
                    payment_method: item.payment_method ?? null,
                    tracking_details: item.tracking_details ?? null,
                    delivery_date: item.delivery_date ?? null,
                    order_date: item.order_date ?? null,
                    product_weight: item.product_weight ?? null,
                    status: 'delivered',
                    address: item.address ?? null,
                }),
            };
        case 'CHECKING_TO_BOXES':
            return {
                label: 'Checking → Boxes',
                sourceLabel: 'Checking',
                targetLabel: 'Boxes',
                mapFields: (item: any) => ({
                    asin: item.asin ?? null,
                    journey_id: item.journey_id ?? null,
                    product_name: item.product_name ?? null,
                    brand: item.brand ?? null,
                    sku: item.sku ?? null,
                    seller_tag: item.seller_tag ?? null,
                    funnel: item.funnel ?? null,
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
                    funnel_quantity: item.funnel_quantity ?? null,
                    funnel_seller: item.funnel_seller ?? null,
                    buying_price: item.buying_price ?? null,
                    buying_quantity: item.buying_quantity ?? null,
                    quantity_assigned: item.actual_quantity ?? item.good_quantity ?? item.buying_quantity ?? null,
                    ordered_quantity: item.expected_quantity ?? item.buying_quantity ?? null,
                    seller_link: item.seller_link ?? null,
                    seller_phone: item.seller_phone ?? null,
                    payment_method: item.payment_method ?? null,
                    tracking_details: item.tracking_details ?? null,
                    delivery_date: item.delivery_date ?? null,
                    order_date: item.order_date ?? null,
                    product_weight: item.product_weight ?? null,
                    box_number: item.box_number ?? null,
                    box_status: 'sealed',
                    total_box_weight: item.total_box_weight ?? null,
                    inbound_tracking_id: item.inbound_tracking_id ?? null,
                }),
            };
        case 'DISTRIBUTION_TO_CHECKING':
            return {
                label: 'Restock → Checking',
                sourceLabel: 'Restock',
                targetLabel: 'Checking',
                mapFields: (item: any) => ({
                    // core identity
                    box_id: item.box_id ?? null,
                    inbound_tracking_id: item.inbound_tracking_id ?? null,
                    inbound_box_id: item.inbound_box_id ?? null,
                    shipment_id: item.shipment_id ?? null,

                    // product
                    sku: item.sku ?? null,
                    asin: item.asin ?? null,
                    product_name: item.product_name ?? null,
                    brand: item.brand ?? null,
                    journey_id: item.journey_id ?? null,

                    // quantities mapped from distribution/restock side
                    // If your source has `good_quantity` / `damaged_quantity`, map them directly
                    expected_quantity: item.expected_quantity ?? item.buying_quantity ?? 0,
                    actual_quantity: item.actual_quantity ?? item.good_quantity ?? item.buying_quantity ?? 0,
                    damaged_quantity: item.damaged_quantity ?? 0,
                    good_quantity:
                        item.good_quantity ??
                        Math.max(
                            (item.buying_quantity ?? item.actual_quantity ?? 0) -
                            (item.damaged_quantity ?? 0),
                            0,
                        ),

                    // status and check meta
                    status: item.status ?? 'pending',
                    checked_by: item.checked_by ?? null,
                    checked_at: item.checked_at ?? null,
                    notes: item.notes ?? null,
                    box_number: item.box_number ?? null,
                    check_status: 'pending',
                    check_brand: item.check_brand ?? false,
                    check_item_expire: item.check_item_expire ?? false,
                    check_small_size: item.check_small_size ?? false,
                    check_multi_seller: item.check_multi_seller ?? false,
                    check_notes: item.check_notes ?? null,

                    moved_from_boxes_at: item.moved_from_boxes_at ?? null,

                    // funnel / origin info
                    funnel: item.funnel ?? null,
                    origin: item.origin ?? null,
                    origin_india: item.origin_india ?? false,
                    origin_china: item.origin_china ?? false,
                    origin_us: item.origin_us ?? false,
                    inr_purchase_link: item.inr_purchase_link ?? null,
                    usd_price: item.usd_price ?? null,
                    inr_purchase: item.inr_purchase ?? null,
                    target_price: item.target_price ?? null,
                    admin_target_price: item.admin_target_price ?? null,
                    target_quantity: item.target_quantity ?? null,
                    funnel_quantity: item.funnel_quantity ?? null,
                    funnel_seller: item.funnel_seller ?? null,

                    // seller / payment
                    seller_link: item.seller_link ?? null,
                    seller_phone: item.seller_phone ?? null,
                    payment_method: item.payment_method ?? null,
                    order_date: item.order_date ?? null,

                    // extra product details
                    product_weight: item.product_weight ?? null,
                    seller_tag: item.seller_tag ?? null,
                    buying_price: item.buying_price ?? null,
                    buying_quantity: item.buying_quantity ?? null,
                    tracking_details: item.tracking_details ?? null,
                    delivery_date: item.delivery_date ?? null,
                    product_link: item.product_link ?? null,
                    good_condition: item.good_condition ?? false,
                    check_mrp_label: item.check_mrp_label ?? null,
                    check_gelatin: item.check_gelatin ?? null,
                    check_amazon_badge: item.check_amazon_badge ?? null,
                    check_cleaning: item.check_cleaning ?? null,
                }),
            };
        case 'RESTOCK_TO_DISTRIBUTION':
            return {
                label: 'Restock → Restock',
                sourceLabel: 'Restock',
                targetLabel: 'Restock',
                mapFields: (item: any) => {
                    // Strip both legacy per-seller table fields and unified tracking_ops fields
                    const {
                        id,
                        status,
                        moved_at,
                        distribution_id,
                        created_at,
                        marketplace,
                        seller_id,
                        ops_type,
                        ...rest
                    } = item;
                    return {
                        ...rest,
                        distribution_status: 'completed',
                    };
                },
            };
        case 'LISTING_ERROR_TO_CHECKING':
            return {
                label: 'Listing Errors → Checking',
                sourceLabel: 'Listing Errors',
                targetLabel: 'Checking',
                mapFields: (item: any) => ({
                    asin: item.asin ?? null,
                    product_name: item.product_name ?? null,
                    sku: item.sku ?? null,
                    seller_tag: item.seller_tag ?? null,
                }),
            };
    }
};

export default function GenericRollbackModal({
    open,
    onClose,
    onSuccess,
    direction,
    sellerId,
    sellerTag,
    sourceTableName,
    targetTableName,
    sourceMarketplace,
    sourceSellerId,
    sourceOpsType,
    overrideLabel,        // ✅ add this
}: GenericRollbackModalProps) {
    const [items, setItems] = useState<RollbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const config = getFieldMapping(direction);

    const effectiveConfig = {
        ...config,
        ...(overrideLabel || {}),
        sourceLabel: overrideLabel?.sourceLabel ?? config.sourceLabel,
        targetLabel: overrideLabel?.targetLabel ?? config.targetLabel,
    };

    // ─── FETCH items from the SOURCE (next-stage) table ───
    useEffect(() => {
        if (open) fetchItems();
    }, [open]);

    const fetchItems = async () => {
        try {
            setLoading(true);
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const useTrackingOps = !!(sourceMarketplace && sourceOpsType);
                let query = supabase
                    .from(useTrackingOps ? 'tracking_ops' : sourceTableName)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1);

                if (useTrackingOps) {
                    query = query.eq('marketplace', sourceMarketplace!).eq('ops_type', sourceOpsType!);
                    if (sourceSellerId !== undefined) {
                        query = query.eq('seller_id', sourceSellerId);
                    }
                }

                // For single-table sources, filter by seller tag
                if (direction === 'DISTRIBUTION_TO_CHECKING' && sellerTag) {
                    query = query.or(
                        `distributed_to_seller.ilike.%${sellerTag}%,seller_tag.ilike.%${sellerTag}%`
                    );
                }

                if (direction === 'BOXES_TO_INBOUND' && sellerTag) {
                    query = query.ilike('seller_tag', `%${sellerTag}%`);
                }

                const { data, error } = await query;
                if (error) throw error;
                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    from += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            setItems(allData);
        } catch (error) {
            console.error('Error fetching rollback items:', error);
        } finally {
            setLoading(false);
        }
    };

    // ─── FILTER ───
    const filteredItems = items.filter(item => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.asin?.toLowerCase().includes(q) ||
            item.product_name?.toLowerCase().includes(q) ||
            item.box_number?.toLowerCase().includes(q) ||
            item.invoice_number?.toLowerCase().includes(q)
        );
    });

    // ─── SELECT ───
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredItems.map(i => i.id)));
        else setSelectedIds(new Set());
    };

    const handleSelect = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id); else newSet.delete(id);
        setSelectedIds(newSet);
    };

    // ─── ROLLBACK ───
    const handleRollback = async () => {
        if (selectedIds.size === 0) return;
        if (
            !confirm(
                `Rollback ${selectedIds.size} item(s) from ${effectiveConfig.sourceLabel} → ${effectiveConfig.targetLabel}?`
            )
        ) return;

        try {
            setProcessing(true);
            const selectedItems = items.filter(i => selectedIds.has(i.id));

            // 1. Map fields for the target table
            const dataToInsert = selectedItems.map(config.mapFields);

            // 2. Check for duplicate ASINs in target (optional safety)
            const asins = selectedItems.map(i => i.asin);
            const { data: existing } = await supabase
                .from(targetTableName)
                .select('asin')
                .in('asin', asins);

            const existingSet = new Set(existing?.map(e => e.asin) || []);
            const uniqueData = dataToInsert.filter((_, idx) => !existingSet.has(selectedItems[idx].asin));
            const duplicateCount = dataToInsert.length - uniqueData.length;

            // 3. Insert into target table
            if (uniqueData.length > 0) {
                const { error: insertError } = await supabase
                    .from(targetTableName)
                    .insert(uniqueData);
                if (insertError) throw insertError;
            }

            // 4. Delete from source table (or tracking_ops when filters provided)
            const useTrackingOps = !!(sourceMarketplace && sourceOpsType);
            const { error: deleteError } = await supabase
                .from(useTrackingOps ? 'tracking_ops' : sourceTableName)
                .delete()
                .in('id', Array.from(selectedIds));
            if (deleteError) throw deleteError;

            const msg = duplicateCount > 0
                ? `Rolled back ${uniqueData.length} items (${duplicateCount} duplicates skipped)`
                : `Rolled back ${uniqueData.length} items!`;

            setToast({ message: msg, type: 'success' });
            setSelectedIds(new Set());
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (error: any) {
            console.error('Rollback error:', error);
            setToast({ message: `Failed: ${error.message}`, type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-[#111111] border-b border-white/[0.1] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Undo2 className="w-6 h-6 text-amber-400" />
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                Rollback: {effectiveConfig.label}
                            </h2>
                            <p className="text-sm text-gray-400">
                                Select items from <span className="text-amber-400 font-semibold">{effectiveConfig.sourceLabel}</span>
                                {' '}to move back to{' '}
                                <span className="text-emerald-400 font-semibold">{effectiveConfig.targetLabel}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-[#111111] rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-4 border-b border-white/[0.1]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by ASIN, Product Name, Box, Invoice..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50 text-gray-100 placeholder:text-gray-500 transition-all"
                        />
                    </div>
                </div>

                {/* Item List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-400">
                                Loading items from {effectiveConfig.sourceLabel}...
                            </div>
                            ...
                            <div className="text-lg text-gray-500">
                                No items found in {effectiveConfig.sourceLabel}
                            </div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-500">No items found in {effectiveConfig.sourceLabel}</div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left w-12">
                                        <input
                                            type="checkbox"
                                            checked={filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id))}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-5 h-5 cursor-pointer accent-indigo-600"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">ASIN</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Product Name</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Seller</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Price</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Qty</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Box / Invoice</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredItems.map(item => (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-white/[0.05] cursor-pointer transition-colors"
                                        onClick={() => handleSelect(item.id, !selectedIds.has(item.id))}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={(e) => { e.stopPropagation(); handleSelect(item.id, e.target.checked); }}
                                                className="w-5 h-5 cursor-pointer accent-indigo-600"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm text-gray-100">{item.asin}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            <div className="truncate max-w-[250px]">{item.product_name || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-400">{item.seller_tag || '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                                            {item.buying_price ? `₹${item.buying_price}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-500">{item.buying_quantity || '-'}</td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-400">
                                            {item.box_number || item.invoice_number || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-[#111111] border-t border-white/[0.1] px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                        {selectedIds.size > 0 && (
                            <span className="font-semibold text-amber-400">{selectedIds.size} item(s) selected</span>
                        )}
                        {selectedIds.size === 0 && `${filteredItems.length} items available`}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={processing}
                            className="px-6 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-500 hover:bg-[#1a1a1a] hover:text-white transition-all font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRollback}
                            disabled={selectedIds.size === 0 || processing}
                            className={`px-8 py-2.5 rounded-lg font-semibold text-white transition-all shadow-lg ${selectedIds.size === 0 || processing
                                ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                : 'bg-amber-600 hover:bg-amber-500 hover:shadow-amber-500/50'
                                }`}
                        >
                            {processing ? 'Processing...' : `⏪ Rollback ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                        </button>
                    </div>
                </div>

                {/* Toast */}
                {toast && (
                    <div className="fixed top-6 right-6 z-[100] animate-slide-in">
                        <div className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'
                            }`}>
                            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                            <span className="font-semibold flex-1">{toast.message}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
