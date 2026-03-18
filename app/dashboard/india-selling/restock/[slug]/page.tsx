// FILE: app/dashboard/india-selling/restock/[slug]/page.tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import PageGuard from '@/components/PageGuard'
import { Package, RotateCcw, Trash2, RefreshCw, Search, ArrowUpDown } from 'lucide-react'

// ─── Seller Config ───
const SELLERS = [
    { tag: 'GR', name: 'Golden Aura', id: 1, slug: 'golden-aura', color: 'bg-yellow-500' },
    { tag: 'RR', name: 'Rudra Retail', id: 2, slug: 'rudra-retail', color: 'bg-indigo-500' },
    { tag: 'UB', name: 'UBeauty', id: 3, slug: 'ubeauty', color: 'bg-pink-500' },
    { tag: 'VV', name: 'Velvet Vista', id: 4, slug: 'velvet-vista', color: 'bg-emerald-500' },
    { tag: 'DE', name: 'Dropy Ecom', id: 5, slug: 'dropy-ecom', color: 'bg-orange-500' },
    { tag: 'CV', name: 'Costech Ventures', id: 6, slug: 'costech-ventures', color: 'bg-green-600' },
]

type RestockItem = {
    id: string
    asin: string
    sku?: string | null
    product_name?: string | null
    product_link?: string | null
    brand?: string | null
    seller_tag?: string | null
    funnel?: string | null
    origin_india?: boolean | null
    origin_china?: boolean | null
    origin_us?: boolean | null
    buying_price?: number | null
    buying_quantity?: number | null
    target_price?: number | null
    target_quantity?: number | null
    admin_target_price?: number | null
    product_weight?: number | null
    tracking_details?: string | null
    delivery_date?: string | null
    invoice_number?: string | null
    box_number?: string | null
    notes?: string | null
    status?: string | null
    dispose_reason?: string | null
    created_at?: string | null
    moved_at?: string | null
    distribution_id?: string | null
}

type SortField = 'asin' | 'product_name' | 'buying_price' | 'created_at' | 'status'
type SortDir = 'asc' | 'desc'

function RestockRollbackModal({
    open,
    onClose,
    onSuccess,
    sourceStatus,
    tableName,
    sellerName,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sourceStatus: 'relisted' | 'disposed';
    tableName: string;
    sellerName: string;
}) {
    const [items, setItems] = useState<RestockItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSelected(new Set());
        setSearch('');
        fetchItems();
    }, [open]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('status', sourceStatus)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setItems(data || []);
        } catch (err) {
            console.error('Rollback fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!search) return items;
        const q = search.toLowerCase();
        return items.filter(
            (i) =>
                i.asin?.toLowerCase().includes(q) ||
                i.product_name?.toLowerCase().includes(q) ||
                i.sku?.toLowerCase().includes(q) ||
                i.invoice_number?.toLowerCase().includes(q)
        );
    }, [items, search]);

    const toggleAll = (checked: boolean) => {
        if (checked) setSelected(new Set(filtered.map((i) => i.id)));
        else setSelected(new Set());
    };

    const toggleOne = (id: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        setSelected(next);
    };

    const handleRollback = async () => {
        if (selected.size === 0) return;
        setProcessing(true);
        try {
            const { error } = await supabase
                .from(tableName)
                .update({ status: 'pending' })
                .in('id', Array.from(selected));
            if (error) throw error;
            onSuccess();
            onClose();
        } catch (err: any) {
            alert('Rollback failed: ' + err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    const label = sourceStatus.charAt(0).toUpperCase() + sourceStatus.slice(1);
    const color = sourceStatus === 'relisted' ? 'emerald' : 'red';

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-4 sm:p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-${color}-500/20 flex items-center justify-center`}>
                            <RotateCcw className={`w-5 h-5 text-${color}-400`} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                Rollback: {label} → Pending
                            </h2>
                            <p className="text-sm text-slate-400">
                                Select items from <span className={`text-${color}-400 font-semibold`}>{label}</span> to move back to{' '}
                                <span className="text-amber-400 font-semibold">Pending</span>
                                {' '}({sellerName})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-2xl p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 sm:px-6 py-3 sm:py-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by ASIN, Product Name, Box, Invoice..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            No {label.toLowerCase()} items found
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-slate-950 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-3 text-center w-10">
                                        <input
                                            type="checkbox"
                                            checked={filtered.length > 0 && filtered.every((i) => selected.has(i.id))}
                                            onChange={(e) => toggleAll(e.target.checked)}
                                            className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                        />
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase">ASIN</th>
                                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Product Name</th>
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Seller</th>
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Price</th>
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Qty</th>
                                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Box / Invoice</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-3 py-2.5 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(item.id)}
                                                onChange={(e) => toggleOne(item.id, e.target.checked)}
                                                className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                            />
                                        </td>
                                        <td className="px-3 py-2.5 font-mono text-sm text-slate-300">
                                            <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold flex items-center gap-1">
                                                {item.asin} <span className="text-[10px]">↗</span>
                                            </a>
                                        </td>
                                        <td className="px-3 py-2.5 text-sm text-slate-300">
                                            <div className="truncate max-w-[200px]">{item.product_name || '-'}</div>
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm text-slate-400">{item.seller_tag || '-'}</td>
                                        <td className="px-3 py-2.5 text-center text-sm text-slate-300">
                                            {item.buying_price ? `₹${item.buying_price}` : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm text-slate-300">
                                            {item.buying_quantity ?? '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-sm text-slate-400">
                                            {item.box_number || item.invoice_number || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 p-4 sm:p-6 border-t border-slate-800">
                    <span className="text-sm text-slate-400">
                        {filtered.length} items available
                        {selected.size > 0 && ` · ${selected.size} selected`}
                    </span>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-medium transition-colors border border-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRollback}
                            disabled={selected.size === 0 || processing}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transition-all"
                        >
                            <RotateCcw className="w-4 h-4" />
                            {processing ? 'Rolling back...' : `Rollback (${selected.size})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

type ColumnKey =
    | 'asin'
    | 'sku'
    | 'product_name'
    | 'origin'
    | 'funnel'
    | 'price'
    | 'qty'
    | 'weight'
    | 'status'
    | 'action';

const RESTOCK_COLUMNS: { key: ColumnKey; label: string }[] = [
    { key: 'asin', label: 'ASIN' },
    { key: 'sku', label: 'SKU' },
    { key: 'product_name', label: 'Product Name' },
    { key: 'origin', label: 'Origin' },
    { key: 'funnel', label: 'Funnel' },
    { key: 'price', label: 'Price' },
    { key: 'qty', label: 'Qty' },
    { key: 'weight', label: 'Weight' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action' },
];

const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
    asin: 140,
    sku: 120,
    product_name: 260,
    origin: 120,
    funnel: 100,
    price: 90,
    qty: 80,
    weight: 90,
    status: 110,
    action: 140,
};

export default function RestockPage() {
    const params = useParams()
    const router = useRouter()
    const slug = params.slug as string

    const currentSeller = useMemo(() => {
        return SELLERS.find(s => s.slug === slug) || SELLERS[0]
    }, [slug])

    const [items, setItems] = useState<RestockItem[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const cached = sessionStorage.getItem('restock_items_cache');
            return cached ? JSON.parse(cached) : [];
        } catch { return []; }
    })
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState(() => {
        if (typeof window === 'undefined') return '';
        return localStorage.getItem('restockSearch_global') || '';
    });
    // const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [rollbackSource, setRollbackSource] = useState<'relisted' | 'disposed' | null>(null);
    const [statusFilter, setStatusFilter] = useState<'pending' | 'relisted' | 'disposed' | 'removed'>('pending');
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [disposeModal, setDisposeModal] = useState<{ itemId: string } | null>(null)
    const [disposeReason, setDisposeReason] = useState('')
    const [expandedAsins, setExpandedAsins] = useState<Set<string>>(new Set())
    const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
        if (typeof window === 'undefined') return RESTOCK_COLUMNS.map(c => c.key);
        const stored = window.localStorage.getItem('restock_col_order');
        return stored ? (JSON.parse(stored) as ColumnKey[]) : RESTOCK_COLUMNS.map(c => c.key);
    });

    const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(() => {
        if (typeof window === 'undefined') return DEFAULT_WIDTHS;
        const stored = window.localStorage.getItem('restock_col_widths');
        return stored ? { ...DEFAULT_WIDTHS, ...JSON.parse(stored) } : DEFAULT_WIDTHS;
    });

    const [resizingKey, setResizingKey] = useState<ColumnKey | null>(null);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
    const [dragOverKey, setDragOverKey] = useState<ColumnKey | null>(null);

    const handleResizeStart = (key: ColumnKey, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingKey(key);
        setStartX(e.clientX);
        setStartWidth(columnWidths[key]);
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!resizingKey) return;
            const diff = e.clientX - startX;
            const newWidth = Math.max(70, startWidth + diff);
            setColumnWidths(prev => ({ ...prev, [resizingKey]: newWidth }));
        };

        const onUp = () => {
            if (!resizingKey) return;
            setResizingKey(null);
            window.localStorage.setItem('restock_col_widths', JSON.stringify(columnWidths));
        };

        if (resizingKey) {
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [resizingKey, startX, startWidth, columnWidths]);

    const handleDragStart = (key: ColumnKey) => {
        setDragKey(key);
    };

    const handleDragOver = (key: ColumnKey, e: React.DragEvent) => {
        e.preventDefault();
        setDragOverKey(key);
    };

    const handleDrop = () => {
        if (!dragKey || !dragOverKey || dragKey === dragOverKey) {
            setDragKey(null);
            setDragOverKey(null);
            return;
        }

        setColumnOrder(prev => {
            const current = [...prev];
            const from = current.indexOf(dragKey);
            const to = current.indexOf(dragOverKey);
            if (from === -1 || to === -1) return current;
            current.splice(from, 1);
            current.splice(to, 0, dragKey);
            window.localStorage.setItem('restock_col_order', JSON.stringify(current));
            return current;
        });

        setDragKey(null);
        setDragOverKey(null);
    };

    const tableName = `india_restock_seller_${currentSeller.id}`

    const fetchItems = async () => {
        try {
            if (items.length === 0 && !sessionStorage.getItem('restock_items_cache')) setLoading(true)
            let allData: any[] = []
            let from = 0
            const batchSize = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(from, from + batchSize - 1)

                if (error) throw error
                if (data && data.length > 0) {
                    allData = [...allData, ...data]
                    from += batchSize
                    hasMore = data.length === batchSize
                } else {
                    hasMore = false
                }
            }

            setItems(allData)
        } catch (error) {
            console.error('Error fetching restock items:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()

        const channel = supabase
            .channel(`restock-${currentSeller.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
                fetchItems()
            })
            .subscribe()

        return () => { channel.unsubscribe() }
    }, [currentSeller.id])

    useEffect(() => {
        if (items.length > 0) {
            try {
                sessionStorage.setItem('restock_items_cache', JSON.stringify(items));
            } catch { }
        }
    }, [items]);

    const filteredItems = useMemo(() => {
        let result = items.filter(item => {
            const matchesSearch = !searchQuery ||
                item.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
            if (!matchesSearch) return false
            if (statusFilter && item.status !== statusFilter) return false;
            return true
        })

        result.sort((a, b) => {
            const aVal = a[sortField] ?? ''
            const bVal = b[sortField] ?? ''
            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
            return 0
        })

        return result
    }, [items, searchQuery, statusFilter, sortField, sortDir])

    const groupedByAsin = useMemo(() => {
        const map = new Map<string, RestockItem[]>()
        filteredItems.forEach(item => {
            const key = item.asin
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(item)
        })
        map.forEach((groupItems) => {
            groupItems.sort((a, b) => {
                const aTime = a.created_at || ''
                const bTime = b.created_at || ''
                return bTime > aTime ? 1 : bTime < aTime ? -1 : 0
            })
        })
        return Array.from(map.entries()) // [[asin, items[]], ...]
    }, [filteredItems])

    const toggleAsin = (asin: string) => {
        setExpandedAsins(prev => {
            const next = new Set(prev)
            if (next.has(asin)) next.delete(asin)
            else next.add(asin)
            return next
        })
    }

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = 'restockSearch_global';
        const stored = localStorage.getItem(key) || '';
        setSearchQuery(stored);
    }, [slug]);

    // Save search whenever it changes
    const searchInitialized = useRef(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!searchInitialized.current) {
            searchInitialized.current = true;
            return;
        }
        const key = 'restockSearch_global';
        localStorage.setItem(key, searchQuery);
    }, [searchQuery]);

    // const handleSelectAll = (checked: boolean) => {
    //     if (checked) setSelectedIds(new Set(filteredItems.map(i => i.id)))
    //     else setSelectedIds(new Set())
    // }

    // const handleSelectRow = (id: string, checked: boolean) => {
    //     const newSet = new Set(selectedIds)
    //     if (checked) newSet.add(id)
    //     else newSet.delete(id)
    //     setSelectedIds(newSet)
    // }

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('asc') }
    }

    // const handleBulkAction = async (action: 'relisted' | 'disposed' | 'reset') => {
    //     if (selectedIds.size === 0) return
    //     const actionLabel = action === 'reset' ? 'reset to pending' : action
    //     if (!confirm(`${actionLabel} ${selectedIds.size} items?`)) return

    //     try {
    //         setProcessing(true)
    //         const newStatus = action === 'reset' ? 'pending' : action

    //         const { error } = await supabase
    //             .from(tableName)
    //             .update({ status: newStatus })
    //             .in('id', Array.from(selectedIds))

    //         if (error) throw error

    //         setItems(prev => prev.map(item =>
    //             selectedIds.has(item.id) ? { ...item, status: newStatus } : item
    //         ))
    //         setSelectedIds(new Set())
    //         setToast({ message: `${selectedIds.size} items marked as ${newStatus}!`, type: 'success' })
    //         setTimeout(() => setToast(null), 2000)
    //     } catch (error: any) {
    //         setToast({ message: `Failed: ${error.message}`, type: 'error' })
    //         setTimeout(() => setToast(null), 3000)
    //     } finally {
    //         setProcessing(false)
    //     }
    // }

    const handleSingleAction = async (itemId: string, action: 'relisted' | 'disposed' | 'pending' | 'removed', reason?: string) => {
        try {
            const updatePayload: Record<string, any> = { status: action }
            if (action === 'disposed' && reason) {
                updatePayload.dispose_reason = reason
            }
            if (action === 'pending') {
                updatePayload.dispose_reason = null
            }
            const { error } = await supabase
                .from(tableName)
                .update(updatePayload)
                .eq('id', itemId)

            if (error) throw error
            setItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, status: action, ...(action === 'disposed' ? { dispose_reason: reason } : {}), ...(action === 'pending' ? { dispose_reason: null } : {}) } : item
            ))
        } catch (error: any) {
            alert(`Failed: ${error.message}`)
        }
    }

    const rollbackFromRelisted = async () => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .update({ status: 'pending' })
                .eq('status', 'relisted');

            if (error) throw error;
            await fetchItems();
            setToast({ message: 'Rolled back all Relisted items to Pending', type: 'success' });
            setTimeout(() => setToast(null), 2000);
        } catch (error: any) {
            setToast({ message: `Failed: ${error.message}`, type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const rollbackFromDisposed = async () => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .update({ status: 'pending' })
                .eq('status', 'disposed');

            if (error) throw error;
            await fetchItems();
            setToast({ message: 'Rolled back all Disposed items to Pending', type: 'success' });
            setTimeout(() => setToast(null), 2000);
        } catch (error: any) {
            setToast({ message: `Failed: ${error.message}`, type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const StatusBadge = ({ status }: { status?: string | null }) => {
        const s = status || 'pending'
        const styles: Record<string, string> = {
            pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            relisted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            disposed: 'bg-red-500/20 text-red-400 border-red-500/30',
            removed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        }
        return (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${styles[s] || styles.pending}`}>
                {s.toUpperCase()}
            </span>
        )
    }

    const counts = useMemo(() => ({
        total: items.length,
        pending: new Set(items.filter(i => !i.status || i.status === 'pending').map(i => i.asin)).size,
        relisted: new Set(items.filter(i => i.status === 'relisted').map(i => i.asin)).size,
        disposed: new Set(items.filter(i => i.status === 'disposed').map(i => i.asin)).size,
        removed: new Set(items.filter(i => i.status === 'removed').map(i => i.asin)).size,
    }), [items])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="text-xl text-slate-400">Loading restock items...</div>
            </div>
        )
    }

    return (
        <PageGuard>
            <div className="h-screen flex flex-col bg-slate-950 text-slate-200">

                {/* Header */}
                <div className="flex-none px-3 sm:px-4 lg:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-800">
                    <div className="mb-4">
                        <h1 className="text-xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
                            Restock
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">
                            Inbound → Boxes → Checking → Distribution → <span className="text-amber-400 font-semibold">Restock</span>
                        </p>
                    </div>

                    {/* Seller Tabs */}
                    <div className="flex gap-2 mb-4 w-full sm:w-fit overflow-x-auto scrollbar-none pb-2">
                        {SELLERS.map(seller => (
                            <button
                                key={seller.tag}
                                onClick={() => router.push(`/dashboard/india-selling/restock/${seller.slug}`)}
                                className={`relative px-3 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${currentSeller.tag === seller.tag
                                    ? `${seller.color} text-white shadow-lg scale-105`
                                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                                    }`}
                            >
                                <span className="hidden sm:inline">{seller.name}</span>
                                <span className="sm:hidden">{seller.tag}</span>
                                {currentSeller.tag === seller.tag && (
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex gap-2 sm:gap-3 mb-4 overflow-x-auto scrollbar-none">
                        {(['pending', 'relisted', 'disposed', 'removed'] as const).map(opt => {
                            const count = counts[opt];
                            const colors: Record<string, string> = {
                                pending: 'bg-amber-500/20 text-amber-400',
                                relisted: 'bg-emerald-500/20 text-emerald-400',
                                disposed: 'bg-red-500/20 text-red-400',
                                removed: 'bg-rose-500/20 text-rose-400',
                            };
                            return (
                                <button
                                    key={opt}
                                    onClick={() => setStatusFilter(opt)}
                                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${statusFilter === opt
                                        ? colors[opt] + ' ring-2 ring-white/20 shadow-lg'
                                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {opt.charAt(0).toUpperCase() + opt.slice(1)} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Search + Rollback Actions (Pending tab only) */}
                    <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
                        <div className="relative flex-1 min-w-0 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by ASIN, Product Name, SKU, Invoice..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-slate-200 placeholder:text-slate-600"
                            />
                        </div>

                        {statusFilter === 'pending' && (
                            <>
                                <button
                                    onClick={() => setRollbackSource('relisted')}
                                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white"
                                >
                                    <RotateCcw className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">Rollback from Relisted</span>
                                    <span className="sm:hidden">Relisted</span>
                                </button>
                                <button
                                    onClick={() => setRollbackSource('disposed')}
                                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white"
                                >
                                    <RotateCcw className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">Rollback from Disposed</span>
                                    <span className="sm:hidden">Disposed</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden px-3 sm:px-4 lg:px-6 pb-3 sm:pb-6 pt-3 sm:pt-4">
                    <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-800 h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <table className="w-full divide-y divide-slate-800" style={{ minWidth: '1400px' }}>
                                <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                                    <tr>
                                        {/* <th className="px-4 py-3 text-center w-12">
                                            <input
                                                type="checkbox"
                                                checked={filteredItems.length > 0 && filteredItems.every(i => selectedIds.has(i.id))}
                                                onChange={e => handleSelectAll(e.target.checked)}
                                                className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                                            />
                                        </th> */}
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('asin')}>
                                            <div className="flex items-center gap-1">ASIN <ArrowUpDown className="w-3 h-3" /></div>
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase">SKU</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('product_name')}>
                                            <div className="flex items-center gap-1">Product Name <ArrowUpDown className="w-3 h-3" /></div>
                                        </th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Origin</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Funnel</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('buying_price')}>
                                            <div className="flex items-center gap-1 justify-center">Price <ArrowUpDown className="w-3 h-3" /></div>
                                        </th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Qty</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Weight</th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase cursor-pointer hover:text-white" onClick={() => toggleSort('status')}>
                                            <div className="flex items-center gap-1 justify-center">Status <ArrowUpDown className="w-3 h-3" /></div>
                                        </th>
                                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {groupedByAsin.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                                                No restock items found for {currentSeller.name}
                                            </td>
                                        </tr>
                                    ) : (
                                        groupedByAsin.map(([asin, asinItems]) => {
                                            const isExpanded = expandedAsins.has(asin)
                                            const first = asinItems[0]
                                            const count = asinItems.length

                                            // Single item — render flat, no dropdown
                                            if (count === 1) {
                                                const item = first
                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-800/40 group transition-colors">
                                                        <td className="px-3 py-2 font-mono text-sm text-slate-300">
                                                            <a href={item.product_link || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="truncate max-w-[120px] text-indigo-400 hover:text-indigo-300 underline font-semibold" title={item.asin}>
                                                                {item.asin} <span className="text-[10px]">↗</span>
                                                            </a>
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-sm text-slate-400"><div className="truncate max-w-[100px]" title={item.sku || '-'}>{item.sku || '-'}</div></td>
                                                        <td className="px-3 py-2 text-sm text-slate-200"><div className="truncate max-w-[200px]" title={item.product_name || '-'}>{item.product_name || '-'}</div></td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex flex-col gap-1 items-center">
                                                                {item.origin_india && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-semibold">India</span>}
                                                                {item.origin_china && <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-semibold">China</span>}
                                                                {item.origin_us && <span className="px-2 py-0.5 bg-sky-500 text-white rounded text-xs font-semibold">US</span>}
                                                                {!item.origin_india && !item.origin_china && !item.origin_us && <span className="text-xs text-slate-600 italic">-</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {item.funnel ? (
                                                                <span className={`w-9 h-9 inline-flex items-center justify-center rounded-lg font-bold text-sm ${item.funnel === 'HD' || item.funnel === 'LD' || item.funnel === 'RS' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' : item.funnel === 'DP' ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' : 'bg-slate-600 text-white'}`}>
                                                                    {item.funnel === 'HD' || item.funnel === 'LD' ? 'RS' : item.funnel}
                                                                </span>
                                                            ) : <span className="text-xs text-slate-600 italic">-</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.buying_price ?? '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.buying_quantity ?? '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.product_weight ?? '-'}</td>
                                                        <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex gap-1 justify-center">
                                                                {(!item.status || item.status === 'pending') && (
                                                                    <>
                                                                        <button onClick={() => handleSingleAction(item.id, 'relisted')} className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs font-semibold hover:bg-emerald-600 hover:text-white transition-all">Relist</button>
                                                                        <button onClick={() => handleSingleAction(item.id, 'removed')} className="px-2 py-1 bg-rose-600/20 text-rose-400 rounded text-xs font-semibold hover:bg-rose-600 hover:text-white transition-all">Remove</button>
                                                                        <button onClick={() => { setDisposeModal({ itemId: item.id }); setDisposeReason(''); }} className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-semibold hover:bg-red-600 hover:text-white transition-all">Dispose</button>
                                                                    </>
                                                                )}
                                                                {(item.status === 'relisted' || item.status === 'disposed' || item.status === 'removed') && (
                                                                    <button onClick={() => handleSingleAction(item.id, 'pending')} className="px-2 py-1 bg-slate-600/20 text-slate-400 rounded text-xs font-semibold hover:bg-slate-600 hover:text-white transition-all">Reset</button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            }

                                            // Multiple items — collapsible group
                                            return (
                                                <React.Fragment key={asin}>
                                                    {/* Summary row */}
                                                    <tr
                                                        className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                                                        onClick={() => toggleAsin(asin)}
                                                    >
                                                        <td className="px-3 py-2 font-mono text-sm text-slate-300">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                                                                <a href={first.product_link || `https://www.amazon.in/dp/${asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold" title={asin} onClick={e => e.stopPropagation()}>
                                                                    {asin} <span className="text-[10px]">↗</span>
                                                                </a>
                                                                <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold">{count}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-sm text-slate-400"><div className="truncate max-w-[100px]">{first.sku || '-'}</div></td>
                                                        <td className="px-3 py-2 text-sm text-slate-200"><div className="truncate max-w-[200px]">{first.product_name || '-'}</div></td>
                                                        <td className="px-3 py-2 text-center">
                                                            <div className="flex flex-col gap-1 items-center">
                                                                {first.origin_india && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-semibold">India</span>}
                                                                {first.origin_china && <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-semibold">China</span>}
                                                                {first.origin_us && <span className="px-2 py-0.5 bg-sky-500 text-white rounded text-xs font-semibold">US</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            {first.funnel ? (
                                                                <span className={`w-9 h-9 inline-flex items-center justify-center rounded-lg font-bold text-sm ${first.funnel === 'HD' || first.funnel === 'LD' || first.funnel === 'RS' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' : first.funnel === 'DP' ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' : 'bg-slate-600 text-white'}`}>
                                                                    {first.funnel === 'HD' || first.funnel === 'LD' ? 'RS' : first.funnel}
                                                                </span>
                                                            ) : <span className="text-xs text-slate-600 italic">-</span>}
                                                        </td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center">{first.buying_price ?? '-'}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center font-semibold">{asinItems.reduce((s, i) => s + (i.buying_quantity ?? 0), 0)}</td>
                                                        <td className="px-3 py-2 text-sm text-slate-300 text-center">{first.product_weight ?? '-'}</td>
                                                        <td className="px-3 py-2 text-center"><span className="text-xs text-slate-500 italic">{count} entries</span></td>
                                                        <td className="px-3 py-2 text-center"><span className="text-xs text-slate-500 italic">Expand ▾</span></td>
                                                    </tr>

                                                    {/* Expanded sub-rows */}
                                                    {isExpanded && asinItems.map(item => (
                                                        <tr key={item.id} className="bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                                                            <td className="px-3 py-2 pl-9 font-mono text-sm text-slate-400">↳</td>
                                                            <td className="px-3 py-2 font-mono text-sm text-slate-400"><div className="truncate max-w-[100px]" title={item.sku || '-'}>{item.sku || '-'}</div></td>
                                                            <td className="px-3 py-2 text-sm text-slate-200"><div className="truncate max-w-[200px]" title={item.product_name || '-'}>{item.product_name || '-'}</div></td>
                                                            <td className="px-3 py-2 text-center">
                                                                <div className="flex flex-col gap-1 items-center">
                                                                    {item.origin_india && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-semibold">India</span>}
                                                                    {item.origin_china && <span className="px-2 py-0.5 bg-red-500 text-white rounded text-xs font-semibold">China</span>}
                                                                    {item.origin_us && <span className="px-2 py-0.5 bg-sky-500 text-white rounded text-xs font-semibold">US</span>}
                                                                    {!item.origin_india && !item.origin_china && !item.origin_us && <span className="text-xs text-slate-600 italic">-</span>}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {item.funnel ? (
                                                                    <span className={`w-9 h-9 inline-flex items-center justify-center rounded-lg font-bold text-sm ${item.funnel === 'HD' || item.funnel === 'LD' || item.funnel === 'RS' ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' : item.funnel === 'DP' ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' : 'bg-slate-600 text-white'}`}>
                                                                        {item.funnel === 'HD' || item.funnel === 'LD' ? 'RS' : item.funnel}
                                                                    </span>
                                                                ) : <span className="text-xs text-slate-600 italic">-</span>}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.buying_price ?? '-'}</td>
                                                            <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.buying_quantity ?? '-'}</td>
                                                            <td className="px-3 py-2 text-sm text-slate-300 text-center">{item.product_weight ?? '-'}</td>
                                                            <td className="px-3 py-2 text-center"><StatusBadge status={item.status} /></td>
                                                            <td className="px-3 py-2 text-center">
                                                                <div className="flex gap-1 justify-center">
                                                                    {(!item.status || item.status === 'pending') && (
                                                                        <>
                                                                            <button onClick={() => handleSingleAction(item.id, 'relisted')} className="px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs font-semibold hover:bg-emerald-600 hover:text-white transition-all">Relist</button>
                                                                            <button onClick={() => handleSingleAction(item.id, 'removed')} className="px-2 py-1 bg-rose-600/20 text-rose-400 rounded text-xs font-semibold hover:bg-rose-600 hover:text-white transition-all">Remove</button>
                                                                            <button onClick={() => { setDisposeModal({ itemId: item.id }); setDisposeReason(''); }} className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs font-semibold hover:bg-red-600 hover:text-white transition-all">Dispose</button>
                                                                        </>
                                                                    )}
                                                                    {(item.status === 'relisted' || item.status === 'disposed' || item.status === 'removed') && (
                                                                        <button onClick={() => handleSingleAction(item.id, 'pending')} className="px-2 py-1 bg-slate-600/20 text-slate-400 rounded text-xs font-semibold hover:bg-slate-600 hover:text-white transition-all">Reset</button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="flex-none border-t border-slate-800 bg-slate-950 px-3 sm:px-4 py-2 sm:py-3">
                            <div className="text-xs sm:text-sm text-slate-400">
                                Showing {groupedByAsin.length} ASINs ({filteredItems.length} items) of {items.length} total
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dispose Reason Modal */}
                {disposeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 sm:p-6 w-full max-w-md shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Reason for Disposal</h3>
                            <textarea
                                value={disposeReason}
                                onChange={(e) => setDisposeReason(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if (!disposeReason.trim()) { alert('Please enter a reason'); return; }
                                        handleSingleAction(disposeModal.itemId, 'disposed', disposeReason.trim());
                                        setDisposeModal(null);
                                    }
                                }}
                                placeholder="Enter reason for disposing this item..."
                                className="w-full h-24 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => setDisposeModal(null)}
                                    className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-600 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (!disposeReason.trim()) { alert('Please enter a reason'); return; }
                                        handleSingleAction(disposeModal.itemId, 'disposed', disposeReason.trim());
                                        setDisposeModal(null);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                                >
                                    Confirm Dispose
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
                        <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:min-w-[320px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'
                            }`}>
                            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
                            <span className="font-semibold flex-1">{toast.message}</span>
                            <button onClick={() => setToast(null)} className="text-white hover:text-gray-200 transition-colors p-1 hover:bg-white/20 rounded">✕</button>
                        </div>
                    </div>
                )}
            </div>
            {/* Rollback Modal */}
            {rollbackSource && (
                <RestockRollbackModal
                    open={!!rollbackSource}
                    onClose={() => setRollbackSource(null)}
                    onSuccess={() => {
                        fetchItems();
                        setToast({
                            message: 'Rolled back to Pending!',
                            type: 'success',
                        });
                        setTimeout(() => setToast(null), 2000);
                    }}
                    sourceStatus={rollbackSource}
                    tableName={tableName}
                    sellerName={currentSeller.name}
                />
            )}
        </PageGuard>
    );
}
