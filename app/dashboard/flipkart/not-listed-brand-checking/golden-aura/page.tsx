'use client';

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react';
import PageTransition from '@/components/layout/PageTransition';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import RejectModal from '../../../../components/RejectModal';
import FunnelBadge from '../../../../components/FunnelBadge';
import { generateAmazonLink } from '@/lib/utils';
import {
    Search,
    RotateCcw,
    LayoutList,
    Columns,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    Filter
} from 'lucide-react';

interface ProductRow {
    id: string;
    asin: string;
    product_name: string | null;
    brand: string | null;
    funnel: string | null;
    monthly_unit: number | null;
    product_link: string | null;
    link: string | null;
    amz_link: string | null;
    working?: boolean;
    reason?: string | null;
    remark?: string | null;
    category?: string;
}

type CategoryTab = 'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved' | 'reject';

// ✅ 1. UPDATE: Defined larger default widths for better layout
const DEFAULT_WIDTHS: Record<string, number> = {
    asin: 140,
    product_name: 350,
    brand: 160,
    funnel: 110,
    monthly_unit: 120,
    link: 120,           // ✅ CHANGED: from product_link to link
    amz_link: 120,       // ✅ CHANGED: increased width
    reason: 250,
    remark: 200,
};

export default function GoldenAuraNotListedPage() {
    const [activeTab, setActiveTab] = useState<CategoryTab>('high_demand');
    const [products, setProducts] = useState<ProductRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [processingId, setProcessingId] = useState<string | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);

    // Column visibility
    const [visibleColumns, setVisibleColumns] = useState({
        asin: true,
        product_name: true,
        brand: true,
        funnel: true,
        monthly_unit: true,
        link: true,          // ✅ CHANGED: from product_link to link
        amz_link: true,
        reason: true,
        remark: true,
    });
    const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
    const [isMoveToDropdownOpen, setIsMoveToDropdownOpen] = useState(false);

    // Toast state
    const [toast, setToast] = useState<{
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    } | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const rowsPerPage = 100;

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // ✅ 2. UPDATE: Initialize widths with DEFAULT_WIDTHS
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('flipkart_goldenaura_notlisted_column_widths');
            return saved ? JSON.parse(saved) : DEFAULT_WIDTHS;
        }
        return DEFAULT_WIDTHS;
    });

    // ✅ 3. ADD: Resize Logic Ref
    const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

    // Column order state
    const [columnOrder, setColumnOrder] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('flipkart_goldenaura_notlisted_column_order');
            if (saved) {
                const parsedOrder = JSON.parse(saved);
                // ✅ Add remark if it's missing from saved order
                if (!parsedOrder.includes('remark')) {
                    parsedOrder.push('remark');
                }
                return parsedOrder;
            }
            return Object.keys(DEFAULT_WIDTHS);
        }
        return Object.keys(DEFAULT_WIDTHS);
    });

    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

    // Roll back state
    const [movementHistory, setMovementHistory] = useState<{
        [key: string]: {
            product: ProductRow;
            fromTable: string;
            toTable: string;
        } | null;
    }>({});

    // Reject Modal State
    const [rejectModal, setRejectModal] = useState<{
        isOpen: boolean;
        product: ProductRow | null;
    }>({
        isOpen: false,
        product: null,
    });
    // ✅ ADD THIS - Remark Modal State
    const [selectedRemark, setSelectedRemark] = useState<string | null>(null);


    const SELLER_ID = 1;

    const SELLER_CODE_MAP: Record<number, string> = {
        1: 'GR',
        2: 'RR',
        3: 'UB',
        4: 'VV',
        5: "DE",
        6: "CV",
    };

    // ✅ 4. ADD: Resize Handlers
    const startResize = (key: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = { key, startX: e.pageX, startWidth: columnWidths[key] || 100 };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizeRef.current) return;
        const { key, startX, startWidth } = resizeRef.current;
        const newWidth = Math.max(80, startWidth + (e.pageX - startX));
        setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
    };

    const handleMouseUp = () => {
        if (resizeRef.current) localStorage.setItem('flipkart_goldenaura_notlisted_column_widths', JSON.stringify(columnWidths));
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    const sanitizeSearchTerm = (term: string): string => {
        return term.replace(/'/g, "''").trim();
    };

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Ctrl+Z keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.ctrlKey &&
                e.key === 'z' &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
            ) {
                e.preventDefault();
                handleRollBack();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [movementHistory, activeTab]);

    // ✅ NEW - Load movement history on initial page load
    useEffect(() => {
        fetchLastMovementHistory();
    }, []); // Empty dependency - runs once on mount


    // Fetch products
    useEffect(() => {
        fetchProducts(false);
        fetchLastMovementHistory();
    }, [activeTab, currentPage, debouncedSearch]);

    const fetchProducts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const tableName = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}`;
            const start = (currentPage - 1) * rowsPerPage;
            const end = start + rowsPerPage - 1;

            // ✅ ADD THIS: Map tab to database category format
            const categoryMap: Record<CategoryTab, string> = {
                'high_demand': 'HD',
                'low_demand': 'LD',
                'dropshipping': 'DP',
                'not_approved': 'not_approved',
                'reject': 'reject'
            };

            let query = supabase
                .from(tableName)
                .select('*', { count: 'exact' })
                .eq('category', categoryMap[activeTab]);  // ✅ FIXED: Now uses mapped value

            if (debouncedSearch.trim()) {
                const searchTerm = sanitizeSearchTerm(debouncedSearch).substring(0, 100);

                if (debouncedSearch.length > 100) {
                    setToast({
                        message: 'Search query too long - truncated to 100 characters',
                        type: 'warning',
                    });
                }

                query = query.or(
                    `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,funnel.ilike.%${searchTerm}%`
                );
            }

            const { data, error, count } = await query
                .range(start, end)
                .order('id', { ascending: true });

            if (error) {
                console.error('Supabase error:', error);
                setToast({
                    message: 'Search failed. Try using simpler keywords.',
                    type: 'error',
                });
                setProducts([]);
                setTotalCount(0);
                return;
            }

            // ✅ ADD DEBUG: Check fetched data
            console.log('🔍 NOT LISTED - FETCHED PRODUCTS:', data?.[0]);

            setProducts(data || []);
            setTotalCount(count || 0);
        } catch (error: any) {
            console.error('Error fetching products:', error);
            setToast({
                message: error?.message || 'Error loading products',
                type: 'error',
            });
            setProducts([]);
            setTotalCount(0);
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    // ✅ NEW FUNCTION - Fetch last movement from database
    const fetchLastMovementHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('flipkart_brand_checking_not_listed_seller_1_movement_history')
                .select('*')
                .eq('from_table', `flipkart_brand_checking_not_listed_seller_${SELLER_ID}`)
                .eq('from_category', activeTab)
                .order('moved_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('Error fetching movement history:', error);
                return;
            }

            if (data) {
                const product: ProductRow = {
                    id: '',
                    asin: data.asin,
                    product_name: data.product_name,
                    brand: data.brand,
                    funnel: data.funnel,
                    monthly_unit: data.monthly_unit,
                    product_link: data.product_link,
                    link: data.product_link, // ✅ ADD THIS LINE
                    amz_link: data.amz_link,
                    remark: data.remark,
                };

                setMovementHistory((prev) => ({
                    ...prev,
                    [`flipkart_brand_checking_not_listed_seller_${SELLER_ID}_${activeTab}`]: {
                        product,
                        fromTable: data.from_table,
                        toTable: data.to_table,
                    },
                }));
            } else {
                setMovementHistory((prev) => ({
                    ...prev,
                    [`flipkart_brand_checking_not_listed_seller_${SELLER_ID}_${activeTab}`]: null,
                }));
            }
        } catch (error) {
            console.error('Exception fetching movement history:', error);
        }
    };

    const saveToHistory = async (product: ProductRow, fromTable: string, toTable: string, fromCategory?: string, toCategory?: string) => {
        try {
            const { error } = await supabase
                .from(`flipkart_brand_checking_not_listed_seller_1_movement_history`)
                .insert({
                    asin: product.asin,
                    product_name: product.product_name,
                    brand: product.brand,
                    funnel: product.funnel,
                    monthly_unit: product.monthly_unit,
                    product_link: product.product_link,
                    amz_link: product.amz_link,
                    remark: product.remark,
                    from_table: fromTable,
                    to_table: toTable,
                    from_category: fromCategory,
                    to_category: toCategory,
                });

            if (error) throw error;

            setMovementHistory((prev) => ({
                ...prev,
                [`${fromTable}_${fromCategory}`]: { product, fromTable, toTable },
            }));
        } catch (error) {
            console.error('Error saving history:', error);
        }
    };

    const moveProduct = async (
        product: ProductRow,
        action: 'approved' | 'not_approved' | 'reject',
        reason?: string
    ) => {
        setProcessingId(product.id);
        try {
            let targetTable: string;
            const { id, working, reason: oldReason, category, ...productData } = product;
            const currentTable = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}`;

            if (action === 'approved') {
                targetTable = `flipkart_validation_main_file`;
                const SELLER_CODE = SELLER_CODE_MAP[SELLER_ID];

                const { data: existingRow, error: selectError } = await supabase
                    .from('flipkart_validation_main_file')
                    .select('id, seller_tag')
                    .eq('asin', product.asin)
                    .maybeSingle();

                if (selectError) console.warn('Validation select warning:', selectError);

                if (!existingRow) {
                    await supabase.from('flipkart_validation_main_file').insert({
                        asin: product.asin,
                        product_name: product.product_name,
                        brand: product.brand,
                        seller_tag: SELLER_CODE,
                        funnel: product.funnel,
                        no_of_seller: 1,
                        flipkart_link: product.link, // ✅ CHANGED: Use link field
                        amz_link: product.amz_link,
                        product_weight: null,
                        judgement: null,
                        remark: product.remark,
                    });
                } else {
                    const existingTags = existingRow.seller_tag?.split(',') ?? [];
                    if (!existingTags.includes(SELLER_CODE)) {
                        await supabase
                            .from('flipkart_validation_main_file')
                            .update({
                                seller_tag: [...existingTags, SELLER_CODE].join(','),
                                no_of_seller: existingTags.length + 1,
                            })
                            .eq('id', existingRow.id);
                    }
                }

                await saveToHistory(product, currentTable, targetTable, activeTab, undefined);
                await supabase.from(currentTable).delete().eq('id', product.id);
                await fetchProducts(true);
                setToast({ message: `Product moved to Validation Main File!`, type: 'success' });

            } else if (action === 'not_approved') {
                const { error: updateError } = await supabase
                    .from(currentTable)
                    .update({ category: 'not_approved' })
                    .eq('id', product.id);

                if (updateError) throw updateError;

                await saveToHistory(product, currentTable, currentTable, activeTab, 'not_approved');
                await fetchProducts(true);
                setToast({ message: `Product moved to Not Approved!`, type: 'success' });

            } else if (action === 'reject') {
                const { error: updateError } = await supabase
                    .from(currentTable)
                    .update({
                        category: 'reject',
                        reason: reason || 'No reason provided'
                    })
                    .eq('id', product.id);

                if (updateError) throw updateError;

                await saveToHistory(product, currentTable, currentTable, activeTab, 'reject');
                await fetchProducts(true);
                setToast({ message: `Product rejected!`, type: 'success' });
            }
        } catch (err: any) {
            console.error('Move product error:', err);
            setToast({ message: `Error: ${err.message}`, type: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleRollBack = async () => {
        const currentTable = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}`;
        const currentTableKey = `${currentTable}_${activeTab}`;
        const lastMovement = movementHistory[currentTableKey];

        if (!lastMovement) {
            setToast({ message: 'No recent movement to roll back from this tab', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const { product, fromTable, toTable } = lastMovement;
            const SELLER_CODE = SELLER_CODE_MAP[SELLER_ID];

            // ✅ Strip suffix to get actual table name
            const actualFromTable = fromTable.replace(/_high_demand$|_low_demand$|_dropshipping$|_not_approved$|_reject$/, '');

            // ✅ ADD THIS: Category mapping
            const categoryMap: Record<CategoryTab, string> = {
                'high_demand': 'HD',
                'low_demand': 'LD',
                'dropshipping': 'DP',
                'not_approved': 'not_approved',
                'reject': 'reject'
            };

            // ✅ Check if toTable is Validation (this is what we expect!)
            if (toTable === 'flipkart_validation_main_file') {

                // 1. Check if already exists in Not Listed
                const { data: existingInNotListed, error: checkError } = await supabase
                    .from(actualFromTable)
                    .select('asin')
                    .eq('asin', product.asin)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (existingInNotListed) {
                    setToast({
                        message: `Cannot undo: Product already exists in Not Listed`,
                        type: 'warning',
                    });
                    setMovementHistory((prev) => ({ ...prev, [currentTableKey]: null }));
                    await supabase
                        .from(`flipkart_brand_checking_not_listed_seller_${SELLER_ID}_movement_history`)
                        .delete()
                        .eq('asin', product.asin)
                        .eq('from_table', fromTable)
                        .eq('from_category', activeTab)
                        .order('moved_at', { ascending: false })
                        .limit(1);
                    setLoading(false);
                    return;
                }

                // 2. Re-insert into Not Listed with MAPPED category
                const { error: insertError } = await supabase.from(actualFromTable).insert({
                    asin: product.asin,
                    product_name: product.product_name,
                    brand: product.brand,
                    funnel: product.funnel,
                    monthly_unit: product.monthly_unit,
                    link: product.link || product.product_link,
                    amz_link: product.amz_link,
                    remark: product.remark,
                    category: categoryMap[activeTab],  // ✅ CHANGED: Now uses 'HD' instead of 'high_demand'
                });
                if (insertError) throw insertError;

                // 3. Remove from Validation
                const { data: validationRow, error: valError } = await supabase
                    .from(toTable)
                    .select('id, seller_tag, no_of_seller')
                    .eq('asin', product.asin)
                    .single();

                if (valError && valError.code !== 'PGRST116') throw valError;

                if (validationRow) {
                    const currentTags = validationRow.seller_tag ? validationRow.seller_tag.split(',') : [];
                    const newTags = currentTags.filter((tag: string) => tag.trim() !== SELLER_CODE);

                    if (newTags.length === 0) {
                        await supabase.from(toTable).delete().eq('asin', product.asin);
                    } else {
                        await supabase
                            .from(toTable)
                            .update({
                                seller_tag: newTags.join(','),
                                no_of_seller: newTags.length
                            })
                            .eq('id', validationRow.id);
                    }
                }

            } else {
                // ✅ Handle category changes within same table - only update category
                const { error: updateError } = await supabase
                    .from(actualFromTable)
                    .update({
                        category: categoryMap[activeTab]  // ✅ Only update category, don't touch reason
                    })
                    .eq('asin', product.asin);
                if (updateError) throw updateError;
            }

            await supabase
                .from(`flipkart_brand_checking_not_listed_seller_${SELLER_ID}_movement_history`)
                .delete()
                .eq('asin', product.asin)
                .eq('from_table', fromTable)
                .eq('from_category', activeTab)
                .order('moved_at', { ascending: false })
                .limit(1);

            setToast({ message: `✅ Rolled back: ${product.product_name}`, type: 'success' });
            setMovementHistory((prev) => ({ ...prev, [currentTableKey]: null }));
            await fetchProducts(true);

        } catch (error: any) {
            console.error('❌ Error rolling back:', error);
            setToast({
                message: error?.message || 'Rollback failed',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    // ✅ NEW FUNCTION: Move products from Reject to other tabs
    const handleMoveFromReject = async (targetTab: 'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved') => {
        if (selectedIds.size === 0) {
            setToast({ message: 'Please select products to move', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const selectedProducts = products.filter((p) => selectedIds.has(p.id));
            const currentTable = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}`;

            // ✅ ADD THIS: Category mapping
            const categoryMap: Record<'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved', string> = {
                'high_demand': 'HD',
                'low_demand': 'LD',
                'dropshipping': 'DP',
                'not_approved': 'not_approved'
            };

            let movedCount = 0;

            for (const product of selectedProducts) {
                const { error: updateError } = await supabase
                    .from(currentTable)
                    .update({
                        category: categoryMap[targetTab],  // ✅ CORRECT - uses 'HD' instead of 'high_demand'
                        reason: null
                    })
                    .eq('id', product.id);
                if (updateError) {
                    console.error('Update error:', updateError);
                    continue;
                }

                movedCount++;
            }

            if (movedCount > 0) {
                setToast({
                    message: `Successfully moved ${movedCount} product(s) to ${targetTab.replace('_', ' ')}`,
                    type: 'success',
                });
            }

            const targetTableKey = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}_${targetTab}`;
            if (movementHistory[targetTableKey]) {
                setMovementHistory((prev) => ({
                    ...prev,
                    [targetTableKey]: null,
                }));
            }

            setSelectedIds(new Set());
            setIsMoveToDropdownOpen(false);
            await fetchProducts(true);

        } catch (error: any) {
            console.error('Move from reject error:', error);
            setToast({ message: `Error: ${error.message}`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const PaginationControls = () => {
        const totalPages = Math.ceil(totalCount / rowsPerPage);
        return (
            <div className="sticky bottom-0 z-40 bg-slate-900 border-t border-slate-800 p-4">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                        Showing <span className="text-slate-200 font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
                        <span className="text-slate-200 font-medium">{Math.min(currentPage * rowsPerPage, totalCount)}</span> of{' '}
                        <span className="text-white font-bold">{totalCount}</span> products
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>
                        <span className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg font-mono flex items-center">
                            Page {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const handleDragStart = (columnName: string) => setDraggedColumn(columnName);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (targetColumn: string) => {
        if (!draggedColumn || draggedColumn === targetColumn) {
            setDraggedColumn(null); return;
        }
        const newOrder = [...columnOrder];
        const draggedIndex = newOrder.indexOf(draggedColumn);
        const targetIndex = newOrder.indexOf(targetColumn);
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedColumn);
        setColumnOrder(newOrder);
        localStorage.setItem('flipkart_goldenaura_notlisted_column_order', JSON.stringify(newOrder));
        setDraggedColumn(null);
    };

    const handleRejectConfirm = (reason: string) => {
        if (rejectModal.product) moveProduct(rejectModal.product, 'reject', reason);
        setRejectModal({ isOpen: false, product: null });
    };

    const handleSelectAll = (checked: boolean) => {
        checked ? setSelectedIds(new Set(products.map((p) => p.id))) : setSelectedIds(new Set());
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        checked ? newSelected.add(id) : newSelected.delete(id);
        setSelectedIds(newSelected);
    };

    const toggleColumn = (column: keyof typeof visibleColumns) => {
        setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
    };

    // ✅ 5. UPDATE: Enhanced Column Header (Center align + Resize)
    const renderColumnHeader = (columnKey: string, displayName: string) => {
        if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;
        return (
            <th
                key={columnKey}
                draggable
                onDragStart={() => handleDragStart(columnKey)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(columnKey)}
                // Added 'relative' and 'text-center'
                className="relative px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-slate-900 text-slate-400 border-r border-slate-800 cursor-move hover:bg-slate-800 transition-colors select-none group"
                style={{ width: columnWidths[columnKey], minWidth: 80 }}
            >
                <div className="flex items-center justify-center gap-2">
                    {displayName}
                </div>

                {/* Resize Handle */}
                <div
                    onMouseDown={(e) => startResize(columnKey, e)}
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/50 z-10"
                    onClick={(e) => e.stopPropagation()}
                />
            </th>
        );
    };

    const currentTableKey = `flipkart_brand_checking_not_listed_seller_${SELLER_ID}_${activeTab}`;
    const hasRollback = !!movementHistory[currentTableKey];

    // Tab Styles
    const tabStyles = (tabName: CategoryTab, colorClass: string, label: string) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden group ${activeTab === tabName
                ? `text-white bg-slate-800 shadow-[0_0_20px_-5px_currentColor] ${colorClass}`
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900 border border-transparent hover:border-slate-800'
                }`}
        >
            <span className="relative z-10 flex items-center gap-2">
                {label}
            </span>
            {activeTab === tabName && (
                <div className={`absolute inset-0 opacity-10 ${colorClass.replace('text-', 'bg-')}`} />
            )}
        </button>
    );
    // ------------------------------------------------------------------
    // ✅ FIX: 2. Main Dashboard Return (Outside the loading check)
    // ------------------------------------------------------------------
    return (
        <PageTransition>
            {/* Ensure requiredPage matches your Sidebar/DB key exactly */}
            <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">

                {/* HEADER */}
                <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800/60 pb-4 pt-6 px-6">
                    <div className="max-w-[1920px] mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                                        <LayoutList className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <h1 className="text-2xl font-bold tracking-tight text-white">Golden Aura (GA) - Not Listed Products</h1>
                                </div>
                                <p className="text-slate-400 pl-[3.25rem] text-sm">
                                    Review and process listing errors and approvals
                                </p>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                                <span>TOTAL: <span className="text-white font-bold">{totalCount}</span></span>
                                <span className="w-px h-3 bg-slate-700 mx-2" />
                                <span>SELECTED: <span className="text-indigo-400 font-bold">{selectedIds.size}</span></span>
                            </div>
                        </div>

                        {/* TABS */}
                        <div className="flex flex-wrap gap-2 mb-6 p-1 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit">
                            {tabStyles('high_demand', 'text-emerald-400', 'High Demand')}
                            {tabStyles('low_demand', 'text-blue-400', 'Low Demand')}
                            {tabStyles('dropshipping', 'text-amber-400', 'Dropshipping')}
                            {tabStyles('not_approved', 'text-rose-400', 'Not Approved')}
                            {tabStyles('reject', 'text-slate-400', 'Reject')}
                        </div>

                        {/* CONTROLS */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800 mb-2">
                            <div className="flex gap-3 w-full md:w-auto">
                                <div className="relative">
                                    <button
                                        onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                                        className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
                                    >
                                        <Columns className="w-4 h-4" /> Columns
                                    </button>
                                    {isColumnDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsColumnDropdownOpen(false)} />
                                            <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-3 z-20 w-56 animate-in fade-in zoom-in-95 duration-200">
                                                {Object.keys(visibleColumns).map((col) => (
                                                    <label key={col} className="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                                                            onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                                                            className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50"
                                                        />
                                                        <span className="text-sm text-slate-300 capitalize">{col.replace('_', ' ')}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 items-center w-full md:w-auto">
                                <div className="relative w-full md:w-72 group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search by ASIN, Name, Brand..."
                                        value={searchQuery}
                                        onChange={(e) => {                              // ← CHANGED THIS
                                            const value = e.target.value;                 // ← Get the typed text
                                            if (value.length > 100) {                     // ← Check if too long
                                                setToast({                                  // ← Show warning toast
                                                    message: 'Search query too long. Please use shorter keywords.',
                                                    type: 'warning',
                                                });
                                                return;                                     // ← Stop here, don't update search
                                            }
                                            setSearchQuery(value);                        // ← Update search if OK
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    />

                                </div>

                                {/* ✅ NEW: Move To Button (only on Reject tab) */}
                                {activeTab === 'reject' && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsMoveToDropdownOpen(!isMoveToDropdownOpen)}
                                            disabled={selectedIds.size === 0}
                                            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${selectedIds.size > 0
                                                ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-900/20'
                                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                                }`}
                                        >
                                            <ArrowUpDown className="w-4 h-4" /> Move To
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isMoveToDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsMoveToDropdownOpen(false)} />
                                                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-2 z-20 w-48 animate-in fade-in zoom-in-95 duration-200">
                                                    <button
                                                        onClick={() => handleMoveFromReject('high_demand')}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                                        High Demand
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveFromReject('low_demand')}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                        Low Demand
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveFromReject('dropshipping')}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-amber-500/10 hover:text-amber-400 rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                                        Dropshipping
                                                    </button>
                                                    <button
                                                        onClick={() => handleMoveFromReject('not_approved')}
                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-2"
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                                                        Not Approved
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={handleRollBack}
                                    disabled={!hasRollback}
                                    className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${hasRollback
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                        }`}
                                >
                                    <RotateCcw className="w-4 h-4" /> Undo
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="max-w-[1920px] mx-auto px-6 pb-6">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl shadow-black/20">
                        {loading ? (
                            <div className="h-96 flex flex-col items-center justify-center text-slate-500 gap-4">
                                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                <span className="text-sm font-medium tracking-wide animate-pulse">LOADING DATA...</span>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="h-96 flex flex-col items-center justify-center text-slate-600 gap-3">
                                <Filter className="w-12 h-12 text-slate-700" />
                                <p className="text-lg font-medium text-slate-400">No items found in {activeTab.replace('_', ' ')}</p>
                                <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
                            </div>
                        ) : (
                            <div className="relative h-[calc(100vh-320px)] overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                                <table className="w-full border-collapse text-left table-fixed" ref={tableRef}>
                                    <thead className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800 shadow-md">
                                        <tr>
                                            <th className="p-4 bg-slate-900 border-r border-slate-800 text-center sticky left-0 z-20" style={{ width: '60px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.size === products.length && products.length > 0}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                                                />
                                            </th>
                                            {columnOrder.map((col) => {
                                                const columnNames: Record<string, string> = {
                                                    asin: 'ASIN',
                                                    product_name: 'Product Name',
                                                    brand: 'Brand',
                                                    funnel: 'Funnel',
                                                    monthly_unit: 'Monthly Unit',
                                                    link: 'Product Link',        // ✅ CHANGED: from product_link to link
                                                    amz_link: 'AMZ Link',
                                                    reason: 'Reason',
                                                    remark: 'Remark',
                                                };
                                                if (col === 'reason' && activeTab !== 'reject') return null;
                                                return renderColumnHeader(col, columnNames[col]);
                                            })}
                                            {activeTab !== 'reject' && (
                                                <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-slate-400 bg-slate-900" style={{ width: '220px' }}>Actions</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {products.map((product, index) => (
                                            <tr key={product.id} className={`group hover:bg-slate-800/40 transition-colors ${selectedIds.has(product.id) ? 'bg-indigo-900/10' : ''}`}>
                                                <td className="p-3 text-center bg-slate-950/50 sticky left-0 z-10 border-r border-slate-800 group-hover:bg-slate-900 transition-colors" style={{ width: '60px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 w-4 h-4 cursor-pointer"
                                                    />
                                                </td>
                                                {columnOrder.map((col) => {
                                                    if (col === 'reason' && activeTab !== 'reject') return null;
                                                    if (!visibleColumns[col as keyof typeof visibleColumns]) return null;

                                                    return (
                                                        <td
                                                            key={col}
                                                            className={`px-4 py-3 text-sm border-r border-slate-800/50 ${col === 'product_name' ? 'text-left' : 'text-center'
                                                                } ${col === 'link' || col === 'amz_link' ? '' : 'truncate'}`}  // ✅ CHANGED
                                                            style={{ width: columnWidths[col], maxWidth: columnWidths[col] }}
                                                        >
                                                            {/* ✅ PRODUCT LINK or AMZ LINK */}
                                                            {col === 'link' || col === 'amz_link' ? (  // ✅ CHANGED: from product_link to link
                                                                product[col as keyof ProductRow] ? (
                                                                    <a
                                                                        href={String(product[col as keyof ProductRow])}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all text-xs font-medium border border-indigo-500/20"
                                                                    >
                                                                        {col === 'link' ? 'Product' : 'Seller'}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-slate-600">-</span>
                                                                )

                                                                /* ✅ FUNNEL BADGE */
                                                            ) : col === 'funnel' ? (
                                                                <FunnelBadge funnel={product.funnel} />

                                                                /* ✅ REMARK MODAL */
                                                            ) : col === 'remark' ? (
                                                                product.remark ? (
                                                                    <button
                                                                        onClick={() => setSelectedRemark(product.remark || '')}
                                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                                                    >
                                                                        View
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-slate-600">-</span>
                                                                )

                                                                /* ✅ REASON (Reject tab only) */
                                                            ) : col === 'reason' ? (
                                                                <span className="text-rose-400" title={product.reason || 'No reason'}>
                                                                    {product.reason || 'No reason'}
                                                                </span>

                                                                /* ✅ PRODUCT NAME (left-aligned) */
                                                            ) : col === 'product_name' ? (
                                                                <span className="text-slate-200 font-medium" title={product.product_name || '-'}>
                                                                    {product.product_name}
                                                                </span>

                                                                /* ✅ ALL OTHER COLUMNS */
                                                            ) : (
                                                                <span className="text-slate-400" title={String(product[col as keyof ProductRow] || '-')}>
                                                                    {String(product[col as keyof ProductRow] || '-')}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                {activeTab !== 'reject' && (
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button
                                                                onClick={() => moveProduct(product, 'approved')}
                                                                disabled={processingId === product.id}
                                                                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-all text-xs font-bold"
                                                            >
                                                                {processingId === product.id ? '...' : 'Approve'}
                                                            </button>
                                                            {activeTab !== 'not_approved' && (
                                                                <button
                                                                    onClick={() => moveProduct(product, 'not_approved')}
                                                                    disabled={processingId === product.id}
                                                                    className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500 hover:text-white disabled:opacity-50 transition-all text-xs font-bold"
                                                                >
                                                                    Not Appr.
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setRejectModal({ isOpen: true, product })}
                                                                disabled={processingId === product.id}
                                                                className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white disabled:opacity-50 transition-all text-xs font-bold"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {!loading && products.length > 0 && <PaginationControls />}
                </div>

                <RejectModal
                    isOpen={rejectModal.isOpen}
                    productName={rejectModal.product?.product_name || 'Unknown Product'}
                    onClose={() => setRejectModal({ isOpen: false, product: null })}
                    onConfirm={handleRejectConfirm}
                />

                {toast && (
                    <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
                )}
                {/* ✅ ADD THIS - Remark Modal */}
                {selectedRemark && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">Remark Details</h3>
                                <button
                                    onClick={() => setSelectedRemark(null)}
                                    className="text-slate-400 hover:text-white text-2xl transition-colors p-2 hover:bg-slate-800 rounded-lg"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="whitespace-pre-wrap text-slate-200 bg-slate-800 p-4 rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
                                {selectedRemark}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
}