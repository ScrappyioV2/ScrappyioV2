'use client';
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { getFunnelBadgeStyle } from '@/lib/utils';
import { SELLER_TAG_MAPPING, SellerTag } from '@/lib/utils';
import GenericRollbackModal from '@/components/dropy/GenericRollbackModal';

// ============================================
// TYPES
// ============================================
type DistributionProduct = {
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
    distribution_status: string; // 'pending' | 'shipped' | 'completed'
    distributed_to_seller: string | null;
    shipped_date: string | null;
    completed_date: string | null;
    notes: string | null;
    moved_from_checking_at: string | null;
    created_at: string | null;
    sns_active?: boolean | null;
};

interface DistributionTableProps {
    sellerId: number;
    onCountsChange: () => void;
}

// Reverse mapping: sellerId → seller tag
const SELLER_ID_TO_TAG: Record<number, string> = {
    1: 'DR',
};

const SELLER_NAMES: Record<string, string> = {
    DROPY: 'Dropy',
};

const SELLER_COLORS: Record<string, string> = {
    GR: 'yellow', RR: 'indigo', UB: 'pink', VV: 'emerald', DE: 'orange', CV: 'green',
    MV: 'orange', KL: 'lime',
};

// ============================================
// COMPONENT
// ============================================
export default function DistributionTable({ sellerId, onCountsChange }: DistributionTableProps) {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [products, setProducts] = useState<DistributionProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'shipped' | 'completed'>('ALL');
    const [updating, setUpdating] = useState(false);
    const [rollbackOpen, setRollbackOpen] = useState(false);

    // Inline editing
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    const sellerTag = SELLER_ID_TO_TAG[sellerId] || 'DR';
    const sellerName = SELLER_NAMES[sellerTag] || sellerTag;

    // ============================================
    // FETCH — filter by seller tag
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
                    .from('dropy_seller_distribution')
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

            // Filter client-side by seller tag (items can have comma-separated tags)
            const filtered = allData.filter(p => {
                const tag = p.distributed_to_seller || p.seller_tag || '';
                return tag.includes(sellerTag);
            });

            setProducts(filtered);
        } catch (error) {
            console.error('Error fetching distribution products:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshSilently = async () => {
        try {
            const { data, error } = await supabase
                .from('dropy_seller_distribution')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const filtered = (data || []).filter(p => {
                const tag = p.distributed_to_seller || p.seller_tag || '';
                return tag.includes(sellerTag);
            });

            setProducts(filtered);
        } catch (error) {
            console.error('Error refreshing distribution:', error);
        }
    };

    // ============================================
    // REALTIME
    // ============================================
    useEffect(() => {
        fetchProducts();

        const channel = supabase
            .channel(`distribution-${sellerTag}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'dropy_seller_distribution',
            }, () => {
                refreshSilently();
                onCountsChange();
            })
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, [sellerTag]);

    // ============================================
    // INLINE EDIT
    // ============================================
    const startEditing = (id: string, field: string, currentValue: string) => {
        setEditingCell({ id, field });
        setEditValue(currentValue || '');
    };

    const saveEdit = async () => {
        if (!editingCell) return;
        try {
            const { error } = await supabase
                .from('dropy_seller_distribution')
                .update({ [editingCell.field]: editValue || null })
                .eq('id', editingCell.id);

            if (error) throw error;
            setProducts(prev => prev.map(p =>
                p.id === editingCell.id ? { ...p, [editingCell.field]: editValue || null } : p
            ));
        } catch (error) {
            console.error('Error saving edit:', error);
        } finally {
            setEditingCell(null);
            setEditValue('');
        }
    };

    const cancelEdit = () => { setEditingCell(null); setEditValue(''); };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') cancelEdit();
    };

    // ============================================
    // STATUS CHANGE
    // ============================================
    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const updateData: Record<string, any> = { distribution_status: newStatus };
            if (newStatus === 'shipped') updateData.shipped_date = new Date().toISOString();
            if (newStatus === 'completed') updateData.completed_date = new Date().toISOString();

            const { error } = await supabase
                .from('dropy_seller_distribution')
                .update(updateData)
                .eq('id', id);

            if (error) throw error;
            setProducts(prev => prev.map(p =>
                p.id === id ? { ...p, ...updateData } : p
            ));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    // ============================================
    // BULK STATUS UPDATE
    // ============================================
    const handleBulkStatusUpdate = async (newStatus: string) => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Mark ${selectedIds.size} items as "${newStatus}"?`)) return;

        setUpdating(true);
        try {
            const ids = Array.from(selectedIds);
            const updateData: Record<string, any> = { distribution_status: newStatus };
            if (newStatus === 'shipped') updateData.shipped_date = new Date().toISOString();
            if (newStatus === 'completed') updateData.completed_date = new Date().toISOString();

            const { error } = await supabase
                .from('dropy_seller_distribution')
                .update(updateData)
                .in('id', ids);

            if (error) throw error;

            setSelectedIds(new Set());
            await refreshSilently();
            setToast({ message: `${ids.length} items marked as ${newStatus}!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        } catch (error: any) {
            console.error('Error bulk updating:', error);
            setToast({ message: `Failed: ${error.message}`, type: 'error' }); setTimeout(() => setToast(null), 3000);
        } finally {
            setUpdating(false);
        }
    };

    const handleMoveToRestock = async () => {
        if (selectedIds.size === 0) return;

        const selectedProducts = products.filter(p => selectedIds.has(p.id));
        const nonCompleted = selectedProducts.filter(p => p.distribution_status !== 'completed');

        if (nonCompleted.length > 0) {
            setToast({ message: `${nonCompleted.length} item(s) are not completed. Only completed items can move to Restock.`, type: 'error' }); setTimeout(() => setToast(null), 3000);
            return;
        }

        if (!confirm(`Move ${selectedProducts.length} completed item(s) to Restock?`)) return;

        setUpdating(true);
        try {
            const resolvedSellerId = SELLER_TAG_MAPPING[sellerTag as SellerTag] || sellerId;

            const restockData = selectedProducts.map(p => ({
                marketplace: 'dropy',
                seller_id: resolvedSellerId,
                ops_type: 'restock',
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
                target_price: p.target_price,
                target_quantity: p.target_quantity,
                admin_target_price: p.admin_target_price,
                funnel_quantity: p.funnel_quantity,
                funnel_seller: p.funnel_seller,
                buying_price: p.buying_price,
                buying_quantity: p.buying_quantity,
                seller_link: p.seller_link,
                seller_phone: p.seller_phone,
                payment_method: p.payment_method,
                tracking_details: p.tracking_details,
                delivery_date: p.delivery_date,
                product_weight: p.product_weight,
                box_number: p.box_number,
                notes: p.notes,
                amount: (p.buying_price || 0) * (p.buying_quantity || 0),
                distribution_id: p.id,
                moved_at: new Date().toISOString(),
                status: 'pending',
                sns_active: p.sns_active ?? false,
            }));

            const { error: insertError } = await supabase
                .from('tracking_ops')
                .insert(restockData);
            if (insertError) throw insertError;

            const ids = Array.from(selectedIds);
            const { error: deleteError } = await supabase
                .from('dropy_seller_distribution')
                .delete()
                .in('id', ids);
            if (deleteError) throw deleteError;

            setSelectedIds(new Set());
            await refreshSilently();
            onCountsChange();
            setToast({ message: `${selectedProducts.length} item(s) moved to Restock for ${sellerName}!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        } catch (error: any) {
            console.error('Error moving to restock:', error);
            setToast({ message: `Failed: ${error.message}`, type: 'error' }); setTimeout(() => setToast(null), 3000);
        } finally {
            setUpdating(false);
        }
    };

    // ============================================
    // FILTERING
    // ============================================
    const filteredProducts = products.filter(p => {
        const matchesSearch = !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.box_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.notes?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter !== 'ALL' && p.distribution_status !== statusFilter) return false;
        return true;
    });

    // ============================================
    // SELECT
    // ============================================
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        else setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id); else newSet.delete(id);
        setSelectedIds(newSet);
    };

    // ============================================
    // EDITABLE CELL
    // ============================================
    const EditableCell = ({ id, field, value, className = '' }: {
        id: string; field: string; value: string | null; className?: string;
    }) => {
        const isEditing = editingCell?.id === id && editingCell?.field === field;
        if (isEditing) {
            return (
                <input
                    autoFocus
                    type={field.includes('date') ? 'date' : 'text'}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={handleKeyDown}
                    className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-sm text-gray-100 focus:outline-none"
                />
            );
        }
        return (
            <div
                onClick={() => startEditing(id, field, value || '')}
                className={`cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors min-h-[28px] ${className}`}
                title="Click to edit"
            >
                {value || <span className="text-gray-500 italic">-</span>}
            </div>
        );
    };

    // ============================================
    // STATUS BADGE COLORS
    // ============================================
    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        shipped: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    };

    // ============================================
    // LOADING
    // ============================================
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-400">Loading distribution for {sellerName}...</div>
            </div>
        );
    }

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-none pt-3 sm:pt-5 pb-6 flex gap-4 items-center flex-wrap">
                {/* Search */}
                <input
                    type="text"
                    placeholder={`Search ${sellerName} items...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 max-w-md px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500 text-sm"
                />

                {/* Status Filter */}
                <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
                    {(['ALL', 'pending', 'shipped', 'completed'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setStatusFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === opt
                                ? opt === 'pending' ? 'bg-yellow-600 text-white shadow-lg'
                                    : opt === 'shipped' ? 'bg-blue-600 text-white shadow-lg'
                                        : opt === 'completed' ? 'bg-green-600 text-white shadow-lg'
                                            : 'bg-orange-500 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-200'
                                }`}
                        >
                            {opt === 'ALL' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{selectedIds.size} selected:</span>
                        <button
                            disabled={updating}
                            onClick={() => handleBulkStatusUpdate('shipped')}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-all disabled:opacity-50"
                        >
                            🚚 Mark Shipped
                        </button>
                        <button
                            disabled={updating}
                            onClick={() => handleBulkStatusUpdate('completed')}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-500 transition-all disabled:opacity-50"
                        >
                            ✅ Mark Completed
                        </button>
                        <button
                            disabled={updating}
                            onClick={handleMoveToRestock}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500 transition-all disabled:opacity-50"
                        >
                            📦 Move to Restock ({selectedIds.size})
                        </button>
                        {/* ⏪ Rollback from Restock */}
                        <button
                            onClick={() => setRollbackOpen(true)}
                            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2"
                        >
                            <span className="hidden sm:inline">⏪ Rollback from Restock</span><span className="sm:hidden">⏪ Rollback</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.1] h-full flex flex-col">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full divide-y divide-white/[0.06]" style={{ minWidth: '1400px' }}>
                            <thead className="bg-[#111111] sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-center w-12">
                                        <input
                                            type="checkbox"
                                            checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id))}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-white/[0.1] bg-[#111111] text-orange-500"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">ASIN</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">SKU</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Product Name</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Box</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Funnel</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Origin</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1] bg-green-900/20">Buying Price</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1] bg-green-900/20">Qty</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Weight</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">Notes</th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-12 text-center text-gray-300">
                                            {products.length === 0
                                                ? `No items distributed to ${sellerName} yet. Items will appear here after Checking.`
                                                : 'No items match your current filters.'
                                            }
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map(product => (
                                        <tr key={product.id} className="hover:bg-white/[0.05] group transition-colors">
                                            {/* Checkbox */}
                                            <td className="px-6 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(product.id)}
                                                    onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                    className="rounded border-white/[0.1] bg-[#111111] text-orange-500"
                                                />
                                            </td>

                                            {/* ASIN */}
                                            <td className="px-6 py-4 font-mono text-sm text-gray-300 border-r border-white/[0.1]">
                                                <div className="truncate max-w-[120px]" title={product.asin}>{product.asin}</div>
                                            </td>

                                            {/* SKU */}
                                            <td className="px-6 py-4 font-mono text-sm text-gray-300 border-r border-white/[0.1]">
                                                <div className="truncate max-w-[100px]">{product.sku || '-'}</div>
                                            </td>

                                            {/* Product Name */}
                                            <td className="px-6 py-4 text-sm text-gray-100 border-r border-white/[0.1]">
                                                <div className="flex items-center">
                                                    <span className="truncate max-w-[200px]" title={product.product_name || ''}>{product.product_name || '-'}</span>
                                                    {product.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}
                                                </div>
                                            </td>

                                            {/* Box Number */}
                                            <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                                                {product.box_number ? (
                                                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold">
                                                        {product.box_number}
                                                    </span>
                                                ) : <span className="text-gray-500">-</span>}
                                            </td>

                                            {/* Funnel */}
                                            <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                                                {(() => {
                                                    const { display, color } = getFunnelBadgeStyle(product.funnel);
                                                    return display === '-'
                                                        ? <span className="text-gray-500">-</span>
                                                        : <span className={`px-2 py-1 rounded-lg text-xs font-bold ${color}`}>{display}</span>;
                                                })()}
                                            </td>

                                            {/* Origin */}
                                            <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                                                <div className="flex flex-col gap-0.5 items-center">
                                                    {product.origin_india && <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px] font-bold">IN</span>}
                                                    {product.origin_china && <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold">CN</span>}
                                                    {product.origin_us && <span className="px-1.5 py-0.5 bg-sky-500 text-white rounded text-[10px] font-bold">US</span>}
                                                    {!product.origin_india && !product.origin_china && !product.origin_us && <span className="text-gray-500">-</span>}
                                                </div>
                                            </td>

                                            {/* Buying Price */}
                                            <td className="px-6 py-4 text-sm text-gray-300 text-center border-r border-white/[0.1] bg-green-900/10">
                                                {product.buying_price ? `₹${product.buying_price}` : '-'}
                                            </td>

                                            {/* Qty */}
                                            <td className="px-6 py-4 text-sm text-gray-300 text-center border-r border-white/[0.1] bg-green-900/10">
                                                {product.buying_quantity || '-'}
                                            </td>

                                            {/* Weight */}
                                            <td className="px-6 py-4 text-sm text-gray-300 text-center border-r border-white/[0.1]">
                                                {product.product_weight ? `${product.product_weight}kg` : '-'}
                                            </td>

                                            {/* Notes - EDITABLE */}
                                            <td className="px-6 py-4 text-sm text-gray-300 border-r border-white/[0.1]">
                                                <EditableCell id={product.id} field="notes" value={product.notes} />
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 text-center">
                                                <select
                                                    value={product.distribution_status}
                                                    onChange={(e) => handleStatusChange(product.id, e.target.value)}
                                                    className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer bg-[#1a1a1a] [color-scheme:dark] ${statusColors[product.distribution_status] || 'text-gray-400 border-white/[0.1]'}`}
                                                >
                                                    <option value="pending">⏳ Pending</option>
                                                    <option value="shipped">🚚 Shipped</option>
                                                    <option value="completed">✅ Completed</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 sm:px-6 py-2 sm:py-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-xs sm:text-sm text-gray-300">
                            <span>
                                Showing {filteredProducts.length} of {products.length} items for {sellerName}
                                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
                            </span>
                            <div className="flex gap-4">
                                <span className="text-yellow-400">⏳ {products.filter(p => p.distribution_status === 'pending').length} Pending</span>
                                <span className="text-blue-400">🚚 {products.filter(p => p.distribution_status === 'shipped').length} Shipped</span>
                                <span className="text-green-400">✅ {products.filter(p => p.distribution_status === 'completed').length} Completed</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* ⏪ Rollback Modal: Restock → Distribution */}
            <GenericRollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                onSuccess={() => { refreshSilently(); onCountsChange(); }}
                direction="RESTOCK_TO_DISTRIBUTION"
                sellerId={sellerId}
                sellerTag={sellerTag}
                sourceTableName="tracking_ops"
                sourceMarketplace="dropy"
                sourceSellerId={SELLER_TAG_MAPPING[sellerTag as SellerTag] || sellerId}
                sourceOpsType="restock"
                targetTableName="dropy_seller_distribution"
            />

            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
                    <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
                        <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                        <span className="font-semibold flex-1 text-sm">{toast.message}</span>
                        <button onClick={() => setToast(null)} className="text-white/70 hover:text-white ml-2">✕</button>
                    </div>
                </div>
            )}
        </div>
    );
}