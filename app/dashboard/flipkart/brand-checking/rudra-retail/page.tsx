'use client';

import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react';
import PageTransition from '@/components/layout/PageTransition';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import FunnelBadge from '../../../../components/FunnelBadge';
import { generateAmazonLink } from '@/lib/utils';
import {
  Search,
  RotateCcw,
  LayoutList,
  Columns,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
const formatUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

interface ProductRow {
  id: string;
  asin: string;
  link: string | null;          // ✅ CHANGED: from product_link to link
  product_name: string | null;
  brand: string | null;
  funnel: string | null;
  monthly_unit: number | null;
  amz_link: string | null;
  working?: boolean;
  reason?: string | null;
  remark?: string | null;
  // ✅ ADD THESE MISSING FIELDS
  source_id?: string | null;
  tag?: string | null;
  price?: number | null;
  monthly_sales?: number | null;
  bsr?: number | null;
  seller?: string | null;
  dimensions?: string | null;
  weight?: number | null;
  weight_unit?: string | null;
  journey_number?: number | null;
  status?: string | null;
}


type CategoryTab = 'high_demand' | 'low_demand' | 'dropshipping';

const DEFAULT_WIDTHS: Record<string, number> = {
  asin: 140,
  product_name: 350,
  brand: 160,
  funnel: 110,
  monthly_unit: 120,
  link: 100,           // ✅ FIXED
  amz_link: 100,
  remark: 200,
};

export default function RudraRetailPage() {
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
    link: true,          // ✅ FIXED
    amz_link: true,
    remark: true,
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

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

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flipkart_rudraretail_column_widths');
      return saved ? JSON.parse(saved) : DEFAULT_WIDTHS;
    }
    return DEFAULT_WIDTHS;
  });

  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flipkart_rudraretail_column_order');
      return saved ? JSON.parse(saved) : Object.keys(DEFAULT_WIDTHS);
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

  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);
  const SELLER_ID = 2;

  const SELLER_CODE_MAP: Record<number, string> = {
    1: 'GA',
    2: 'RR',
    3: 'UB',
    4: 'VV',
    5: "DE",
    6: "CV",
  };

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
    if (resizeRef.current) localStorage.setItem('flipkart_rudraretail_column_widths', JSON.stringify(columnWidths));
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const sanitizeSearchTerm = (term: string): string => {
    return term.replace(/'/g, "''").trim();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  useEffect(() => {
    fetchLastMovementHistory();
  }, []);

  useEffect(() => {
    fetchProducts(false);
    fetchLastMovementHistory();
  }, [activeTab, currentPage, debouncedSearch]);

  const fetchProducts = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const tableName = `flipkart_brand_checking_seller_${SELLER_ID}`;
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage - 1;

      let query = supabase
        .from(tableName)
        .select('*', { count: 'exact' });

      // ✅ ALWAYS filter by funnel based on active tab
      // ✅ NEW CODE — actually filters by funnel values
      const funnelValues: Record<CategoryTab, string[]> = {
        high_demand: ['HD', 'high_demand', 'highdemand'],
        low_demand: ['LD', 'low_demand', 'lowdemand'],
        dropshipping: ['DP', 'dropshipping'],
      };
      query = query.in('funnel', funnelValues[activeTab]);

      // ✅ THEN apply search if present
      if (debouncedSearch.trim()) {
        const searchTerm = sanitizeSearchTerm(debouncedSearch).substring(0, 100);

        if (debouncedSearch.length > 100) {
          setToast({
            message: 'Search query too long - truncated to 100 characters',
            type: 'warning',
          });
        }

        query = query.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
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

  const fetchLastMovementHistory = async () => {
    try {
      // ✅ Build tab-specific table name
      const funnelMap: Record<CategoryTab, string> = {
        'high_demand': 'hd',
        'low_demand': 'ld',
        'dropshipping': 'dp'
      };

      const currentTable = `flipkart_brand_checking_seller_${SELLER_ID}_${funnelMap[activeTab]}`;

      const { data, error } = await supabase
        .from('flipkart_seller_2_rudra_retail_movement_history')
        .select('*')
        .eq('from_table', currentTable)  // ✅ Now tab-specific
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
          link: data.product_link,
          amz_link: data.amz_link,
          remark: data.remark,
        };

        setMovementHistory((prev) => ({
          ...prev,
          [currentTable]: {
            product,
            fromTable: data.from_table,
            toTable: data.to_table,
          },
        }));
      } else {
        setMovementHistory((prev) => ({
          ...prev,
          [currentTable]: null,
        }));
      }
    } catch (error) {
      console.error('Exception fetching movement history:', error);
    }
  };

  const saveToHistory = async (product: ProductRow, fromTable: string, toTable: string) => {
    try {
      // ✅ Add funnel suffix to track per-tab movements
      const funnelSuffix = product.funnel?.toLowerCase() || 'unknown';
      const fromTableWithFunnel = `${fromTable}_${funnelSuffix}`;

      const { error } = await supabase
        .from(`flipkart_seller_${SELLER_ID}_rudra_retail_movement_history`)
        .insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          funnel: product.funnel,
          monthly_unit: product.monthly_unit,
          product_link: product.link,
          amz_link: product.amz_link,
          remark: product.remark,
          from_table: fromTableWithFunnel,  // ✅ Saved with funnel suffix
          to_table: toTable,
        });

      if (error) throw error;

      setMovementHistory((prev) => ({
        ...prev,
        [fromTableWithFunnel]: { product, fromTable: fromTableWithFunnel, toTable },
      }));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  // ✅ NEW FUNCTION - Handle List/Not List Actions
  const handleListingAction = async (product: ProductRow, action: 'listed' | 'not_listed') => {
    setProcessingId(product.id);

    // ✅ OPTIMISTIC UI — remove row instantly, don't wait for DB
    setProducts(prev => prev.filter(p => p.id !== product.id));
    setTotalCount(prev => prev - 1);

    try {
      const currentTable = `flipkart_brand_checking_seller_${SELLER_ID}`;
      const targetTable = `flipkart_brand_checking_${action}_seller_${SELLER_ID}`;

      // 1. Check if already exists in target (this one must go first)
      const { data: existingRow, error: checkError } = await supabase
        .from(targetTable)
        .select('asin')
        .eq('asin', product.asin)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRow) {
        // ⚠️ ROLLBACK optimistic update — put row back
        setProducts(prev => [...prev, product].sort((a, b) => a.id.localeCompare(b.id)));
        setTotalCount(prev => prev + 1);
        setToast({ message: `Product already in ${action === 'listed' ? 'Listed' : 'Not Listed'}`, type: 'warning' });
        setProcessingId(null);
        return;
      }

      // 2. Insert into target table (don't await yet — fire it)
      const insertPromise = supabase
        .from(targetTable)
        .insert({
          source_id: product.source_id,
          tag: product.tag || (SELLER_CODE_MAP[SELLER_ID] || 'GA'),
          asin: product.asin,
          link: product.link,
          product_name: product.product_name,
          brand: product.brand,
          price: product.price,
          monthly_unit: product.monthly_unit,
          monthly_sales: product.monthly_sales,
          bsr: product.bsr,
          seller: product.seller,
          category: product.funnel,
          dimensions: product.dimensions,
          weight: product.weight,
          weight_unit: product.weight_unit,
          remark: product.remark,
          amz_link: product.amz_link,
          funnel: product.funnel,
          journey_number: product.journey_number || 1,
          status: product.status,
          listing_status: action,
        });

      // 3. Save to history (fire it, don't await yet)
      const historyPromise = saveToHistory(product, currentTable, targetTable);

      // 4. Delete from brand checking table (fire it)
      const deleteMainPromise = supabase
        .from(currentTable)
        .delete()
        .eq('asin', product.asin);

      // 5. Delete from funnel sub-table (fire it)
      const funnelTableSuffix: Record<string, string> = {
        'hd': 'high_demand', 'highdemand': 'high_demand', 'high_demand': 'high_demand',
        'dp': 'dropshipping', 'dropshipping': 'dropshipping',
        'ld': 'low_demand', 'low_demand': 'low_demand', 'lowdemand': 'low_demand',
      };
      const suffix = funnelTableSuffix[product.funnel?.toLowerCase() || ''] || 'low_demand';
      const funnelTable = `flipkart_seller_${SELLER_ID}_${suffix}`;
      const deleteFunnelPromise = supabase.from(funnelTable).delete().eq('asin', product.asin);

      // ✅ Run ALL 4 operations in PARALLEL
      const [insertResult, , deleteMainResult, deleteFunnelResult] = await Promise.all([
        insertPromise,
        historyPromise,
        deleteMainPromise,
        deleteFunnelPromise,
      ]);

      // Check for errors from parallel operations
      if (insertResult.error) throw insertResult.error;
      if (deleteMainResult.error) throw deleteMainResult.error;
      if (deleteFunnelResult.error) console.warn('Funnel delete warning:', deleteFunnelResult.error);

      setToast({
        message: `Moved to ${action === 'listed' ? 'Listed' : 'Not Listed'}!`,
        type: 'success'
      });

      // ✅ NO fetchProducts() call — optimistic UI already handled it

    } catch (error: any) {
      console.error('Error:', error);
      // ⚠️ ROLLBACK — re-add product on failure
      setProducts(prev => [...prev, product].sort((a, b) => a.id.localeCompare(b.id)));
      setTotalCount(prev => prev + 1);
      setToast({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRollBack = async () => {
    const funnelMap: Record<CategoryTab, string> = {
      'high_demand': 'hd',
      'low_demand': 'ld',
      'dropshipping': 'dp'
    };
    const currentTable = `flipkart_brand_checking_seller_${SELLER_ID}_${funnelMap[activeTab]}`;
    const lastMovement = movementHistory[currentTable];

    if (!lastMovement) {
      setToast({ message: 'No recent movement to roll back from this tab', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { product, fromTable, toTable } = lastMovement;

      // ✅ Strip funnel suffix from table names
      const actualFromTable = fromTable.replace(/_hd$|_ld$|_dp$/, '');
      const actualToTable = toTable.replace(/_hd$|_ld$|_dp$/, '');

      // ✅ Check if product already exists in Brand Checking
      const { data: existingProduct, error: checkError } = await supabase
        .from(actualFromTable)
        .select('asin')
        .eq('asin', product.asin)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingProduct) {
        setToast({
          message: `Cannot undo: Product "${product.product_name}" already exists in the table`,
          type: 'warning',
        });

        setMovementHistory((prev) => ({ ...prev, [currentTable]: null }));

        await supabase
          .from(`flipkart_seller_${SELLER_ID}_rudra_retail_movement_history`)
          .delete()
          .eq('asin', product.asin)
          .eq('from_table', fromTable)
          .eq('to_table', toTable)
          .order('moved_at', { ascending: false })
          .limit(1);

        setLoading(false);
        return;
      }

      // ✅ Re-insert into Brand Checking
      const { error: insertError } = await supabase.from(actualFromTable).insert({
        asin: product.asin,
        product_name: product.product_name,
        brand: product.brand,
        funnel: product.funnel,
        monthly_unit: product.monthly_unit,
        link: product.link,
        amz_link: product.amz_link,
        remark: product.remark,
      });

      if (insertError) throw insertError;

      // ✅ Delete from Listed/Not Listed (toTable)
      const { error: deleteError } = await supabase
        .from(actualToTable)
        .delete()
        .eq('asin', product.asin);

      if (deleteError) throw deleteError;

      // Delete history
      await supabase
        .from(`flipkart_seller_${SELLER_ID}_rudra_retail_movement_history`)
        .delete()
        .eq('asin', product.asin)
        .eq('from_table', fromTable)
        .eq('to_table', toTable)
        .order('moved_at', { ascending: false })
        .limit(1);

      setToast({ message: `✅ Rolled back: ${product.product_name}`, type: 'success' });
      setMovementHistory((prev) => ({ ...prev, [currentTable]: null }));
      fetchProducts(true);
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

  const PaginationControls = () => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    return (
      <div className="sticky bottom-0 z-40 bg-[#111111] border-t border-white/[0.1] p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300">
            Showing <span className="text-gray-100 font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
            <span className="text-gray-100 font-medium">{Math.min(currentPage * rowsPerPage, totalCount)}</span> of{' '}
            <span className="text-white font-bold">{totalCount}</span> products
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg font-mono flex items-center">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
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
    localStorage.setItem('flipkart_rudraretail_column_order', JSON.stringify(newOrder));
    setDraggedColumn(null);
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

  const renderColumnHeader = (columnKey: string, displayName: string) => {
    if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;
    return (
      <th
        key={columnKey}
        draggable
        onDragStart={() => handleDragStart(columnKey)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(columnKey)}
        className="relative px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-[#111111] text-gray-400 border-r border-white/[0.1] cursor-move hover:bg-[#111111] transition-colors select-none group"
        style={{ width: columnWidths[columnKey], minWidth: 80 }}
      >
        <div className="flex items-center justify-center gap-2">
          {displayName}
        </div>
        <div
          onMouseDown={(e) => startResize(columnKey, e)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/[0.08] z-10"
          onClick={(e) => e.stopPropagation()}
        />
      </th>
    );
  };

  const funnelMap: Record<CategoryTab, string> = {
    'high_demand': 'hd',
    'low_demand': 'ld',
    'dropshipping': 'dp'
  };
  const currentTable = `flipkart_brand_checking_seller_${SELLER_ID}_${funnelMap[activeTab]}`;
  const hasRollback = !!movementHistory[currentTable];

  const tabStyles = (tabName: CategoryTab, colorClass: string, label: string) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative overflow-hidden group ${activeTab === tabName
        ? `bg-orange-500 text-white font-semibold shadow-sm`
        : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
        }`}
    >
      <span className="relative z-10 flex items-center gap-2">
        {label}
      </span>
      {false && (
        <div className={`absolute inset-0 opacity-10 ${colorClass.replace('text-', 'bg-')}`} />
      )}
    </button>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#111111] text-gray-100 font-sans selection:bg-orange-400/30">
        {/* HEADER */}
        <div className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-white/[0.1] pb-4 pt-6 px-6">
          <div className="max-w-[1920px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <LayoutList className="w-6 h-6 text-orange-500" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white">Rudra Retail - Brand Checking</h1>
                </div>
                <p className="text-gray-400 pl-[3.25rem] text-sm">
                  Decide which products to list or not list
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-gray-300 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.1]">
                <span>TOTAL: <span className="text-white font-bold">{totalCount}</span></span>
                <span className="w-px h-3 bg-[#1a1a1a] mx-2" />
                <span>SELECTED: <span className="text-orange-500 font-bold">{selectedIds.size}</span></span>
              </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-6 p-1 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-fit">
              {tabStyles('high_demand', 'text-emerald-400', 'High Demand')}
              {tabStyles('low_demand', 'text-blue-400', 'Low Demand')}
              {tabStyles('dropshipping', 'text-amber-400', 'Dropshipping')}
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-[#1a1a1a] p-3 rounded-xl border border-white/[0.1] mb-2">
              <div className="flex gap-3 w-full md:w-auto">
                <div className="relative">
                  <button
                    onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                    className="px-4 py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Columns className="w-4 h-4" /> Columns
                  </button>
                  {isColumnDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsColumnDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-2 bg-[#111111] border border-white/[0.1] rounded-xl shadow-xl p-3 z-20 w-56 animate-in fade-in zoom-in-95 duration-200">
                        {Object.keys(visibleColumns).map((col) => (
                          <label key={col} className="flex items-center gap-3 p-2 hover:bg-[#111111] rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns[col as keyof typeof visibleColumns]}
                              onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                              className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                            />
                            <span className="text-sm text-gray-300 capitalize">{col.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 items-center w-full md:w-auto">
                <div className="relative w-full md:w-72 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by ASIN, Name, Brand..."
                    value={searchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.length > 100) {
                        setToast({
                          message: 'Search query too long. Please use shorter keywords.',
                          type: 'warning',
                        });
                        return;
                      }
                      setSearchQuery(value);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-100 placeholder:text-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all"
                  />
                </div>

                <button
                  onClick={handleRollBack}
                  disabled={!hasRollback}
                  className={`px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${hasRollback
                    ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/10'
                    : 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
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
          <div className="bg-[#111111] rounded-2xl border border-white/[0.1] overflow-hidden shadow-xl shadow-black/20">
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-4">
                <div className="w-10 h-10 border-4 border-orange-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <span className="text-sm font-medium tracking-wide animate-pulse">LOADING DATA...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-3">
                <Filter className="w-12 h-12 text-gray-500" />
                <p className="text-lg font-medium text-gray-400">No items found in {activeTab.replace('_', ' ')}</p>
                <p className="text-sm text-gray-300">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="relative h-[calc(100vh-320px)] overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                <table className="w-full border-collapse text-left table-fixed" ref={tableRef}>
                  <thead className="sticky top-0 z-30 bg-[#111111] border-b border-white/[0.1] shadow-md">
                    <tr>
                      <th className="p-4 bg-[#111111] border-r border-white/[0.1] text-center sticky left-0 z-20" style={{ width: '60px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === products.length && products.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                        />
                      </th>
                      {columnOrder.map((col) => {
                        const columnNames: Record<string, string> = {
                          asin: 'ASIN',
                          product_name: 'Product Name',
                          brand: 'Brand',
                          funnel: 'Funnel',
                          monthly_unit: 'Monthly Unit',
                          link: 'Product Link',        // ✅ CHANGED: key is 'link', display is 'Product Link'
                          amz_link: 'AMZ Link',
                          reason: 'Reason',
                          remark: 'Remark',
                        };
                        return renderColumnHeader(col, columnNames[col]);
                      })}
                      <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-gray-400 bg-[#111111]" style={{ width: '200px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {products.map((product) => (
                      <tr key={product.id} className={`group hover:bg-white/[0.05] transition-colors ${selectedIds.has(product.id) ? 'bg-orange-500/10' : ''}`}>
                        <td className="p-3 text-center bg-[#1a1a1a] sticky left-0 z-10 border-r border-white/[0.1] group-hover:bg-[#111111] transition-colors" style={{ width: '60px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                            className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        {columnOrder.map((col) => {
                          if (!visibleColumns[col as keyof typeof visibleColumns]) return null;

                          return (
                            <td key={col}
                              className={`px-4 py-3 text-sm border-r border-white/[0.1] truncate ${col === 'product_name' ? 'text-left' : 'text-center'}`}
                              style={{ width: columnWidths[col], maxWidth: columnWidths[col] }}
                              title={String(product[col as keyof ProductRow] || '-')}
                            >
                              {col === 'funnel' ? (
                                (() => {
                                  if (!product.funnel) return <span className="text-gray-500">-</span>;

                                  const funnelDisplay: Record<string, { tag: string; bgColor: string }> = {
                                    'high_demand': { tag: 'HD', bgColor: 'bg-emerald-500' },
                                    'hd': { tag: 'HD', bgColor: 'bg-emerald-500' },
                                    'dropshipping': { tag: 'DP', bgColor: 'bg-amber-500' },
                                    'dp': { tag: 'DP', bgColor: 'bg-amber-500' },
                                    'low_demand': { tag: 'LD', bgColor: 'bg-blue-500' },
                                    'ld': { tag: 'LD', bgColor: 'bg-blue-500' },
                                  };

                                  const config = funnelDisplay[product.funnel.toLowerCase()] || {
                                    tag: product.funnel.substring(0, 2).toUpperCase(),
                                    bgColor: 'bg-slate-600'
                                  };

                                  return (
                                    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold text-white shadow-lg ${config.bgColor}`}>
                                      {config.tag}
                                    </span>
                                  );
                                })()
                              ) : col === 'remark' ? (
                                product.remark ? (
                                  <button
                                    onClick={() => setSelectedRemark(product.remark || '')}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )
                              ) : col === 'link' ? (  // ✅ FIXED - added `) :`
                                product.link ? (
                                  <a
                                    href={formatUrl(product.link) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-xs font-medium border border-blue-500/20"
                                  >
                                    Product
                                  </a>
                                ) : <span className="text-gray-500">-</span>

                              ) : col === 'amz_link' ? (
                                product.amz_link ? (
                                  <a
                                    href={formatUrl(product.amz_link) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-medium border border-emerald-500/20"
                                  >
                                    Seller
                                  </a>
                                ) : <span className="text-gray-500">-</span>

                                // ) : col === 'funnel' ? (
                                //   <FunnelBadge funnel={product.funnel} />

                              ) : col === 'remark' ? (
                                product.remark ? (
                                  <button
                                    onClick={() => setSelectedRemark(product.remark || '')}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    View
                                  </button>
                                ) : <span className="text-gray-500">-</span>

                              ) : col === 'product_name' ? (
                                <span className="text-gray-100 font-medium">{product.product_name}</span>

                              ) : (
                                <span className="text-gray-400">{String(product[col as keyof ProductRow] || '-')}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleListingAction(product, 'listed')}
                              disabled={processingId === product.id}
                              className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500 hover:text-white disabled:opacity-50 transition-all text-xs font-bold"
                            >
                              {processingId === product.id ? '...' : '✓ List'}
                            </button>
                            <button
                              onClick={() => handleListingAction(product, 'not_listed')}
                              disabled={processingId === product.id}
                              className="px-3 py-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500 hover:text-white disabled:opacity-50 transition-all text-xs font-bold"
                            >
                              {processingId === product.id ? '...' : '✗ Not List'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && products.length > 0 && <PaginationControls />}
        </div>

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        {selectedRemark && (
          <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Remark Details</h3>
                <button
                  onClick={() => setSelectedRemark(null)}
                  className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
                >
                  ×
                </button>
              </div>
              <div className="whitespace-pre-wrap text-gray-100 bg-[#111111] p-4 rounded-lg border border-white/[0.1] max-h-96 overflow-y-auto">
                {selectedRemark}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
