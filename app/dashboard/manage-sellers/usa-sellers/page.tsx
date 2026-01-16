'use client';


export const dynamic = 'force-dynamic'


import {
  normalizeDataForDB,
  // filterDuplicateASINs,
} from '@/lib/utils/master-table/dataHelpers'
import { useState, useEffect, useCallback } from 'react';
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
import { filterDuplicateASINs } from '@/lib/utils/master-table/uploadHelpers';



const TABLE_NAME = 'usa_master_sellers';


const ALL_COLUMNS = [
  's_no', 'asin', 'link', 'amz_link', 'product_name', 'brand', 'price',
  'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category',
  'dimensions', 'weight', 'weight_unit'
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  's_no': 60,
  'asin': 120,
  'link': 80,
  'amz_link': 120,  // Add this line
  'product_name': 300,
  'brand': 120,
  'price': 100,
  'monthly_unit': 120,
  'monthly_sales': 140,
  'bsr': 100,
  'seller': 100,
  'category': 180,
  'dimensions': 150,
  'weight': 120,
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


  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, batch: 0, totalBatches: 0 });


  const ITEMS_PER_PAGE = 50;


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
    setCurrentPage(1);
  };


  // Auto-generate Amazon link from ASIN
  const generateAmazonLink = (asin: string, country: 'usa' | 'india'): string => {
    if (!asin) return '';
    const domain = country === 'usa' ? 'amazon.com' : 'amazon.in';
    return `https://www.${domain}/dp/${asin}`;
  };


  // FIXED: Handle multiple file uploads with batch insert
  // FIXED: Handle multiple file uploads with PARALLEL batch insert
  const handleUpload = async (files: File[]) => {
    if (!supabase) return;
    if (files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Processing ${files.length} file(s)...`);

    try {
      let allNewProducts: any[] = [];
      let totalDuplicates = 0;

      // Step 1: Parse all files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        toast.loading(`Parsing file ${i + 1}/${files.length}: ${file.name}`, { id: toastId });

        const { data, errors } = await parseUploadedFile(file);

        if (errors.length > 0) {
          toast.error(`Errors in ${file.name}: ${errors.join(', ')}`, { id: toastId });
          continue;
        }

        if (data.length === 0) {
          toast.error(`No data found in ${file.name}`, { id: toastId });
          continue;
        }

        // Normalize data and generate Amazon links
        const normalizedData = normalizeDataForDB(data)
          .map((product) => {
            if (product && product.asin) {
              // Generate amz_link if missing
              // Generate amz_link if missing (use underscore!)
              if (!product.amz_link) {
                product.amz_link = generateAmazonLink(product.asin, 'usa');
              }
              // Also set link if missing
              if (!product.link) {
                product.link = product.amz_link;
              }
            }
            return product;
          })
          .filter(Boolean);

        // Filter duplicates
        const { newProducts, duplicateCount } =
          await filterDuplicateASINs(normalizedData, TABLE_NAME);

        allNewProducts.push(...newProducts);
        totalDuplicates += duplicateCount;
      }

      // If no new products after processing all files
      if (allNewProducts.length === 0) {
        toast.error(
          `All ${totalDuplicates} products are duplicates. No new data uploaded.`,
          { id: toastId, duration: 5000 }
        );
        setIsUploading(false);
        return;
      }

      // CRITICAL: Remove duplicate ASINs within the batch
      const uniqueProductsMap = new Map();
      allNewProducts.forEach(product => {
        if (product.asin) {
          // Keep the last occurrence (or you can keep first by checking !uniqueProductsMap.has)
          uniqueProductsMap.set(product.asin, product);
        }
      });
      allNewProducts = Array.from(uniqueProductsMap.values());

      console.log(`✅ After deduplication: ${allNewProducts.length} unique products`);

      // Step 2: OPTIMIZED Batch insert with parallel processing
      const batchSize = 500; // Reduced from 1000 to avoid timeouts
      const MAX_CONCURRENT_BATCHES = 2; // Reduced from 3 for stability
      const totalBatches = Math.ceil(allNewProducts.length / batchSize);
      let successCount = 0;
      let failedBatches = 0;

      setUploadProgress({ current: 0, total: allNewProducts.length, batch: 0, totalBatches });

      // Split into batches and ensure no duplicates within each batch
      const batches = [];
      for (let i = 0; i < allNewProducts.length; i += batchSize) {
        const batch = allNewProducts.slice(i, i + batchSize);

        // Double-check: remove any duplicates within this batch
        const batchMap = new Map();
        batch.forEach(product => {
          if (product.asin) {
            batchMap.set(product.asin, product);
          }
        });

        batches.push(Array.from(batchMap.values()));
      }

      // Upload batch function with retry logic
      const uploadBatch = async (
        batch: any[],
        batchIndex: number
      ): Promise<{
        success: boolean;
        count: number;
        batchIndex: number;
        error?: any;
      }> => {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            // Clean the batch data
            const cleanBatch = batch.map(product => {
              const cleaned: any = {};
              Object.keys(product).forEach(key => {
                if (product[key] !== undefined && product[key] !== null) {
                  cleaned[key] = product[key];
                }
              });
              return cleaned;
            });

            // Use insert with onConflict to avoid the columns parameter
            const { error } = await supabase
              .from(TABLE_NAME)
              .insert(cleanBatch, {
                // @ts-ignore - Use DO UPDATE for upsert behavior
                onConflict: 'asin',
                // This tells Supabase to update all columns on conflict
                ignoreDuplicates: false
              });

            if (error) {
              // If still failing, try individual inserts
              if (error.code === '21000') {
                console.warn(`Batch has duplicates, trying individual inserts...`);
                let successfulInserts = 0;

                for (const product of cleanBatch) {
                  try {
                    await supabase
                      .from(TABLE_NAME)
                      .upsert(product, { onConflict: 'asin' });
                    successfulInserts++;
                  } catch (e) {
                    console.error('Failed to insert product:', product.asin, e);
                  }
                }

                return { success: true, count: successfulInserts, batchIndex };
              }

              throw error;
            }

            console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} uploaded (${batch.length} rows)`);
            return { success: true, count: batch.length, batchIndex };

          } catch (error: any) {
            attempt++;
            console.error(`⚠️ Batch ${batchIndex + 1} failed (attempt ${attempt}/${maxRetries}):`, error);

            if (attempt >= maxRetries) {
              return { success: false, count: 0, batchIndex, error };
            }

            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }

        return { success: false, count: 0, batchIndex, error: 'Unexpected error' };
      };

      // Process batches with controlled concurrency
      for (let i = 0; i < batches.length; i += MAX_CONCURRENT_BATCHES) {
        const batchGroup = batches
          .slice(i, i + MAX_CONCURRENT_BATCHES)
          .map((batch, index) => uploadBatch(batch, i + index));

        toast.loading(
          `Uploading batches ${i + 1}-${Math.min(i + MAX_CONCURRENT_BATCHES, totalBatches)} of ${totalBatches}...`,
          { id: toastId }
        );

        const results = await Promise.all(batchGroup);

        results.forEach(result => {
          if (result.success) {
            successCount += result.count;
          } else {
            failedBatches++;
          }
        });

        setUploadProgress({
          current: successCount,
          total: allNewProducts.length,
          batch: Math.min(i + MAX_CONCURRENT_BATCHES, totalBatches),
          totalBatches
        });
      }

      // Step 3: Show final summary
      const summaryLines = [];

      if (successCount > 0) {
        summaryLines.push(`✅ Successfully inserted ${successCount.toLocaleString()} products`);
      }

      if (totalDuplicates > 0) {
        summaryLines.push(`⚠️ Skipped ${totalDuplicates.toLocaleString()} duplicates`);
      }

      if (failedBatches > 0) {
        summaryLines.push(`❌ ${failedBatches} batch(es) failed`);
      }

      if (successCount > 0) {
        toast.success(summaryLines.join('\n'), { id: toastId, duration: 6000 });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        toast.error('Upload failed. Please try again.', { id: toastId, duration: 5000 });
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error?.message || 'Failed to upload data. Please try again.';
      toast.error(errorMessage, { id: toastId, duration: 5000 });
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, batch: 0, totalBatches: 0 });
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!supabase) return
    try {
      setIsExporting(true);
      setExportProgress({ current: 0, total: 0 });


      let baseQuery: any = supabase.from(TABLE_NAME).select('*', { count: 'exact', head: true });


      if (searchTerm) {
        baseQuery = baseQuery.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`
        );
      }


      Object.entries(filters).forEach(([columnKey, filterData]) => {
        if (!filterData) return;


        if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
          baseQuery = baseQuery.in(columnKey, filterData.values);
        }


        if (filterData.type === 'numeric' && filterData.value !== null) {
          const value = parseFloat(filterData.value);
          if (!isNaN(value)) {
            switch (filterData.operator) {
              case 'eq': baseQuery = baseQuery.eq(columnKey, value); break;
              case 'gt': baseQuery = baseQuery.gt(columnKey, value); break;
              case 'lt': baseQuery = baseQuery.lt(columnKey, value); break;
              case 'gte': baseQuery = baseQuery.gte(columnKey, value); break;
              case 'lte': baseQuery = baseQuery.lte(columnKey, value); break;
            }
          }
        }
      });


      const { count } = await baseQuery;
      const totalCount = count || 0;


      if (totalCount === 0) {
        alert('No data to export');
        setIsExporting(false);
        return;
      }


      setExportProgress({ current: 0, total: totalCount });


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


          if ((filterData.type === 'text' || filterData.type === 'multiselect') && filterData.values?.length > 0) {
            query = query.in(columnKey, filterData.values);
          }


          if (filterData.type === 'numeric' && filterData.value !== null) {
            const value = parseFloat(filterData.value);
            if (!isNaN(value)) {
              switch (filterData.operator) {
                case 'eq': query = query.eq(columnKey, value); break;
                case 'gt': query = query.gt(columnKey, value); break;
                case 'lt': query = query.lt(columnKey, value); break;
                case 'gte': query = query.gte(columnKey, value); break;
                case 'lte': query = query.lte(columnKey, value); break;
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
    <div className="p-6 space-y-6">
      <Toaster position="top-right" />


      {/* Upload Progress Modal */}
      {isUploading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
              </div>


              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Uploading Products...
              </h3>


              {uploadProgress.total > 0 && (
                <>
                  <p className="text-gray-600 mb-2">
                    Batch {uploadProgress.batch} of {uploadProgress.totalBatches}
                  </p>


                  <p className="text-2xl font-bold text-blue-600 mb-4">
                    {uploadProgress.current.toLocaleString()} / {uploadProgress.total.toLocaleString()}
                  </p>


                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`
                      }}
                    ></div>
                  </div>


                  <p className="text-sm text-gray-500">
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}% complete
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Export Loading Modal */}
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">
                Exporting Data...
              </h3>
              {exportProgress.total > 0 && (
                <>
                  <p className="text-2xl font-bold text-green-600 mb-4">
                    {exportProgress.current.toLocaleString()} / {exportProgress.total.toLocaleString()} products
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                    <div
                      className="bg-green-600 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {Math.round((exportProgress.current / exportProgress.total) * 100)}% complete
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Columns
          </button>


          <ExportButton
            onExport={handleExport}
          // selectedCount={selectedIds.size}
          />


          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-600">
        Showing {totalProducts > 0 ? startItem : 0}-{endItem} of {totalProducts.toLocaleString()}
      </div>


      {/* Table */}
      <UsaMasterTable
        searchTerm={searchTerm}
        hiddenColumns={hiddenColumns}  // ADD THIS
        columnWidths={columnWidths}
        onColumnWidthChange={handleColumnWidthChange}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        // tableName={TABLE_NAME}
        refreshTrigger={refreshTrigger}
        currentPage={currentPage}
        itemsPerPage={ITEMS_PER_PAGE}
        onTotalProductsChange={setTotalProducts}
        onTotalPagesChange={setTotalPages}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
      />


      {/* Pagination */}
      <div className="flex items-center justify-between">
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
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
      </div>


      {/* Modals */}
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
        multiple={true}
      />
    </div>
  );
}