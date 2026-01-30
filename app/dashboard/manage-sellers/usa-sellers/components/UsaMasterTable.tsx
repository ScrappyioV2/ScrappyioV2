'use client';

import { useEffect, useState, useRef } from 'react';
import { Filter, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';
import FilterDropdown from '@/components/shared/master-table/FilterDropdown';
import NumericFilter from '@/components/shared/master-table/NumericFilter';
import TextFilter from '@/components/shared/master-table/TextFilter';
import MultiSelectFilter from '@/components/shared/master-table/MultiSelectFilter';
import ActiveFilters from '@/components/shared/master-table/ActiveFilters';
import { supabase } from '@/lib/supabaseClient';

interface MasterData {
  id: string;
  asin: string;
  display_number: number;
  amz_link: string;
  product_name: string;
  remark: string | null;
  brand: string;
  price: number;
  monthly_unit: number;
  monthly_sales: number;
  bsr: number;
  seller: number;
  category: string;
  dimensions: string;
  weight: number;
  weight_unit: string;
}

interface UsaMasterTableProps {
  searchTerm: string;
  hiddenColumns: string[];
  columnWidths: Record<string, number>;
  onColumnWidthChange: (widths: Record<string, number>) => void;
  filters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  refreshTrigger: number;
  currentPage: number;
  itemsPerPage: number;
  onTotalProductsChange: (total: number) => void;
  onTotalPagesChange: (pages: number) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
}

const ALL_COLUMNS = [
  's_no', 'asin', 'amz_link', 'product_name','remark', 'brand', 'price',
  'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category', 'dimensions', 'weight',
];

const NUMERIC_COLUMNS = ['price', 'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'weight'];

const COLUMN_LABELS: Record<string, string> = {
  s_no: 'S.No', asin: 'ASIN', 'amz_link': 'Link', product_name: 'Product Name',remark: 'Remark',
  brand: 'Brand', price: 'Price', monthly_unit: 'Monthly Units', monthly_sales: 'Monthly Sales',
  bsr: 'BSR', seller: 'Sellers', category: 'Category', dimensions: 'Dimensions', weight: 'Weight',
};

const SORTABLE_COLUMNS = ['s_no', 'asin', 'product_name', 'brand', 'price', 'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category', 'weight'];

export default function UsaMasterTable({
  searchTerm, hiddenColumns, columnWidths, onColumnWidthChange, filters, onFiltersChange,
  refreshTrigger, currentPage, itemsPerPage, onTotalProductsChange, onTotalPagesChange,
  selectedIds, onSelectedIdsChange,
}: UsaMasterTableProps) {
  const [data, setData] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string[] | { value: string; count: number }[]>>({});
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const localFilters = filters;

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'display_number', direction: 'asc',
  });

  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [selectAllProgress, setSelectAllProgress] = useState({ current: 0, total: 0 });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
    // ✅ ADD THIS LINE - Remark Modal State
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);


  const visibleColumns = ALL_COLUMNS.filter((col) => !hiddenColumns.includes(col));
  const isAllCurrentPageSelected = data.length > 0 && data.every((row) => selectedIds.has(row.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllCurrentPageSelected;

  useEffect(() => {
    fetchData();
  }, [searchTerm, refreshTrigger, filters, currentPage, sortConfig]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  // --- 1. DATA FETCHING LOGIC ---
  const fetchData = async () => {
    if (!supabase) return;
    try {
      setLoading(true);
      let countQuery: any = supabase.from('usa_master_sellers').select('*', { count: 'exact', head: true });

      // Apply Search
      if (searchTerm) {
        countQuery = countQuery.or(`asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
      }

      // Apply Filters
      Object.entries(localFilters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;
        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          countQuery = countQuery.in(columnKey, filterData.values);
        }
        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            countQuery = countQuery[filterData.operator](columnKey, value);
          }
        }
      });

      const { count } = await countQuery;
      const totalCount = count || 0;
      onTotalProductsChange(totalCount);
      onTotalPagesChange(Math.ceil(totalCount / itemsPerPage));

      let query: any = supabase.from('usa_master_sellers').select('*');

      // Re-apply Search & Filters to Main Query
      if (searchTerm) {
        query = query.or(`asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
      }

      Object.entries(localFilters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;
        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          query = query.in(columnKey, filterData.values);
        }
        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            query = query[filterData.operator](columnKey, value);
          }
        }
      });

      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: result, error } = await query
        .order(sortConfig.key, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (error) throw error;
      setData(result || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. SELECT ALL LOGIC (BATCHED) ---
  const handleSelectAll = async (checked: boolean) => {
    if (!supabase) return;
    if (!checked) {
      onSelectedIdsChange(new Set());
      return;
    }

    try {
      setIsSelectingAll(true);
      const BATCH_SIZE = 1000;
      let page = 0;
      let hasMore = true;
      const allIds = new Set<string>();

      // Initial count query to set progress total
      let countQuery: any = supabase.from('usa_master_sellers').select('*', { count: 'exact', head: true });
      if (searchTerm) {
        countQuery = countQuery.or(`asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
      }
      Object.entries(localFilters).forEach(([column, filter]) => {
        if (!filter) return;
        if ((filter.type === 'text' || filter.type === 'multiselect') && filter.values?.length) {
          countQuery = countQuery.in(column, filter.values);
        }
        if (filter.type === 'numeric' && filter.value !== null) {
          const v = parseFloat(filter.value);
          if (!isNaN(v)) countQuery = countQuery[filter.operator](column, v);
        }
      });
      const { count } = await countQuery;
      setSelectAllProgress({ current: 0, total: count || 0 });

      // Fetch IDs in batches
      while (hasMore) {
        let query: any = supabase
          .from('usa_master_sellers')
          .select('id')
          .range(page * BATCH_SIZE, page * BATCH_SIZE + BATCH_SIZE - 1);

        if (searchTerm) {
          query = query.or(`asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
        }

        Object.entries(localFilters).forEach(([column, filter]) => {
          if (!filter) return;
          if ((filter.type === 'text' || filter.type === 'multiselect') && filter.values?.length) {
            query = query.in(column, filter.values);
          }
          if (filter.type === 'numeric' && filter.value !== null) {
            const v = parseFloat(filter.value);
            if (!isNaN(v)) query = query[filter.operator](column, v);
          }
        });

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        data.forEach((row: any) => allIds.add(row.id));
        setSelectAllProgress(prev => ({ ...prev, current: allIds.size }));
        hasMore = data.length === BATCH_SIZE;
        page++;
      }

      onSelectedIdsChange(allIds);
    } catch (err) {
      console.error('Select all failed:', err);
    } finally {
      setIsSelectingAll(false);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    checked ? newSelected.add(id) : newSelected.delete(id);
    onSelectedIdsChange(newSelected);
  };

  // --- 3. FILTER VALUES LOGIC ---
  const fetchUniqueValuesForFilter = async (columnKey: string) => {
    if (!supabase) return;
    try {
      const BATCH_SIZE = 1000;
      const valueCounts: Record<string, number> = {};
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query: any = supabase
          .from('usa_master_sellers')
          .select(columnKey)
          .range(offset, offset + BATCH_SIZE - 1);

        if (searchTerm) {
          query = query.or(`asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
        }

        Object.entries(localFilters).forEach(([column, filter]) => {
          if (column === columnKey || !filter) return;
          if ((filter.type === 'text' || filter.type === 'multiselect') && filter.values?.length) {
            query = query.in(column, filter.values);
          }
          if (filter.type === 'numeric' && filter.value !== null) {
            const v = parseFloat(filter.value);
            if (!isNaN(v)) query = query[filter.operator](column, v);
          }
        });

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        data.forEach((row: any) => {
          let value = row[columnKey];
          if (columnKey === 'brand' && (!value || value.trim() === '')) {
            value = 'Unknown Brand';
          }
          if (value) {
            valueCounts[value] = (valueCounts[value] || 0) + 1;
          }
        });

        if (data.length < BATCH_SIZE) hasMore = false;
        else offset += BATCH_SIZE;
      }

      return Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    } catch (err) {
      console.error(`Failed to fetch filter values for ${columnKey}`, err);
      return [];
    }
  };

  const fetchUniqueValues = async (columnKey: string) => {
    try {
      const values = (await fetchUniqueValuesForFilter(columnKey)) ?? [];
      setFilterValues((prev) => ({ ...prev, [columnKey]: values.map(v => v.value) }));
    } catch (error) {
      setFilterValues((prev) => ({ ...prev, [columnKey]: [] }));
    }
  };

  const fetchCategoryValues = async (): Promise<{ value: string; count: number }[]> => {
    return (await fetchUniqueValuesForFilter('category')) ?? [];
  };

  const fetchBrandValues = async (): Promise<{ value: string; count: number }[]> => {
    return (await fetchUniqueValuesForFilter('brand')) ?? [];
  };

  const handleOpenFilter = async (columnKey: string, columnType: string) => {
    setActiveFilterColumn(columnKey);
    if (columnKey === 'category') {
      const categoryValues = await fetchCategoryValues();
      setFilterValues((prev) => ({ ...prev, [columnKey]: categoryValues }));
    } else if (columnKey === 'brand') {
      const brandValues = await fetchBrandValues();
      setFilterValues((prev) => ({ ...prev, [columnKey]: brandValues }));
    } else if (columnType === 'text' && !filterValues[columnKey]) {
      fetchUniqueValues(columnKey);
    }
  };

  // --- 4. RESIZE & SORT LOGIC ---
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault(); e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.pageX);
    setResizeStartWidth(columnWidths[columnKey] || 100);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;
    const diff = e.pageX - resizeStartX;
    onColumnWidthChange({ ...columnWidths, [resizingColumn]: Math.max(50, resizeStartWidth + diff) });
  };

  const handleResizeEnd = () => setResizingColumn(null);

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleSort = (columnKey: string) => {
    if (!SORTABLE_COLUMNS.includes(columnKey)) return;
    const sortKey = columnKey === 's_no' ? 'display_number' : columnKey;
    setSortConfig(prev => ({ key: sortKey, direction: prev.key === sortKey && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleRemoveFilter = (columnKey: string) => {
    const newFilters = { ...localFilters };
    delete newFilters[columnKey];
    onFiltersChange(newFilters);
  };

  const handleClearAllFilters = () => onFiltersChange({});
  const handleApplyFilter = (column: string, filterData: any) => {
    const newFilters = { ...localFilters };
    if (!filterData) delete newFilters[column];
    else newFilters[column] = filterData;
    onFiltersChange(newFilters);
    setActiveFilterColumn(null);
  };

  // --- HELPERS ---
  const formatColumnHeader = (column: string) => COLUMN_LABELS[column] || column.replace(/_/g, ' ').toUpperCase();
  const getColumnType = (column: string): 'text' | 'numeric' => NUMERIC_COLUMNS.includes(column) ? 'numeric' : 'text';
  const hasActiveFilter = (column: string) => !!localFilters[column];

  const getSortIcon = (columnKey: string) => {
    if (!SORTABLE_COLUMNS.includes(columnKey)) return null;
    const sortKey = columnKey === 's_no' ? 'display_number' : columnKey;
    if (sortConfig.key !== sortKey) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-400" /> : <ArrowDown className="w-3 h-3 text-indigo-400" />;
  };
  
  return (
    <div>
      {/* Loading Modal for Select All */}
      {isSelectingAll && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Selecting Products...</h3>
            {selectAllProgress.total > 0 && (
              <div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden mb-2">
                  <div className="bg-indigo-600 h-3 transition-all duration-300" style={{ width: `${(selectAllProgress.current / selectAllProgress.total) * 100}%` }}></div>
                </div>
                <p className="text-sm text-slate-400">{selectAllProgress.current.toLocaleString()} / {selectAllProgress.total.toLocaleString()} products</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dark Mode Active Filters */}
      <ActiveFilters
        filters={localFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
        columnConfig={COLUMN_LABELS}
      />

      {/* Main Table Container */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          <table className="min-w-full divide-y divide-slate-800 text-xs">

            {/* Table Header */}
            <thead className="bg-slate-950 sticky top-0 z-20 shadow-md">
              <tr>
                {/* Checkbox Column */}
                <th className="px-2 py-3 w-12 sticky left-0 bg-slate-950 z-10 border-r border-slate-800/80">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                </th>

                {/* Data Columns */}
                {visibleColumns.map((column) => (
                  <th
                    key={column}
                    className="px-2 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider relative select-none bg-slate-950 border-r border-slate-800/50 group"
                    style={{
                      width: `${columnWidths[column] || 100}px`,
                      minWidth: `${columnWidths[column] || 100}px`,
                      maxWidth: `${columnWidths[column] || 100}px`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-1 pr-2">
                      <div className="flex items-center gap-1 overflow-hidden">
                        <button
                          onClick={() => handleSort(column)}
                          className={`flex items-center gap-1 min-w-0 transition-colors ${SORTABLE_COLUMNS.includes(column) ? 'hover:text-white cursor-pointer' : 'cursor-default'
                            }`}
                          disabled={!SORTABLE_COLUMNS.includes(column)}
                        >
                          <span className="truncate">{formatColumnHeader(column)}</span>
                          <span>{getSortIcon(column)}</span>
                        </button>
                      </div>

                      {/* Filter Button */}
                      {column !== 's_no' && column !== 'link' && (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => handleOpenFilter(column, getColumnType(column))}
                            className={`p-1 rounded transition-colors ${hasActiveFilter(column)
                              ? 'text-indigo-400 bg-indigo-500/10'
                              : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'
                              }`}
                            title="Filter"
                          >
                            <Filter className="w-3.5 h-3.5" />
                          </button>

                          {activeFilterColumn === column && (
                            <div className="absolute top-full right-0 mt-2 z-50">
                              <FilterDropdown
                                isOpen={true}
                                onClose={() => setActiveFilterColumn(null)}
                                title={`Filter ${formatColumnHeader(column)}`}
                              >
                                {column === 'category' || column === 'brand' ? (
                                  <MultiSelectFilter
                                    values={filterValues[column] as any[] || []}
                                    selectedValues={localFilters[column]?.values || []}
                                    onApply={(values) => handleApplyFilter(column, values.length ? { type: 'multiselect', values } : null)}
                                    placeholder="Search..."
                                    loading={!filterValues[column]}
                                  />
                                ) : getColumnType(column) === 'numeric' ? (
                                  <NumericFilter
                                    currentFilter={localFilters[column]}
                                    onApply={(data) => handleApplyFilter(column, data)}
                                    columnName={column}
                                  />
                                ) : (
                                  <TextFilter
                                    values={filterValues[column] as string[] || []}
                                    selectedValues={localFilters[column]?.values || []}
                                    onApply={(values) => handleApplyFilter(column, values.length ? { type: 'text', values } : null)}
                                    placeholder="Search..."
                                  />
                                )}
                              </FilterDropdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resize Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, column)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500 hover:w-1.5 transition-all z-20 opacity-0 group-hover:opacity-100"
                    />
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="bg-slate-900 divide-y divide-slate-800/50">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-12 text-center text-slate-500">
                    No data found
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className={`group hover:bg-slate-800/60 transition-colors ${selectedIds.has(row.id) ? 'bg-indigo-500/10' : ''}`}>
                    {/* Checkbox Cell */}
                    <td className="px-2 py-2 sticky left-0 bg-slate-900 group-hover:bg-slate-800/60 z-10 border-r border-slate-800/50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                    </td>

                    {visibleColumns.map((column) => (
                      <td
                        key={column}
                        className="px-2 py-2 text-xs text-slate-300"
                        style={{
                          width: `${columnWidths[column] || 100}px`,
                          maxWidth: `${columnWidths[column] || 100}px`,
                        }}
                      >
                        <div className="truncate" title={String(row[column as keyof MasterData] || '')}>
                          {column === 's_no' ? (
                            <span className="font-mono text-slate-500">{row.display_number}</span>
                          ) : column === 'asin' ? (
                            <span className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono text-[10px] select-all">
                              {row.asin}
                            </span>
                          ) : column === 'amz_link' ? (
                            <a
                              href={row.amz_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                            >
                              View
                            </a>
                            ) : column === 'remark' ? (
                            row.remark ? (
                              <button
                                onClick={() => setSelectedRemark(row.remark)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )
                          ) : column === 'weight' ? (
                            `${row.weight} ${row.weight_unit}`
                          ) : column === 'price' ? (
                            <span className="text-emerald-400 font-mono font-medium">{row.price ? `$${row.price}` : '-'}</span>
                          ) : column === 'bsr' ? (
                            <span className="text-amber-400 font-mono">{row.bsr?.toLocaleString()}</span>
                          ) : column === 'monthly_sales' || column === 'monthly_unit' ? (
                            row[column as keyof MasterData]?.toLocaleString() || '-'
                          ) : (
                            row[column as keyof MasterData] ?? '-'
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Remark Modal */}
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
  );
}