'use client';
export const dynamic = 'force-dynamic'
import {
  normalizeDataForDB,
  filterDuplicateASINs,
} from '@/lib/utils/master-table/dataHelpers'
import { useState, useEffect } from 'react';

import toast, { Toaster } from 'react-hot-toast';
import ColumnToggle from '@/components/shared/master-table/ColumnToggle';
import UploadModal from '@/components/shared/master-table/UploadModal';
import ExportButton from '@/components/shared/master-table/ExportButton';
import UsaMasterTable from './components/UsaMasterTable';
import {
  parseFile as parseUploadedFile
} from '@/lib/utils/master-table/uploadHelpers'
import { exportData } from '@/lib/utils/exportHelpers'
import { supabase } from '@/lib/supabaseClient'

const TABLE_NAME = 'usa_master_sellers';

const ALL_COLUMNS = [
  's_no',
  'asin',
  'link',
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

// Default column widths
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  s_no: 60,
  asin: 120,
  link: 80,
  product_name: 300,
  brand: 120,
  price: 100,
  monthly_unit: 120,
  monthly_sales: 140,
  bsr: 100,
  seller: 100,
  category: 180,
  dimensions: 150,
  weight: 120,
};

export default function UsaSellersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [isColumnToggleOpen, setIsColumnToggleOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  const ITEMS_PER_PAGE = 50;

  // Load column preferences
  useEffect(() => {
    loadColumnPreferences();
  }, []);

  const loadColumnPreferences = async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_column_preferences')
        .select('hidden_columns, column_widths')
        .eq('table_name', TABLE_NAME)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && !error) {
        setHiddenColumns(data.hidden_columns || []);
        if (data.column_widths && Object.keys(data.column_widths).length > 0) {
          setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...data.column_widths });
        }
      }
    } catch (error) {
      console.error('Error loading column preferences:', error);
    }
  };

  const saveColumnPreferences = async (columns: string[], widths?: Record<string, number>) => {
  
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updateData: any = {
        table_name: TABLE_NAME,
        user_id: user.id,
        hidden_columns: columns,
        updated_at: new Date().toISOString(),
      };

      if (widths) {
        updateData.column_widths = widths;
      }

      await supabase
        .from('user_column_preferences')
        .upsert(updateData, {
          onConflict: 'table_name,user_id'
        });
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  };

  const handleToggleColumn = (column: string) => {
    const newHiddenColumns = hiddenColumns.includes(column)
      ? hiddenColumns.filter((col) => col !== column)
      : [...hiddenColumns, column];
    setHiddenColumns(newHiddenColumns);
    saveColumnPreferences(newHiddenColumns);
  };

  const handleColumnWidthChange = (widths: Record<string, number>) => {
    setColumnWidths(widths);
    saveColumnPreferences(hiddenColumns, widths);
  };

  const handleFiltersChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to page 1 when filters change
  };

  const handleUpload = async (file: File) => {
    if (!supabase) return
    const toastId = toast.loading('Uploading file...');

    try {
      // Parse file
      const { data, errors } = await parseUploadedFile(file);

      if (errors.length > 0) {
        toast.error(`Errors: ${errors.join(', ')}`, { id: toastId });
        return;
      }

      if (data.length === 0) {
        toast.error('No data found in file', { id: toastId });
        return;
      }

      // Normalize data
      const normalizedData = normalizeDataForDB(data);

      // Filter duplicate ASINs
      toast.loading(`Checking ${normalizedData.length} products for duplicates...`, { id: toastId });

      const { newProducts, duplicateCount } = await filterDuplicateASINs(
        normalizedData,
        TABLE_NAME,
        supabase
      );

      // If all products are duplicates
      if (newProducts.length === 0) {
        toast.error(
          `All ${duplicateCount} products are duplicates. No new data uploaded.`,
          { id: toastId, duration: 5000 }
        );
        return;
      }

      // Insert only new products
      toast.loading(`Inserting ${newProducts.length} new products...`, { id: toastId });
      const { error } = await supabase.from(TABLE_NAME).insert(newProducts);

      if (error) throw error;

      // Show success message
      if (duplicateCount > 0) {
        toast.success(
          `✅ Added ${newProducts.length} new products\n⚠️ Skipped ${duplicateCount} duplicate ASINs`,
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.success(
          `✅ Successfully uploaded ${newProducts.length} products!`,
          { id: toastId, duration: 4000 }
        );
      }

      // Refresh table
      setRefreshTrigger((prev) => prev + 1);
    } catch (error: any) {
  console.error('Upload error:', error);
  console.error('Error details:', error?.message);
  console.error('Error hint:', error?.hint);
  console.error('Error details full:', JSON.stringify(error, null, 2));
  const errorMessage = error?.message || 'Failed to upload data. Please try again.';
  toast.error(errorMessage, { id: toastId, duration: 5000 });
}
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!supabase) return
    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: 0 });

      // Build base query
      let baseQuery: any = supabase.from(TABLE_NAME).select('*', { count: 'exact', head: true });

      if (searchTerm) {
        baseQuery = baseQuery.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
        );
      }

      Object.entries(filters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;

        // Handle text, multiselect filters
        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          baseQuery = baseQuery.in(columnKey, filterData.values);
        }

        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            switch (filterData.operator) {
              case 'eq':
                baseQuery = baseQuery.eq(columnKey, value);
                break;
              case 'gt':
                baseQuery = baseQuery.gt(columnKey, value);
                break;
              case 'lt':
                baseQuery = baseQuery.lt(columnKey, value);
                break;
              case 'gte':
                baseQuery = baseQuery.gte(columnKey, value);
                break;
              case 'lte':
                baseQuery = baseQuery.lte(columnKey, value);
                break;
            }
          }
        }
      });

      // Get total count
      const { count } = await baseQuery;
      const totalCount = count || 0;

      if (totalCount === 0) {
        alert('No data to export');
        setIsExporting(false);
        return;
      }

      setExportProgress({ current: 0, total: totalCount });

      // Fetch all data in batches
      let allData: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query: any = supabase.from(TABLE_NAME).select('*');

        if (searchTerm) {
          query = query.or(
            `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
          );
        }

        Object.entries(filters).forEach(([columnKey, filterData]) => {
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

        const { data, error } = await query.range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          setExportProgress({ current: allData.length, total: totalCount });
          hasMore = data.length === batchSize;
          offset += batchSize;
        } else {
          hasMore = false;
        }
      }

      exportData(allData, TABLE_NAME, format);
      alert(`Successfully exported ${allData.length} products!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data');
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalProducts);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          success: {
            style: {
              background: '#10B981',
              color: '#fff',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#10B981',
            },
          },
          error: {
            style: {
              background: '#EF4444',
              color: '#fff',
            },
          },
          loading: {
            style: {
              background: '#3B82F6',
              color: '#fff',
            },
          },
        }}
      />

      {/* Export Loading Modal */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold mb-4">Exporting Data...</h3>
              {exportProgress.total > 0 && (
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                    <div
                      className="bg-green-600 h-3 transition-all duration-300"
                      style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {exportProgress.current.toLocaleString()} / {exportProgress.total.toLocaleString()} products
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {Math.round((exportProgress.current / exportProgress.total) * 100)}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by ASIN, Product Name, or Brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsColumnToggleOpen(true)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              Columns
            </button>

            <ExportButton onExport={handleExport} />

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              Upload
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          Showing {totalProducts > 0 ? startItem : 0}-{endItem} of {totalProducts.toLocaleString()}
        </div>

        <UsaMasterTable
          searchTerm={searchTerm}
          hiddenColumns={hiddenColumns}
          columnWidths={columnWidths}
          onColumnWidthChange={handleColumnWidthChange}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          refreshTrigger={refreshTrigger}
          currentPage={currentPage}
          itemsPerPage={ITEMS_PER_PAGE}
          onTotalProductsChange={setTotalProducts}
          onTotalPagesChange={setTotalPages}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              &lt; Previous
            </button>

            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next &gt;
            </button>
          </div>
        )}

        <ColumnToggle
          isOpen={isColumnToggleOpen}
          onClose={() => setIsColumnToggleOpen(false)}
          columns={ALL_COLUMNS}
          hiddenColumns={hiddenColumns}
          onToggleColumn={handleToggleColumn}
        />

        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUpload={handleUpload}
        />
      </div>
    </div>
  );
}
