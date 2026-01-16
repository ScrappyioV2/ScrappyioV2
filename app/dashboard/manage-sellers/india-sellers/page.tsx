'use client';
import { useEffect, useState, useRef } from 'react';

import { Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import FilterDropdown from '@/components/shared/master-table/FilterDropdown';
import NumericFilter from '@/components/shared/master-table/NumericFilter';
import TextFilter from '@/components/shared/master-table/TextFilter';
import MultiSelectFilter from '@/components/shared/master-table/MultiSelectFilter';
import ActiveFilters from '@/components/shared/master-table/ActiveFilters';
import { supabase } from '@/lib/supabaseClient'

interface MasterData {
  id: string;
  asin: string;
  display_number: number;
  
  amz_link: string;
  product_name: string;
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

interface IndiaMasterTableProps {
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
  's_no',
  'asin',
  // 'link',
  'amz_link',
  'product_name',
  'brand',
  'price',
  'monthly_unit',
  'monthly_sales',
  'bsr',
  'seller',
  'category',
  'dimensions',
  'weight',
];

const NUMERIC_COLUMNS = ['price', 'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'weight'];

const COLUMN_LABELS: Record<string, string> = {
  s_no: 'S.No',
  asin: 'ASIN',
  'amz_link': 'Link',
  product_name: 'Product Name',
  brand: 'Brand',
  price: 'Price',
  monthly_unit: 'Monthly Units',
  monthly_sales: 'Monthly Sales',
  bsr: 'BSR',
  seller: 'Sellers',
  category: 'Category',
  dimensions: 'Dimensions',
  weight: 'Weight',
};

const SORTABLE_COLUMNS = ['s_no', 'asin', 'product_name', 'brand', 'price', 'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category', 'weight'];

export default function IndiaMasterTable({
  searchTerm,
  hiddenColumns,
  columnWidths,
  onColumnWidthChange,
  filters,
  onFiltersChange,
  refreshTrigger,
  currentPage,
  itemsPerPage,
  onTotalProductsChange,
  onTotalPagesChange,
  selectedIds,
  onSelectedIdsChange,
}: IndiaMasterTableProps) {
  const [data, setData] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string[] | { value: string; count: number }[]>>({});
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const localFilters = filters; // Use parent's filters directly
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'display_number',
    direction: 'asc',
  });

  // Selection states
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  const [selectAllProgress, setSelectAllProgress] = useState({ current: 0, total: 0 });

  // Resize states
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

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

  const fetchData = async () => {
    if (!supabase) return
    try {
      setLoading(true);

      let countQuery: any = supabase
        .from('india_master_sellers')
        .select('*', { count: 'exact', head: true });

      if (searchTerm) {
        countQuery = countQuery.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
        );
      }

      Object.entries(localFilters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;

        // Handle text, multiselect filters
        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          countQuery = countQuery.in(columnKey, filterData.values);
        }

        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            switch (filterData.operator) {
              case 'eq':
                countQuery = countQuery.eq(columnKey, value);
                break;
              case 'gt':
                countQuery = countQuery.gt(columnKey, value);
                break;
              case 'lt':
                countQuery = countQuery.lt(columnKey, value);
                break;
              case 'gte':
                countQuery = countQuery.gte(columnKey, value);
                break;
              case 'lte':
                countQuery = countQuery.lte(columnKey, value);
                break;
            }
          }
        }
      });

      const { count } = await countQuery;
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / itemsPerPage);

      onTotalProductsChange(totalCount);
      onTotalPagesChange(totalPages);

      let query: any = supabase.from('india_master_sellers').select('*');

      if (searchTerm) {
        query = query.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
        );
      }

      Object.entries(localFilters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;

        // Handle text, multiselect filters
        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          query = query.in(columnKey, filterData.values);
        }

        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            switch (filterData.operator) {
              case 'eq':
                query = query.eq(columnKey, value);
                break;
              case 'gt':
                query = query.gt(columnKey, value);
                break;
              case 'lt':
                query = query.lt(columnKey, value);
                break;
              case 'gte':
                query = query.gte(columnKey, value);
                break;
              case 'lte':
                query = query.lte(columnKey, value);
                break;
            }
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

  const handleSelectAll = async (checked: boolean) => {
    if (!supabase) return
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

      while (hasMore) {
        let query: any = supabase
          .from('india_master_sellers')
          .select('id')
          .range(page * BATCH_SIZE, page * BATCH_SIZE + BATCH_SIZE - 1);

        if (searchTerm) {
          query = query.or(
            `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
          );
        }

        Object.entries(localFilters).forEach(([column, filter]) => {
          if (!filter) return;

          if ((filter.type === 'text' || filter.type === 'multiselect') && filter.values?.length) {
            query = query.in(column, filter.values);
          }

          if (filter.type === 'numeric' && filter.value !== null) {
            const v = parseFloat(filter.value);
            if (!isNaN(v)) {
              query = query[filter.operator](column, v);
            }
          }
        });

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        data.forEach((row: any) => allIds.add(row.id));

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
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    onSelectedIdsChange(newSelected);
  };


  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnKey);
    setResizeStartX(e.pageX);
    setResizeStartWidth(columnWidths[columnKey] || 100);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;

    const diff = e.pageX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + diff); // Minimum 50px

    const updatedWidths = {
      ...columnWidths,
      [resizingColumn]: newWidth,
    };

    onColumnWidthChange(updatedWidths);
  };

  const handleResizeEnd = () => {
    setResizingColumn(null);
  };

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

    // Map s_no to display_number for sorting
    const sortKey = columnKey === 's_no' ? 'display_number' : columnKey;

    setSortConfig((prev) => ({
      key: sortKey,
      direction: prev.key === sortKey && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (columnKey: string) => {
    if (!SORTABLE_COLUMNS.includes(columnKey)) return null;

    const sortKey = columnKey === 's_no' ? 'display_number' : columnKey;

    if (sortConfig.key !== sortKey) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    }

    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600" />
    );
  };

  /**
 * Fetch unique values for a filter, respecting OTHER active filters
 */
  /**
   * Fetch unique values for a filter, respecting OTHER active filters
   */
  const fetchUniqueValuesForFilter = async (columnKey: string) => {   
    if (!supabase) return
    try {
      const BATCH_SIZE = 1000;
      const valueCounts: Record<string, number> = {};
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query: any = supabase
          .from('india_master_sellers')
          .select(columnKey)
          .range(offset, offset + BATCH_SIZE - 1);

        if (searchTerm) {
          query = query.or(
            `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
          );
        }

        Object.entries(localFilters).forEach(([column, filter]) => {
          if (column === columnKey || !filter) return;

          if ((filter.type === 'text' || filter.type === 'multiselect') && filter.values?.length) {
            query = query.in(column, filter.values);
          }

          if (filter.type === 'numeric' && filter.value !== null) {
            const v = parseFloat(filter.value);
            if (!isNaN(v)) {
              query = query[filter.operator](column, v);
            }
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

        if (data.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          offset += BATCH_SIZE;
        }
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
      const values =
        (await fetchUniqueValuesForFilter(columnKey)) ?? [];
      // Convert to simple string array for text filters
      setFilterValues((prev) => ({
        ...prev,
        [columnKey]: values.map(v => v.value)
      }));
    } catch (error) {
      console.error('Error fetching unique values:', error);
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
      // Fetch category with counts
      const categoryValues = await fetchCategoryValues();
      setFilterValues((prev) => ({ ...prev, [columnKey]: categoryValues }));
    } else if (columnKey === 'brand') {
      // Fetch brand with counts
      const brandValues = await fetchBrandValues();
      setFilterValues((prev) => ({ ...prev, [columnKey]: brandValues }));
    } else if (columnType === 'text' && !filterValues[columnKey]) {
      fetchUniqueValues(columnKey);
    }
  };


  const handleApplyFilter = (columnKey: string, filterData: any) => {
    const newFilters = { ...localFilters };
    if (!filterData || (filterData.values && filterData.values.length === 0)) {
      delete newFilters[columnKey];
    } else {
      newFilters[columnKey] = filterData;
    }
    onFiltersChange(newFilters); // Update parent
    setActiveFilterColumn(null);
  };

  const handleRemoveFilter = (columnKey: string) => {
    const newFilters = { ...localFilters };
    delete newFilters[columnKey];
    onFiltersChange(newFilters); // Update parent
  };

  const handleClearAllFilters = () => {
    onFiltersChange({}); // Update parent
  };

  const formatColumnHeader = (column: string) => {
    return COLUMN_LABELS[column] || column.replace(/_/g, ' ').toUpperCase();
  };

  const getColumnType = (column: string): 'text' | 'numeric' => {
    return NUMERIC_COLUMNS.includes(column) ? 'numeric' : 'text';
  };

  const hasActiveFilter = (column: string) => {
    return !!localFilters[column];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Loading modal for select all */}
      {isSelectingAll && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold mb-4">Selecting Products...</h3>
              {selectAllProgress.total > 0 && (
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                    <div
                      className="bg-blue-600 h-3 transition-all duration-300"
                      style={{ width: `${(selectAllProgress.current / selectAllProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {selectAllProgress.current.toLocaleString()} / {selectAllProgress.total.toLocaleString()} products
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ActiveFilters
        filters={localFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={handleClearAllFilters}
        columnConfig={COLUMN_LABELS}
      />

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(105vh-250px)] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                {/* Checkbox column */}
                <th className="px-2 py-2 w-12 sticky left-0 bg-gray-50 z-10">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>

                {visibleColumns.map((column) => (
                  <th
                    key={column}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-tight relative select-none"
                    style={{
                      width: `${columnWidths[column] || 100}px`,
                      minWidth: `${columnWidths[column] || 100}px`,
                      maxWidth: `${columnWidths[column] || 100}px`,
                    }}
                  >
                    {/* Remove overflow-hidden from main container */}
                    <div className="flex items-center gap-1 pr-2">
                      {/* Wrap text+sort in overflow container */}
                      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                        <button
                          onClick={() => handleSort(column)}
                          className={`flex items-center gap-1 min-w-0 ${SORTABLE_COLUMNS.includes(column) ? 'cursor-pointer hover:text-gray-700' : ''
                            }`}
                          disabled={!SORTABLE_COLUMNS.includes(column)}
                        >
                          <span className="truncate block">{formatColumnHeader(column)}</span>
                          <span className="flex-shrink-0">{getSortIcon(column)}</span>
                        </button>
                      </div>

                      {/* Filter button outside overflow container */}
                      {column !== 's_no' && column !== 'link' && (
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => handleOpenFilter(column, getColumnType(column))}
                            className={`p-0.5 rounded hover:bg-gray-200 transition ${hasActiveFilter(column) ? 'text-blue-600' : 'text-gray-400'
                              }`}
                            title="Filter"
                          >
                            <Filter className="w-3.5 h-3.5" />
                          </button>

                          {activeFilterColumn === column && (
                            <FilterDropdown
                              isOpen={true}
                              onClose={() => setActiveFilterColumn(null)}
                              title={`Filter ${formatColumnHeader(column)}`}
                            >
                              {column === 'category' || column === 'brand' ? (
                                <MultiSelectFilter
                                  values={filterValues[column] as { value: string; count: number }[] || []}
                                  selectedValues={localFilters[column]?.values || []}
                                  onApply={(values) => {
                                    handleApplyFilter(column, values.length > 0 ? { type: 'multiselect', values } : null);
                                    setActiveFilterColumn(null);
                                  }}
                                  placeholder={`Search ${formatColumnHeader(column)}...`}
                                  loading={!filterValues[column]}
                                />
                              ) : getColumnType(column) === 'numeric' ? (
                                <NumericFilter
                                  currentFilter={localFilters[column]}
                                  onApply={(filterData) => {
                                    handleApplyFilter(column, filterData);
                                    setActiveFilterColumn(null);
                                  }}
                                  columnName={formatColumnHeader(column)}
                                />
                              ) : (
                                <TextFilter
                                  values={filterValues[column] as string[] || []}
                                  selectedValues={localFilters[column]?.values || []}
                                  onApply={(values) => {
                                    handleApplyFilter(column, values.length > 0 ? { type: 'text', values } : null);
                                    setActiveFilterColumn(null);
                                  }}
                                  placeholder={`Search ${formatColumnHeader(column)}...`}
                                />
                              )}
                            </FilterDropdown>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, column)}
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 hover:w-1.5 transition-all"
                      style={{ zIndex: 20 }}
                    />
                  </th>
                ))}

              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No data found
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {/* Checkbox column */}
                    <td className="px-2 py-2 sticky left-0 bg-white z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>

                    {visibleColumns.map((column) => (
                      <td
                        key={column}
                        className="px-2 py-2 text-xs text-gray-900"
                        style={{
                          width: `${columnWidths[column] || 100}px`,
                          maxWidth: `${columnWidths[column] || 100}px`,
                        }}
                      >
                        <div className="truncate" title={String(row[column as keyof MasterData] || '')}>
                          {column === 's_no' ? (
                            <span className="font-medium">{row.display_number}</span>
                          ) : column === 'asin' ? (
                            <span className="font-mono text-xs">{row.asin}</span>
                          ) : column === 'link' ? (
                            <a
                              href={row.amz_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs"
                            >
                              Link
                            </a>
                          ) : column === 'weight' ? (
                            `${row.weight} ${row.weight_unit}`
                          ) : column === 'price' || column === 'monthly_sales' ? (
                            row[column as keyof MasterData]?.toLocaleString() || '-'
                          ) : (
                            (row[column as keyof MasterData] as any) || '-'
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
    </div>
  );
}

