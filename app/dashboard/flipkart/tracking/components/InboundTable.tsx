'use client';
import { supabase } from '@/lib/supabaseClient';
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import { useState, useEffect, Fragment, useRef, useMemo } from "react";
import { getFunnelBadgeStyle } from '@/lib/utils';
import GenericRollbackModal from '@/components/india-selling/GenericRollbackModal';
import AddBoxDetailsModal from "./AddBoxDetailsModal";


// ============================================
// TYPES
// ============================================
type InboundProduct = {
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
    assigned_quantity: number | null;
    pending_quantity: number | null;
    seller_link: string | null;
    seller_phone: string | null;
    payment_method: string | null;
    tracking_details: string | null;
    delivery_date: string | null;
    order_date: string | null;
    order_id: string | null;
    status: string; // 'pending' | 'in_transit' | 'delivered'
    product_weight: number | null;
    created_at: string | null;
    address: string | null;
    sns_active?: boolean | null;
};

type BoxSummary = {
    box_number: string;
    total_box_weight: number | null;
    item_count: number;
    asin_list: string[];
    box_status: string | null;
};

interface InboundTableProps {
    onCountsChange: () => void;
    refreshKey?: number;
}

// ─── COLUMN ORDER & RESIZE STATE ───
const DEFAULT_COLUMNS = [
    { key: 'sr', label: 'Sr.', minWidth: 50 },
    { key: 'asin', label: 'ASIN', minWidth: 120 },
    { key: 'sku', label: 'SKU', minWidth: 100 },
    { key: 'product_name', label: 'Product Name', minWidth: 180 },
    { key: 'product_link', label: 'Product Link', minWidth: 100 },
    { key: 'seller_link', label: 'Seller Link', minWidth: 100 },
    { key: 'funnel', label: 'Funnel', minWidth: 80 },
    { key: 'seller_tag', label: 'Seller Tag', minWidth: 190 },
    { key: 'origin', label: 'Origin', minWidth: 80 },
    { key: 'buying_price', label: 'Buying Price', minWidth: 90 },
    { key: 'buying_qty', label: 'Buying Qty', minWidth: 80 },
    { key: 'qty_pending', label: 'Qty / Pending', minWidth: 110 },
    { key: 'tracking', label: 'Tracking Details', minWidth: 150 },
    { key: 'delivery_date', label: 'Delivery Date', minWidth: 120 },
    { key: 'order_date', label: 'Order Date', minWidth: 110 },
    { key: 'order_id', label: 'Order ID', minWidth: 130 },
    { key: 'address', label: 'Address', minWidth: 80 },
    { key: 'status', label: 'Status', minWidth: 200 },
];

const STORAGE_KEY = 'flipkart-inbound-table-col-order';
const WIDTH_KEY = 'flipkart-inbound-table-col-widths';

// ============================================
// COMPONENT
// ============================================
export default function InboundTable({ onCountsChange, refreshKey }: InboundTableProps) {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [products, setProducts] = useState<InboundProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'pending' | 'in_transit' | 'delivered'>('ALL');
    const [originFilter, setOriginFilter] = useState<'ALL' | 'India' | 'China' | 'US'>('ALL');
    const [overdueDays, setOverdueDays] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const saved = localStorage.getItem('flipkart-inbound-overdue-days');
        return saved ? parseInt(saved, 10) : null;
    });
    useEffect(() => {
        if (overdueDays !== null) localStorage.setItem('flipkart-inbound-overdue-days', String(overdueDays));
        else localStorage.removeItem('flipkart-inbound-overdue-days');
    }, [overdueDays]);
    const [rollbackOpen, setRollbackOpen] = useState(false);
    const [boxModalOpen, setBoxModalOpen] = useState(false);
    const [boxes, setBoxes] = useState<BoxSummary[]>([]);
    const [loadingBoxes, setLoadingBoxes] = useState(false);
    const [viewBoxOpen, setViewBoxOpen] = useState(false);
    const [viewBoxNumber, setViewBoxNumber] = useState<string | null>(null);
    const [viewBoxItems, setViewBoxItems] = useState<any[]>([]);
    const [viewBoxLoading, setViewBoxLoading] = useState(false);
    const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());
    const [historyByInbound, setHistoryByInbound] = useState<Record<string, any[]>>(
        {}
    );
    const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>(
        {}
    );

    // Inline editing
    const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (typeof window === 'undefined') return DEFAULT_COLUMNS.map(c => c.key);
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed: string[] = JSON.parse(saved);
            // Merge: keep saved order, add any new columns that aren't in saved
            const allKeys = DEFAULT_COLUMNS.map(c => c.key);
            const merged = parsed.filter(k => allKeys.includes(k));
            allKeys.forEach(k => { if (!merged.includes(k)) merged.push(k); });
            return merged;
        }
        return DEFAULT_COLUMNS.map(c => c.key);
    });

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        if (typeof window === 'undefined') return {};
        const saved = localStorage.getItem(WIDTH_KEY);
        return saved ? JSON.parse(saved) : {};
    });

    // Persist
    useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(columnOrder)); }, [columnOrder]);
    useEffect(() => { localStorage.setItem(WIDTH_KEY, JSON.stringify(columnWidths)); }, [columnWidths]);
    // Drag state
    const [dragCol, setDragCol] = useState<string | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    const handleDragStart = (key: string) => setDragCol(key);
    const handleDragOver = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOverCol(key); };
    const handleDrop = (targetKey: string) => {
        if (!dragCol || dragCol === targetKey) return;
        setColumnOrder(prev => {
            const arr = [...prev];
            const fromIdx = arr.indexOf(dragCol);
            const toIdx = arr.indexOf(targetKey);
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, dragCol);
            return arr;
        });
        setDragCol(null);
        setDragOverCol(null);
    };

    // Resize
    const [resizing, setResizing] = useState<string | null>(null);
    const resizeStart = useRef({ x: 0, width: 0 });

    const handleResizeStart = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setResizing(key);
        const col = DEFAULT_COLUMNS.find(c => c.key === key);
        resizeStart.current = { x: e.clientX, width: columnWidths[key] || col?.minWidth || 100 };

        const onMove = (ev: MouseEvent) => {
            const diff = ev.clientX - resizeStart.current.x;
            const minW = col?.minWidth || 50;
            setColumnWidths(prev => ({ ...prev, [key]: Math.max(minW, resizeStart.current.width + diff) }));
        };
        const onUp = () => {
            setResizing(null);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

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
                    .from('flipkart_inbound_tracking')
                    .select(`
                    id,
                    asin,
                    journey_id,
                    product_name,
                    brand,
                    sku,
                    seller_tag,
                    funnel,
                    origin,
                    origin_india,
                    origin_china,
                    origin_us,
                    product_link,
                    inr_purchase_link,
                    usd_price,
                    inr_purchase,
                    target_price,
                    admin_target_price,
                    target_quantity,
                    funnel_quantity,
                    funnel_seller,
                    buying_price,
                    buying_quantity,
                    assigned_quantity,
                    pending_quantity,
                    seller_link,
                    seller_phone,
                    payment_method,
                    tracking_details,
                    delivery_date,
                    order_date,
                    status,
                    product_weight,
                    created_at,
                    address,
                    sns_active
                `)
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
            await fetchBoxes();
        } catch (error) {
            console.error('Error fetching inbound products:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshSilently = async () => {
        try {
            let allData: any[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('flipkart_inbound_tracking')
                    .select(`
                    id,
                    asin,
                    journey_id,
                    product_name,
                    brand,
                    sku,
                    seller_tag,
                    funnel,
                    origin,
                    origin_india,
                    origin_china,
                    origin_us,
                    product_link,
                    inr_purchase_link,
                    usd_price,
                    inr_purchase,
                    target_price,
                    admin_target_price,
                    target_quantity,
                    funnel_quantity,
                    funnel_seller,
                    buying_price,
                    buying_quantity,
                    assigned_quantity,
                    pending_quantity,
                    seller_link,
                    seller_phone,
                    payment_method,
                    tracking_details,
                    delivery_date,
                    order_date,
                    status,
                    product_weight,
                    created_at,
                    address,
                    sns_active
                `)
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
            await fetchBoxes();
        } catch (error) {
            console.error('Error refreshing inbound products:', error);
        }
    };

    // ============================================
    // FETCH BOXES
    // ============================================
    const fetchBoxes = async () => {
        try {
            setLoadingBoxes(true);

            const { data, error } = await supabase
                .from("flipkart_inbound_boxes")
                .select("box_number, total_box_weight, box_status, asin");

            if (error) throw error;

            const map = new Map<string, BoxSummary>();

            (data || []).forEach((row: any) => {
                const key = row.box_number || "UNKNOWN";
                const existing = map.get(key);
                if (!existing) {
                    map.set(key, {
                        box_number: key,
                        total_box_weight: row.total_box_weight,
                        item_count: 1,
                        asin_list: row.asin ? [row.asin] : [],
                        box_status: row.box_status || "open",
                    });
                } else {
                    existing.item_count += 1;
                    if (row.asin && !existing.asin_list.includes(row.asin)) {
                        existing.asin_list.push(row.asin);
                    }
                }
            });

            setBoxes(Array.from(map.values()));
        } catch (err) {
            console.error("Error fetching boxes:", err);
        } finally {
            setLoadingBoxes(false);
        }
    };

    const handleViewBox = async (boxNumber: string) => {
        if (!boxNumber) return;
        setViewBoxNumber(boxNumber);
        setViewBoxLoading(true);
        setViewBoxOpen(true);

        try {
            const { data, error } = await supabase
                .from("flipkart_inbound_boxes")
                .select("*")
                .eq("box_number", boxNumber)
                .order("created_at", { ascending: true });

            if (error) throw error;
            setViewBoxItems(data || []);
        } catch (err) {
            console.error("Error loading box items:", err);
            setToast({ message: "Failed to load box contents.", type: 'error' }); setTimeout(() => setToast(null), 3000);
            setViewBoxOpen(false);
        } finally {
            setViewBoxLoading(false);
        }
    };

    const handleUpdateBoxItem = async (
        itemId: string,
        updates: Partial<{ quantity_assigned: number; product_weight: number }>
    ) => {
        try {
            const { error } = await supabase
                .from("flipkart_inbound_boxes")
                .update(updates)
                .eq("id", itemId);

            if (error) throw error;

            // update local modal state
            setViewBoxItems((prev) =>
                prev.map((row) => (row.id === itemId ? { ...row, ...updates } : row))
            );
            await fetchBoxes();
        } catch (err) {
            console.error("Error updating box item:", err);
            setToast({ message: "Failed to update box item.", type: 'error' }); setTimeout(() => setToast(null), 3000);
        }
    };

    // ============================================
    // REALTIME
    // ============================================
    useEffect(() => {
        fetchProducts();

        const channel = supabase
            .channel('flipkart-inbound-table-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'flipkart_inbound_tracking',
            }, () => {
                refreshSilently();
                onCountsChange();
            })
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, []);

    useEffect(() => {
        if (refreshKey) refreshSilently();
    }, [refreshKey]);

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
            const product = products.find(p => p.id === editingCell.id);
            if (!product) return;

            let updates: Record<string, any> = {};

            // If the user is updating the Buying Quantity, calculate the new Pending Quantity
            if (editingCell.field === 'buying_quantity') {
                const newBuyingQty = editValue ? Number(editValue) : 0;
                const oldBuyingQty = product.buying_quantity || 0;
                const oldPendingQty = product.pending_quantity ?? oldBuyingQty;

                // How many items have already been processed/boxed?
                const completedQty = oldBuyingQty - oldPendingQty;

                // New pending is the new buying total minus what is already completed
                const newPendingQty = Math.max(0, newBuyingQty - completedQty);

                updates = {
                    buying_quantity: newBuyingQty,
                    pending_quantity: newPendingQty
                };
            } else {
                // For all other fields (like buying_price, tracking_details)
                updates = { [editingCell.field]: editValue || null };
            }

            // Push updates to Supabase
            const editedProduct = products.find(p => p.id === editingCell.id);
            const siblingIds = editedProduct
                ? products.filter(p => p.asin === editedProduct.asin).map(p => p.id)
                : [editingCell.id];

            // Push updates to ALL sibling rows (same ASIN)
            const { error } = await supabase
                .from('flipkart_inbound_tracking')
                .update(updates)
                .in('id', siblingIds);

            if (error) throw error;

            // Update local state for all siblings
            setProducts(prev => prev.map(p =>
                siblingIds.includes(p.id) ? { ...p, ...updates } : p
            ));
        } catch (error) {
            console.error('Error saving edit:', error);
        } finally {
            setEditingCell(null);
            setEditValue('');
        }
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') cancelEdit();
    };

    // ============================================
    // STATUS CHANGE
    // ============================================
    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('flipkart_inbound_tracking')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            setProducts(prev => prev.map(p =>
                p.id === id ? { ...p, status: newStatus } : p
            ));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleMoveBoxToChecking = async (boxNumber: string) => {
        if (!boxNumber) return;

        const confirmMove = confirm(
            `Move box ${boxNumber} and all its items to Checking?`
        );
        if (!confirmMove) return;

        try {
            // 1. Fetch all rows for this box from inbound_boxes
            const { data, error } = await supabase
                .from("flipkart_inbound_boxes")
                .select("*")
                .eq("box_number", boxNumber);

            if (error) throw error;
            if (!data || data.length === 0) {
                setToast({ message: "No items found for this box.", type: 'error' }); setTimeout(() => setToast(null), 3000);
                return;
            }

            const now = new Date().toISOString();

            // 2. Map ONLY columns that exist in flipkart_box_checking
            const checkingRows = data.map((row: any) => ({
                // ids & links
                inbound_tracking_id: row.inbound_tracking_id ?? row.purchase_row_id ?? null,
                inbound_box_id: row.id ?? null,
                box_id: null,
                shipment_id: null,

                // product identifiers
                sku: row.sku ?? null,
                asin: row.asin ?? null,
                product_name: row.product_name ?? null,
                brand: row.brand ?? null,

                // quantities (you can tune this if you want more detailed logic later)
                expected_quantity: row.ordered_quantity ?? row.buying_quantity ?? 0,
                actual_quantity: row.quantity_assigned ?? row.buying_quantity ?? 0,
                damaged_quantity: 0,
                good_quantity: row.quantity_assigned ?? row.buying_quantity ?? 0,

                // checking meta
                status: "pending",
                checked_by: null,
                checked_at: null,
                notes: null,
                box_number: row.box_number ?? null,
                check_status: "pending",
                check_brand: false,
                check_item_expire: false,
                check_small_size: false,
                check_multi_seller: false,
                check_notes: null,
                moved_from_boxes_at: now,

                // journey / meta from inbound
                journey_id: row.journey_id ?? null,
                funnel: row.funnel ?? null,
                origin: row.origin ?? null,
                origin_india: row.origin_india ?? false,
                origin_china: row.origin_china ?? false,
                origin_us: row.origin_us ?? false,
                inr_purchase_link: row.inr_purchase_link ?? null,
                usd_price: row.usd_price ?? null,
                inr_purchase: row.inr_purchase ?? null,
                target_price: row.target_price ?? null,
                admin_target_price: row.admin_target_price ?? null,
                target_quantity: row.target_quantity ?? null,
                funnel_quantity: row.funnel_quantity ?? null,
                funnel_seller: row.funnel_seller ?? null,
                seller_link: row.seller_link ?? null,
                seller_phone: row.seller_phone ?? null,
                payment_method: row.payment_method ?? null,
                order_date: row.order_date ?? null,
                order_id: row.order_id ?? null,
                product_weight: row.product_weight ?? null,
                seller_tag: row.seller_tag ?? null,
                buying_price: row.buying_price ?? null,
                buying_quantity: row.buying_quantity ?? null,
                tracking_details: row.tracking_details ?? null,
                delivery_date: row.delivery_date ?? null,
                product_link: row.product_link ?? null,
                sns_active: row.sns_active ?? false,

                // QC flag
                good_condition: false,
            }));

            const { error: insertError } = await supabase
                .from("flipkart_box_checking")
                .insert(checkingRows);
            if (insertError) throw insertError;

            // 3. Mark box sealed in inbound_boxes (this column DOES exist there)
            const { error: updateError } = await supabase
                .from("flipkart_inbound_boxes")
                .update({ box_status: "sealed" })
                .eq("box_number", boxNumber);
            if (updateError) throw updateError;

            await fetchBoxes();
            onCountsChange();
            setToast({ message: `Box ${boxNumber} moved to Checking.`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        } catch (err: any) {
            console.error("Error moving box to checking:", err);
            setToast({ message: err.message || "Failed to move box to Checking.", type: 'error' }); setTimeout(() => setToast(null), 3000);
        }
    };

    // ============================================
    // FILTERING
    // ============================================
    const filteredProducts = products.filter(p => {
        // Search
        const matchesSearch = !searchQuery ||
            p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tracking_details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.order_id?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        // Status filter
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;

        // Origin filter
        if (originFilter !== 'ALL') {
            if (originFilter === 'India' && !p.origin_india) return false;
            if (originFilter === 'China' && !p.origin_china) return false;
            if (originFilter === 'US' && !p.origin_us) return false;
        }

        return true;
    });

    // ============================================
    // FILTER TO ROWS WITH PENDING QTY
    // ============================================
    const displayProducts = useMemo(() => {
        return filteredProducts.filter(p => (p.pending_quantity ?? p.buying_quantity ?? 0) > 0);
    }, [filteredProducts]);

    // ============================================
    // SELECT ALL / ROW
    // ============================================
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id); else newSet.delete(id);
        setSelectedIds(newSet);
    };

    // ============================================
    // ORIGIN BADGES
    // ============================================
    const OriginBadge = ({ product }: { product: InboundProduct }) => (
        <div className="flex flex-col gap-1 items-center">
            {product.origin_india && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-semibold">India</span>}
            {product.origin_china && <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-semibold">China</span>}
            {product.origin_us && <span className="px-2 py-0.5 bg-sky-500 text-white rounded text-xs font-semibold">US</span>}
            {!product.origin_india && !product.origin_china && !product.origin_us && (
                <span className="text-xs text-gray-300">-</span>
            )}
        </div>
    );

    // ============================================
    // FUNNEL BADGE
    // ============================================
    const FunnelBadge = ({ funnel }: { funnel: string | null }) => {
        const { display, color } = getFunnelBadgeStyle(funnel);
        if (!funnel) return <span className="text-xs text-gray-300">-</span>;
        return (
            <span className={`w-9 h-9 inline-flex items-center justify-center rounded-lg font-bold text-sm ${color}`}>
                {display}
            </span>
        );
    };

    // ============================================
    // SELLER TAG BADGES
    // ============================================
    const SellerTagBadge = ({ tag }: { tag: string | null }) => {
        if (!tag) return <span className="text-xs text-gray-300">-</span>;

        const tagColors = SELLER_STYLES;

        return (
            <div className="flex flex-wrap gap-1 justify-center">
                {tag.split(',').map(t => {
                    const clean = t.trim();
                    return (
                        <span key={clean} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tagColors[clean] || 'bg-[#1a1a1a] text-white'}`}>
                            {clean}
                        </span>
                    );
                })}
            </div>
        );
    };

    // ============================================
    // EDITABLE CELL
    // ============================================
    const EditableCell = (
        id: string,
        field: string,
        value: string | null,
        className?: string
    ) => {
        const isEditing = editingCell?.id === id && editingCell?.field === field;

        if (isEditing) {
            return (
                <input
                    autoFocus
                    type={field === "delivery_date" || field === "order_date" ? "date" : "text"}
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
                onClick={() => startEditing(id, field, value || "")}
                className={`flex items-center justify-center gap-1 cursor-pointer hover:bg-[#111111] px-2 py-1 rounded transition-colors min-h-[28px] ${className ?? ""}`}
                title="Click to edit value"
            >
                <span className={value ? "text-gray-100" : "text-gray-500 italic"}>
                    {value || "-"}
                </span>
                <span className="text-[10px] text-gray-500">✏</span>
            </div>
        );
    };

    const EditableHeaderLabel = ({ label }: { label: string }) => {
        return (
            <span className="inline-flex items-center gap-1">
                <span>{label}</span>
                <span
                    className="text-[10px] text-gray-500"
                    title="Cells in this column are editable"
                >
                    ✏
                </span>
            </span>
        );
    };

    const toggleHistory = async (inboundId: string) => {
        if (openHistory.has(inboundId)) {
            const next = new Set(openHistory);
            next.delete(inboundId);
            setOpenHistory(next);
            return;
        }

        if (historyByInbound[inboundId]) {
            const next = new Set(openHistory);
            next.add(inboundId);
            setOpenHistory(next);
            return;
        }

        setHistoryLoading((prev) => ({ ...prev, [inboundId]: true }));
        try {
            const { data, error } = await supabase
                .from("flipkart_box_assignment_history")
                .select("*")
                .eq("inbound_tracking_id", inboundId)
                .order("created_at", { ascending: true });

            if (error) throw error;

            setHistoryByInbound((prev) => ({ ...prev, [inboundId]: data || [] }));
            const next = new Set(openHistory);
            next.add(inboundId);
            setOpenHistory(next);
        } catch (err) {
            console.error("Error fetching box history:", err);
            setToast({ message: "Failed to load box history.", type: 'error' }); setTimeout(() => setToast(null), 3000);
        } finally {
            setHistoryLoading((prev) => ({ ...prev, [inboundId]: false }));
        }
    };

    // ============================================
    // LOADING STATE
    // ============================================
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-400">Loading inbound tracking...</div>
            </div>
        );
    }

    // ============================================
    // OVERDUE CHECK
    // ============================================
    const isRowOverdue = (deliveryDate: string | null): boolean => {
        if (!overdueDays || overdueDays <= 0 || !deliveryDate) return false;
        const delivered = new Date(deliveryDate);
        if (isNaN(delivered.getTime())) return false;
        const now = new Date();
        const diffMs = now.getTime() - delivered.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays > overdueDays;
    };

    // ============================================
    // RENDER
    // ============================================
    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-none pt-6 pb-6 flex gap-4 items-center flex-wrap">
                {/* Search */}
                <input
                    type="text"
                    placeholder="Search by ASIN, Name, SKU, or Tracking..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 max-w-md px-4 sm:px-6 py-2 sm:py-2.5 text-sm bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500"
                />

                {/* Status Filter */}
                <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1 overflow-x-auto scrollbar-none">
                    {(['ALL', 'pending', 'in_transit', 'delivered'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setStatusFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === opt
                                ? opt === 'pending' ? 'bg-yellow-600 text-white shadow-lg'
                                    : opt === 'in_transit' ? 'bg-blue-600 text-white shadow-lg'
                                        : opt === 'delivered' ? 'bg-green-600 text-white shadow-lg'
                                            : 'bg-orange-500 text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-200'
                                }`}
                        >
                            {opt === 'ALL' ? 'All' : opt === 'in_transit' ? 'In Transit' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Origin Filter */}
                <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1 overflow-x-auto scrollbar-none">
                    {(['ALL', 'India', 'China', 'US'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setOriginFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${originFilter === opt
                                ? opt === 'India' ? 'bg-orange-500 text-white'
                                    : opt === 'China' ? 'bg-rose-500 text-white'
                                        : opt === 'US' ? 'bg-sky-500 text-white'
                                            : 'bg-orange-500 text-white'
                                : 'text-gray-500 hover:text-gray-200'
                                }`}
                        >
                            {opt === 'ALL' ? 'All' : opt}
                        </button>
                    ))}
                </div>

                {/* Overdue Highlight */}
                <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-xl border border-white/[0.1] px-3 py-1.5">
                    <span className="text-xs font-bold text-red-400 whitespace-nowrap">🔴 Overdue</span>
                    <input
                        type="number"
                        min={0}
                        placeholder="Days"
                        value={overdueDays ?? ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setOverdueDays(val === '' ? null : parseInt(val, 10));
                        }}
                        className="w-14 px-2 py-1 text-xs text-center bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-gray-100 placeholder:text-gray-500"
                    />
                    {overdueDays !== null && overdueDays > 0 && (
                        <button
                            onClick={() => setOverdueDays(null)}
                            className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                            title="Clear overdue filter"
                        >✕</button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="bg-[#1a1a1a] rounded-lg border border-white/[0.1] h-full flex flex-col">
                    <div className="flex-1 overflow-auto">
                        <table className="w-full divide-y divide-white/[0.06]">
                            <thead className="bg-[#111111] sticky top-0 z-10">
                                <tr>
                                    {columnOrder.map(key => {
                                        const col = DEFAULT_COLUMNS.find(c => c.key === key);
                                        if (!col) return null;
                                        const width = columnWidths[key] || col.minWidth;
                                        return (
                                            <th
                                                key={key}
                                                draggable
                                                onDragStart={() => handleDragStart(key)}
                                                onDragOver={(e) => handleDragOver(e, key)}
                                                onDrop={() => handleDrop(key)}
                                                className={`px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1] select-none relative cursor-grab ${dragOverCol === key ? 'bg-orange-500/10' : ''
                                                    }`}
                                                style={{ width, minWidth: col.minWidth }}
                                            >
                                                {col.label}
                                                {/* Resize handle */}
                                                <div
                                                    onMouseDown={(e) => handleResizeStart(key, e)}
                                                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/[0.08] transition-colors"
                                                />
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {displayProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={DEFAULT_COLUMNS.length} className="px-4 py-12 text-center text-gray-300">
                                            {products.length === 0
                                                ? "No inbound items yet. Products will appear here when moved from Purchases."
                                                : "No items match your current filters."}
                                        </td>
                                    </tr>
                                ) : (
                                    displayProducts.map((product, filteredIndex) => {
                                        const tagColors = SELLER_STYLES;
                                        const overdue = isRowOverdue(product.delivery_date);
                                        const sellerTag = (product.seller_tag || 'GR').trim().toUpperCase();
                                        return (
                                            <Fragment key={product.id}>
                                                <tr className={`group transition-colors ${overdue ? 'bg-red-950/60 hover:bg-red-900/50 border-l-2 border-l-red-500' : 'hover:bg-white/[0.05]'}`}>
                                                    {columnOrder.map(key => {
                                                        const col = DEFAULT_COLUMNS.find(c => c.key === key);
                                                        if (!col) return null;
                                                        const width = columnWidths[key] || col.minWidth;
                                                        const style = { width, minWidth: col.minWidth };
                                                        const base = "px-3 py-3 text-sm border-r border-white/[0.1]";

                                                        switch (key) {
                                                            case 'sr':
                                                                return <td key={key} className={`${base} text-center text-gray-300`} style={style}>{filteredIndex + 1}</td>;
                                                            case 'asin':
                                                                return <td key={key} className={`${base} font-mono text-gray-100`} style={style}><div className="truncate max-w-[120px]" title={product.asin}>{product.asin}</div></td>;
                                                            case 'sku':
                                                                return <td key={key} className={`${base} text-gray-300`} style={style}><div className="truncate max-w-[100px]">{product.sku || '-'}</div></td>;
                                                            case 'product_name':
                                                                return <td key={key} className={`${base} text-gray-300`} style={style}><div className="flex items-center"><span className="truncate max-w-[180px]" title={product.product_name || ''}>{product.product_name || '-'}</span>{product.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}</div></td>;
                                                            case 'product_link':
                                                                return (
                                                                    <td key={key} className={base} style={style}>
                                                                        {product.product_link ? <a href={product.product_link} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 no-underline">🔗 Link</a> : <span className="text-gray-500">-</span>}
                                                                    </td>
                                                                );
                                                            case 'seller_link':
                                                                return (
                                                                    <td key={key} className={base} style={style}>
                                                                        {product.seller_link ? <a href={product.seller_link.startsWith('http') ? product.seller_link : `https://${product.seller_link}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 no-underline text-xs">🔗 Seller</a> : <span className="text-gray-500">-</span>}
                                                                    </td>
                                                                );
                                                            case 'funnel':
                                                                return <td key={key} className={`${base} text-center`} style={style}><FunnelBadge funnel={product.funnel} /></td>;
                                                            case 'seller_tag':
                                                                return (
                                                                    <td key={key} className={base} style={style}>
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tagColors[sellerTag] ?? 'bg-[#1a1a1a] text-white'}`}>
                                                                                {sellerTag}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            case 'origin':
                                                                return <td key={key} className={base} style={style}><OriginBadge product={product} /></td>;
                                                            case 'buying_price':
                                                                return <td key={key} className={`${base} text-center bg-green-900/10`} style={style}>{EditableCell(product.id, "buying_price", product.buying_price?.toString() ?? null)}</td>;
                                                            case 'buying_qty':
                                                                return <td key={key} className={`${base} text-center bg-green-900/10`} style={style}><span className="text-gray-100 font-semibold">{product.buying_quantity ?? 0}</span></td>;
                                                            case 'qty_pending':
                                                                return (
                                                                    <td key={key} className={`${base} text-center bg-green-900/10`} style={style}>
                                                                        <span className="text-sm font-semibold text-gray-100">{product.pending_quantity ?? product.buying_quantity ?? 0}</span>
                                                                    </td>
                                                                );
                                                            case 'tracking':
                                                                return <td key={key} className={base} style={style}>{EditableCell(product.id, "tracking_details", product.tracking_details ?? null)}</td>;
                                                            case 'delivery_date':
                                                                return <td key={key} className={base} style={style}>{EditableCell(product.id, "delivery_date", product.delivery_date ?? null)}</td>;
                                                            case 'order_date':
                                                                return <td key={key} className={base} style={style}>{product.order_date || '-'}</td>;
                                                            case 'order_id':
                                                                return <td key={key} className={base} style={style}>{EditableCell(product.id, "order_id", product.order_id ?? null)}</td>;
                                                            case 'address':
                                                                return (
                                                                    <td key={key} className={`${base} text-center`} style={style}>
                                                                        {product.address ? (
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${product.address === 'A' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                                                                {product.address}
                                                                            </span>
                                                                        ) : <span className="text-gray-500">-</span>}
                                                                    </td>
                                                                );
                                                            case 'status':
                                                                return (
                                                                    <td key={key} className={base} style={style}>
                                                                        <div className="flex items-center justify-center gap-3">
                                                                            {(['pending', 'in_transit', 'delivered'] as const).map((s) => {
                                                                                const isActive = product.status === s;
                                                                                const config = {
                                                                                    pending: { label: 'P', color: 'border-amber-500 bg-amber-500/20 text-amber-400', active: 'bg-amber-500 text-white border-amber-500' },
                                                                                    in_transit: { label: 'T', color: 'border-blue-500 bg-blue-500/20 text-blue-400', active: 'bg-blue-500 text-white border-blue-500' },
                                                                                    delivered: { label: 'D', color: 'border-emerald-500 bg-emerald-500/20 text-emerald-400', active: 'bg-emerald-500 text-white border-emerald-500' },
                                                                                }[s];
                                                                                return (
                                                                                    <button key={s} onClick={() => handleStatusChange(product.id, s)} title={s.replace('_', ' ').toUpperCase()}
                                                                                        className={`w-8 h-8 rounded-lg border-2 text-xs font-bold transition-all ${isActive ? config.active + ' shadow-lg scale-110' : config.color + ' opacity-60 hover:opacity-100'}`}>
                                                                                        {config.label}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            default:
                                                                return <td key={key} className={base} style={style}>-</td>;
                                                        }
                                                    })}
                                                </tr>
                                                {/* Box history expansion row */}
                                                {openHistory.has(product.id) && (
                                                    <tr className="bg-[#1a1a1a]">
                                                        <td colSpan={DEFAULT_COLUMNS.length} className="px-6 py-4">
                                                            {historyLoading[product.id] ? (
                                                                <span className="text-gray-500 text-xs">Loading history...</span>
                                                            ) : (historyByInbound[product.id] || []).length === 0 ? (
                                                                <span className="text-gray-500 text-xs">No box assignments yet.</span>
                                                            ) : (
                                                                <div className="space-y-1">
                                                                    {(historyByInbound[product.id] || []).map((h: any, i: number) => (
                                                                        <div key={i} className="text-xs text-gray-400">
                                                                            📦 Box <span className="font-bold text-gray-100">{h.box_number}</span> — Qty: {h.quantity_assigned} — {new Date(h.created_at).toLocaleDateString()}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex-none borde-t border-white/[0.1] bg-[#111111] px-4 sm:px-6 py-2 sm:py-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-xs sm:text-sm text-gray-300">
                            <span>
                                Showing {displayProducts.length} items ({products.length} total rows)
                                {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
                            </span>
                            <div className="flex gap-2 sm:gap-4 flex-wrap">
                                <span className="text-yellow-400">⏳ {products.filter(p => p.status === 'pending').length} Pending</span>
                                <span className="text-blue-400">🚚 {products.filter(p => p.status === 'in_transit').length} In Transit</span>
                                <span className="text-green-400">✅ {products.filter(p => p.status === 'delivered').length} Delivered</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ⏪ Rollback Modal: Boxes → Inbound */}
            <GenericRollbackModal
                open={rollbackOpen}
                onClose={() => setRollbackOpen(false)}
                onSuccess={() => { refreshSilently(); onCountsChange(); }}
                direction="BOXES_TO_INBOUND"
                sellerId={0}
                sellerTag=""
                sourceTableName="flipkart_inbound_boxes"
                targetTableName="flipkart_inbound_tracking"
            />
            <AddBoxDetailsModal
                open={boxModalOpen}
                onClose={() => setBoxModalOpen(false)}
                inboundItems={products}
                onSuccess={async () => {
                    await refreshSilently();
                    onCountsChange();
                    setBoxModalOpen(false);
                }}
            />
            {viewBoxOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]">
                    <div className="w-full max-w-6xl max-h-[90vh] bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl flex flex-col mx-2 sm:mx-0">
                        <div className="px-5 py-4 border-b border-white/[0.1] flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    Box details — {viewBoxNumber}
                                </h2>
                                <p className="text-xs text-gray-300">
                                    Edit quantities or weights for items inside this box.
                                </p>
                            </div>
                            <button
                                onClick={() => setViewBoxOpen(false)}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto px-5 py-4">
                            {viewBoxLoading ? (
                                <div className="h-40 flex items-center justify-center text-gray-400">
                                    Loading box contents...
                                </div>
                            ) : viewBoxItems.length === 0 ? (
                                <div className="h-40 flex items-center justify-center text-gray-500">
                                    No items in this box.
                                </div>
                            ) : (
                                <table className="w-full text-xs border-separate border-spacing-y-1" style={{ minWidth: "1100px" }}>
                                    <thead>
                                        <tr className="bg-[#111111]">
                                            <th className="px-2 py-2 text-left text-gray-400">ASIN</th>
                                            <th className="px-2 py-2 text-left text-gray-400">Product</th>
                                            <th className="px-2 py-2 text-left text-gray-400">SKU</th>
                                            <th className="px-2 py-2 text-center text-gray-400">Ordered</th>
                                            <th className="px-2 py-2 text-center text-gray-400">
                                                Qty in this box
                                            </th>
                                            <th className="px-2 py-2 text-center text-gray-400">
                                                Product weight (kg)
                                            </th>
                                            <th className="px-2 py-2 text-center text-gray-400">
                                                Seller tag
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewBoxItems.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="bg-[#111111]/60 hover:bg-[#111111]"
                                            >
                                                <td className="px-2 py-2 font-mono text-gray-100">
                                                    {row.asin}
                                                </td>
                                                <td className="px-2 py-2 text-gray-100">
                                                    <div className="truncate max-w-[260px]">
                                                        {row.product_name || "-"}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 font-mono text-gray-300">
                                                    {row.sku || "-"}
                                                </td>
                                                <td className="px-2 py-2 text-center text-gray-300">
                                                    {row.ordered_quantity ?? row.buying_quantity ?? 0}
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={row.quantity_assigned ?? row.buying_quantity ?? ""}
                                                        onChange={(e) =>
                                                            handleUpdateBoxItem(row.id, {
                                                                quantity_assigned: Number(e.target.value || 0),
                                                            })
                                                        }
                                                        className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min={0}
                                                        value={row.product_weight ?? ""}
                                                        onChange={(e) =>
                                                            handleUpdateBoxItem(row.id, {
                                                                product_weight: Number(e.target.value || 0),
                                                            })
                                                        }
                                                        className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-center text-gray-300">
                                                    {row.seller_tag || "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="px-5 py-3 border-t border-white/[0.1] flex items-center justify-end">
                            <button
                                onClick={() => setViewBoxOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-[#111111]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

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