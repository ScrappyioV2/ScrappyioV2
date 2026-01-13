'use client';

import { useState, useEffect, useRef } from 'react';
import PageTransition from '@/components/layout/PageTransition';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import RejectModal from '../../../../components/RejectModal';
import FunnelBadge from '../../../../components/FunnelBadge';
import { generateAmazonLink } from '@/lib/utils';

interface ProductRow {
  id: string;
  asin: string;
  product_name: string | null;
  brand: string | null;
  funnel: string | null;
  monthly_unit: number | null;
  product_link: string | null;
  amz_link: string | null;
  working?: boolean;
  reason?: string | null;
}

type CategoryTab = 'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved' | 'reject';

export default function GoldenAuraPage() {
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
    product_link: true,
    amz_link: true,
    reason: true,
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

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golden_aura_column_widths');
      return saved ? JSON.parse(saved) : {
        asin: 120,
        product_name: 250,
        brand: 150,
        funnel: 100,
        monthly_unit: 120,
        product_link: 100,
        amz_link: 100,
        reason: 200
      };
    }
    return {
      asin: 120,
      product_name: 250,
      brand: 150,
      funnel: 100,
      monthly_unit: 120,
      product_link: 100,
      amz_link: 100,
      reason: 200
    };
  });

  // Column order state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golden_aura_column_order');
      return saved ? JSON.parse(saved) : ['asin', 'product_name', 'brand', 'funnel', 'monthly_unit', 'product_link', 'amz_link', 'reason'];
    }
    return ['asin', 'product_name', 'brand', 'funnel', 'monthly_unit', 'product_link', 'amz_link', 'reason'];
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

  const SELLER_ID = 1;

  const getSellerName = (sellerId: string) => {
    const sellerNames: { [key: string]: string } = {
      '1': 'Golden Aura',
      '2': 'Rudra Retail',
      '3': 'UBeauty',
      '4': 'Velvet Vista',
    };
    return sellerNames[sellerId] || 'Unknown';
  };

  // Sanitize search term to avoid Supabase query errors
  const sanitizeSearchTerm = (term: string): string => {
    // Escape special characters that break Supabase queries
    return term
      .replace(/'/g, "''")  // Escape single quotes by doubling them
      .trim();
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

  // Fetch products
  useEffect(() => {
    fetchProducts();
  }, [activeTab, currentPage, debouncedSearch]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const tableName = `usa_seller_${SELLER_ID}_${activeTab}`;
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage - 1;

      let query = supabase.from(tableName).select('*', { count: 'exact' });

      // Apply search filter with proper escaping
      if (debouncedSearch.trim()) {
        const searchTerm = sanitizeSearchTerm(debouncedSearch);
        
        // Use textSearch or individual filters
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
          message: 'Search failed. Try using simpler keywords without special characters.',
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
      setLoading(false);
    }
  };

  const saveToHistory = async (
    product: ProductRow,
    fromTable: string,
    toTable: string
  ) => {
    try {
      const { error } = await supabase
        .from('usa_seller_1_golden_aura_movement_history')
        .insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          funnel: product.funnel,
          monthly_unit: product.monthly_unit,
          product_link: product.product_link,
          amz_link: product.amz_link,
          from_table: fromTable,
          to_table: toTable,
        });

      if (error) throw error;

      setMovementHistory((prev) => ({
        ...prev,
        [fromTable]: { product, fromTable, toTable },
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
      let targetTable: string = '';
      let dataToInsert: any = {};

      const { id, working, reason: oldReason, ...productData } = product;

      if (action === 'approved') {
        targetTable = 'usa_validation_main_file';
        dataToInsert = {
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          seller_tag: getSellerName(SELLER_ID.toString()),
          funnel: product.funnel,
          no_of_seller: 1,
          usa_link: product.amz_link,
          india_price: null,
          product_weight: null,
          judgement: null,
        };
      } else if (action === 'not_approved') {
        targetTable = `usa_seller_${SELLER_ID}_not_approved`;
        dataToInsert = productData;
      } else if (action === 'reject') {
        targetTable = `usa_seller_${SELLER_ID}_reject`;
        dataToInsert = {
          ...productData,
          reason: reason || 'No reason provided',
        };
      } else {
        console.error('Invalid action:', action);
        setProcessingId(null);
        return;
      }

      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(dataToInsert);

      if (insertError) {
        console.error('Error inserting product:', insertError);
        setToast({
          message: `Failed to move product: ${insertError.message}`,
          type: 'error',
        });
        return;
      }

      const currentTable = `usa_seller_${SELLER_ID}_${activeTab}`;
      await saveToHistory(product, currentTable, targetTable);

      const { error: deleteError } = await supabase
        .from(currentTable)
        .delete()
        .eq('id', product.id);

      if (deleteError) {
        console.error('Error deleting product:', deleteError);
        setToast({
          message: 'Failed to delete product from current table',
          type: 'error',
        });
        return;
      }

      await fetchProducts();

      const actionText =
        action === 'approved'
          ? 'Validation Main File'
          : action === 'not_approved'
          ? 'Not Approved'
          : 'Reject';
      setToast({
        message: `Product moved to ${actionText} successfully!`,
        type: 'success',
      });
    } catch (err) {
      console.error('Move product error:', err);
      setToast({
        message: 'An error occurred while moving the product',
        type: 'error',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRollBack = async () => {
    const currentTable = `usa_seller_${SELLER_ID}_${activeTab}`;
    const lastMovement = movementHistory[currentTable];

    if (!lastMovement) {
      setToast({
        message: 'No recent movement to roll back from this tab',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const { product, fromTable, toTable } = lastMovement;

      const { error: insertError } = await supabase.from(fromTable).insert({
        asin: product.asin,
        product_name: product.product_name,
        brand: product.brand,
        funnel: product.funnel,
        monthly_unit: product.monthly_unit,
        product_link: product.product_link,
        amz_link: product.amz_link,
      });

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from(toTable)
        .delete()
        .eq('asin', product.asin);

      if (deleteError) throw deleteError;

      await supabase
        .from('usa_seller_1_golden_aura_movement_history')
        .delete()
        .eq('asin', product.asin)
        .eq('from_table', fromTable)
        .eq('to_table', toTable)
        .order('moved_at', { ascending: false })
        .limit(1);

      setToast({
        message: `Rolled back: ${product.product_name}`,
        type: 'success',
      });

      setMovementHistory((prev) => ({
        ...prev,
        [currentTable]: null,
      }));

      fetchProducts();
    } catch (error) {
      console.error('Error rolling back:', error);
      setToast({
        message: 'Rollback failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const PaginationControls = () => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);

    return (
      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-300 bg-gray-50">
        <div className="text-sm text-gray-600">
          Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
          {Math.min(currentPage * rowsPerPage, totalCount)} of {totalCount}{' '}
          products
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ◀ Previous
          </button>
          <div className="px-4 py-2 bg-gray-800 text-white rounded">
            Page {currentPage} of {totalPages}
          </div>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage >= totalPages}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next ▶
          </button>
        </div>
      </div>
    );
  };

  const handleColumnDoubleClick = (columnKey: string) => {
    if (!tableRef.current) return;

    const columnIndex = columnOrder.indexOf(columnKey) + 1;
    const cells = tableRef.current.querySelectorAll(`tr td:nth-child(${columnIndex + 1}), tr th:nth-child(${columnIndex + 1})`);
    
    let maxWidth = 80;
    cells.forEach((cell) => {
      const width = cell.scrollWidth + 20;
      if (width > maxWidth) maxWidth = width;
    });

    maxWidth = Math.min(maxWidth, 500);

    const newWidths = { ...columnWidths, [columnKey]: maxWidth };
    setColumnWidths(newWidths);
    localStorage.setItem('golden_aura_column_widths', JSON.stringify(newWidths));

    setToast({
      message: `Column resized to ${maxWidth}px`,
      type: 'success',
    });
  };

  const handleDragStart = (columnName: string) => {
    setDraggedColumn(columnName);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetColumn: string) => {
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(targetColumn);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);

    setColumnOrder(newOrder);
    localStorage.setItem('golden_aura_column_order', JSON.stringify(newOrder));
    setDraggedColumn(null);
  };

  const handleRejectConfirm = (reason: string) => {
    if (rejectModal.product) {
      moveProduct(rejectModal.product, 'reject', reason);
    }
    setRejectModal({ isOpen: false, product: null });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const renderColumnHeader = (
    columnKey: string,
    displayName: string,
    defaultWidth: number
  ) => {
    if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;

    return (
      <th
        key={columnKey}
        draggable
        onDragStart={() => handleDragStart(columnKey)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(columnKey)}
        onDoubleClick={() => handleColumnDoubleClick(columnKey)}
        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-100 cursor-move hover:bg-blue-50 transition-colors"
        style={{
          width: columnWidths[columnKey] || defaultWidth,
          minWidth: 80,
        }}
        title="Double-click to auto-fit width | Drag to reorder"
      >
        <div className="flex items-center justify-between select-none">
          <span>{displayName}</span>
          <span className="text-xs text-gray-400 ml-2">⇄</span>
        </div>
      </th>
    );
  };

  const currentTable = `usa_seller_${SELLER_ID}_${activeTab}`;
  const hasRollback = !!movementHistory[currentTable];

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50">
        {/* STICKY HEADER SECTION */}
        <div className="sticky top-0 z-50 bg-gray-50 pb-4">
          <div className="max-w-full mx-auto p-6 pb-0">
            {/* Title Header */}
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">
                Golden Aura - Brand Checking
              </h1>
              <p className="text-gray-600 mt-1">
                Manage products across different categories
              </p>
            </div>

            {/* Horizontal Tabs */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setActiveTab('high_demand')}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                  activeTab === 'high_demand'
                    ? 'bg-green-400 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                High Demand
              </button>
              <button
                onClick={() => setActiveTab('low_demand')}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                  activeTab === 'low_demand'
                    ? 'bg-blue-400 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Low Demand
              </button>
              <button
                onClick={() => setActiveTab('dropshipping')}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                  activeTab === 'dropshipping'
                    ? 'bg-yellow-400 text-gray-900 shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Dropshipping
              </button>
              <button
                onClick={() => setActiveTab('not_approved')}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                  activeTab === 'not_approved'
                    ? 'bg-red-400 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Not Approved
              </button>
              <button
                onClick={() => setActiveTab('reject')}
                className={`px-8 py-4 text-lg font-semibold rounded-lg transition-all ${
                  activeTab === 'reject'
                    ? 'bg-gray-400 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Reject
              </button>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      Columns
                    </button>
                    {isColumnDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsColumnDropdownOpen(false)}
                        />
                        <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg p-3 z-20 w-48">
                          {Object.keys(visibleColumns).map((col) => (
                            <label
                              key={col}
                              className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  visibleColumns[col as keyof typeof visibleColumns]
                                }
                                onChange={() =>
                                  toggleColumn(col as keyof typeof visibleColumns)
                                }
                                className="rounded"
                              />
                              <span className="text-sm capitalize">
                                {col.replace('_', ' ')}
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                    Manage Statuse
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                    Manage Master Badges
                  </button>
                </div>

                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-4 py-2 bg-white text-gray-900 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500 w-64"
                  />
                  <button
                    onClick={handleRollBack}
                    disabled={!hasRollback}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    title="Roll Back last action from this tab (Ctrl+Z)"
                  >
                    ↶ Roll Back
                  </button>
                </div>
              </div>
            </div>

            {/* Product count */}
            <div className="text-sm text-gray-600 mb-4 bg-white p-3 rounded-lg shadow-sm">
              <strong>Total:</strong> {totalCount} products | <strong>Showing:</strong>{' '}
              {products.length} | <strong>Selected:</strong> {selectedIds.size}
              <span className="ml-4 text-xs text-blue-600">💡 Tip: Double-click column headers to auto-fit width</span>
            </div>
          </div>
        </div>

        {/* SCROLLABLE TABLE SECTION */}
        <div className="max-w-full mx-auto px-6">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                <p className="mt-2 text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-lg">
                  No products found in {activeTab.replace('_', ' ')}
                </p>
                <p className="text-sm mt-2">Add products to see them here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" ref={tableRef}>
                  <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-left bg-gray-100">
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.size === products.length &&
                            products.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded"
                        />
                      </th>
                      {columnOrder.map((col) => {
                        const columnNames: Record<string, string> = {
                          asin: 'ASIN',
                          product_name: 'Product Name',
                          brand: 'Brand',
                          funnel: 'Funnel',
                          monthly_unit: 'Monthly Unit',
                          product_link: 'Product Link',
                          amz_link: 'AMZ Link',
                          reason: 'Reason',
                        };

                        const defaultWidths: Record<string, number> = {
                          asin: 120,
                          product_name: 250,
                          brand: 150,
                          funnel: 100,
                          monthly_unit: 120,
                          product_link: 100,
                          amz_link: 100,
                          reason: 200,
                        };

                        if (col === 'funnel' && activeTab === 'reject') return null;
                        if (col === 'product_link' && activeTab === 'reject')
                          return null;
                        if (col === 'amz_link' && activeTab === 'reject') return null;
                        if (col === 'reason' && activeTab !== 'reject') return null;

                        return renderColumnHeader(
                          col,
                          columnNames[col],
                          defaultWidths[col]
                        );
                      })}
                      {activeTab !== 'reject' && (
                        <th className="p-3 text-left font-semibold text-gray-700 bg-gray-100">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr
                        key={product.id}
                        className={`border-b hover:bg-gray-50 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(e) =>
                              handleSelectRow(product.id, e.target.checked)
                            }
                            className="rounded"
                          />
                        </td>
                        {columnOrder.map((col) => {
                          if (col === 'funnel' && activeTab === 'reject') return null;
                          if (col === 'product_link' && activeTab === 'reject')
                            return null;
                          if (col === 'amz_link' && activeTab === 'reject')
                            return null;
                          if (col === 'reason' && activeTab !== 'reject') return null;

                          if (!visibleColumns[col as keyof typeof visibleColumns])
                            return null;

                          return (
                            <td
                              key={col}
                              className="px-4 py-3 text-sm"
                              style={{
                                maxWidth: columnWidths[col] || 150,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={String(product[col as keyof ProductRow] || '-')}
                            >
                              {col === 'funnel' ? (
                                <FunnelBadge funnel={product.funnel} />
                              ) : col === 'product_link' ? (
                                product.product_link ? (
                                  <a
                                    href={product.product_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  '-'
                                )
                              ) : col === 'amz_link' ? (
                                product.amz_link ? (
                                  <a
                                    href={product.amz_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    View
                                  </a>
                                ) : (
                                  '-'
                                )
                              ) : col === 'reason' ? (
                                <span className="text-gray-700">
                                  {product.reason || 'No reason provided'}
                                </span>
                              ) : (
                                String(product[col as keyof ProductRow] || '-')
                              )}
                            </td>
                          );
                        })}
                        {activeTab !== 'reject' && (
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => moveProduct(product, 'approved')}
                                disabled={processingId === product.id}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {processingId === product.id ? '...' : 'Approved'}
                              </button>
                              {activeTab !== 'not_approved' && (
                                <button
                                  onClick={() =>
                                    moveProduct(product, 'not_approved')
                                  }
                                  disabled={processingId === product.id}
                                  className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  {processingId === product.id
                                    ? '...'
                                    : 'Not Approved'}
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setRejectModal({ isOpen: true, product })
                                }
                                disabled={processingId === product.id}
                                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {processingId === product.id ? '...' : 'Reject'}
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
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </PageTransition>
  );
}
