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
import FlipkartMasterTable from './components/FlipkartMasterTable';
import {
  parseFile as parseUploadedFile
} from '@/lib/utils/master-table/uploadHelpers'
import { exportData } from '@/lib/utils/exportHelpers'
import { supabase } from '@/lib/supabaseClient'
import { filterDuplicateASINs, bulkUpdateAsinRemarkMonthlyUnit } from '@/lib/utils/master-table/uploadHelpers';

import {
  Search,
  Database,
  Upload,
  Columns,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'; // Added Lucide icons for modern look

const TABLE_NAME = 'flipkart_master_sellers';

// ✅ Helper function to detect partial update file
function isPartialUpdateFile(headers: string[]) {
  // ✅ Normalize: lowercase + spaces to underscores
  const normalized = headers.map(h =>
    h.trim()
      .toLowerCase()
      .replace(/\s+/g, '_')  // ← Convert spaces to underscores
  );

  const allowed = [
    "asin",
    "remark",
    "remarks",
    "monthly_unit",
    "monthly_units",
    "monthly_units_sold",
    "monthly_unit_sold"
  ];

  // Must have ASIN
  if (!normalized.includes("asin")) {
    return false;
  }

  // All columns must be in allowed list
  if (!normalized.every(h => allowed.includes(h))) {
    return false;
  }

  // Must have at least one update column
  const hasRemarkColumn = normalized.some(h =>
    h === "remark" || h === "remarks"
  );

  const hasMonthlyUnitColumn = normalized.some(h =>
    h === "monthly_unit" ||
    h === "monthly_units" ||
    h === "monthly_units_sold" ||
    h === "monthly_unit_sold"
  );

  return hasRemarkColumn || hasMonthlyUnitColumn;
}

const ALL_COLUMNS = [
  's_no', 'asin', 'link', 'amz_link', 'product_name', 'remark', 'brand', 'price',
  'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category',
  'dimensions', 'weight', 'weight_unit'
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  's_no': 60,
  'asin': 120,
  'link': 80,
  'amz_link': 120,
  'product_name': 300,
  'remark': 120,
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

export default function FlipkartSellersPage() {
  // --- EXISTING STATE & LOGIC (PRESERVED) ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
  const [dataLoaded, setDataLoaded] = useState(false);

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

  // Auto-generate Amazon link from ASIN (Flipkart = India = amazon.in)
  const generateAmazonLink = (asin: string): string => {
    if (!asin) return '';
    return `https://www.amazon.in/dp/${asin}`;
  };


  // FIXED: Handle multiple file uploads with batch insert
  const handleUpload = async (files: File[]) => {
    if (!supabase) return;
    if (files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Processing ${files.length} file(s)...`);

    try {
      let allNewProducts: any[] = [];
      let totalDuplicates = 0;
      let totalUpdated = 0;
      let hasPartialUpdate = false;

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
              if (!product.amz_link) {
                product.amz_link = generateAmazonLink(product.asin)
              }
              if (!product.link) {
                product.link = product.amz_link;
              }

              // ✅ HANDLE REMARK COLUMN - Case-insensitive mapping
              if (!product.remark) {
                product.remark = product.REMARK ||
                  product.Remark ||
                  product.remarks ||
                  product.REMARKS ||
                  product.Remarks ||
                  null;
              }
            }
            return product;
          })
          .filter(Boolean);

        // ✅ Check if this is a partial update file
        const rawHeaders = Object.keys(data[0] || {});

        // ✅ DEBUG LOGGING (remove after testing)
        console.log('🔍 Raw headers from CSV:', rawHeaders);
        console.log('🔍 Normalized:', rawHeaders.map(h => h.trim().toLowerCase()));
        console.log('🔍 First data row:', data[0]);
        console.log('🔍 Is partial update?', isPartialUpdateFile(rawHeaders));
        console.log('🔍 Total rows:', data.length);

        if (isPartialUpdateFile(rawHeaders)) {
          // ✅ Show initial toast with unique ID
          const partialToastId = toast.loading(`Processing ${normalizedData.length.toLocaleString()} records...`);

          try {
            // ✅ Call batched function with progress callback
            const { updatedCount, skippedCount, message } =
              await bulkUpdateAsinRemarkMonthlyUnit(
                normalizedData,
                TABLE_NAME,
                (current, total) => {
                  // Update toast with progress
                  const percentage = Math.round((current / total) * 100);
                  toast.loading(
                    `Updating: ${current.toLocaleString()}/${total.toLocaleString()} (${percentage}%)`,
                    { id: partialToastId }
                  );
                }
              );

            totalUpdated += updatedCount;
            hasPartialUpdate = true;

            if (updatedCount > 0) {
              toast.success(
                message || `✅ ${updatedCount.toLocaleString()} products updated from ${file.name}`,
                { id: partialToastId, duration: 5000 }
              );
            } else {
              toast.error(
                `⚠️ No products updated from ${file.name}. Check ASINs match master table.`,
                { id: partialToastId, duration: 5000 }
              );
            }

            console.log(`✅ Partial update: ${updatedCount} updated, ${skippedCount} skipped from ${file.name}`);
          } catch (err: any) {
            console.error('Partial update failed:', err);
            toast.error(
              `❌ Partial update failed: ${err.message}`,
              { id: partialToastId, duration: 5000 }
            );
          }

          continue; // ✅ Skip to next file
        }

        // For full files, filter duplicates
        const { newProducts, duplicateCount } =
          await filterDuplicateASINs(normalizedData, TABLE_NAME);

        allNewProducts.push(...newProducts);
        totalDuplicates += duplicateCount;
      }

      // ============================================================
      // DECISION LOGIC: What to do after processing all files
      // ============================================================

      // Case 1: Only partial updates (no new inserts)
      if (hasPartialUpdate && allNewProducts.length === 0) {
        toast.success(
          `✅ ${totalUpdated} products updated successfully`,
          { id: toastId, duration: 5000 }
        );
        setRefreshTrigger(prev => prev + 1);
        setIsUploading(false);
        return;
      }

      // Case 2: No updates and no new products (all duplicates)
      if (!hasPartialUpdate && allNewProducts.length === 0) {
        toast.error(
          `All ${totalDuplicates} products are duplicates. No new data uploaded.`,
          { id: toastId, duration: 5000 }
        );
        setIsUploading(false);
        return;
      }

      // ============================================================
      // BATCH INSERT: Process new products
      // ============================================================

      // CRITICAL: Remove duplicate ASINs within the batch
      const uniqueProductsMap = new Map();
      allNewProducts.forEach(product => {
        if (product.asin) {
          uniqueProductsMap.set(product.asin, product);
        }
      });
      allNewProducts = Array.from(uniqueProductsMap.values());

      console.log(`✅ After deduplication: ${allNewProducts.length} unique products`);

      // Step 2: OPTIMIZED Batch insert
      const batchSize = 200;
      const totalBatches = Math.ceil(allNewProducts.length / batchSize);
      let successCount = 0;
      let failedBatches = 0;

      setUploadProgress({
        current: 0,
        total: allNewProducts.length,
        batch: 0,
        totalBatches,
      });

      const batches: any[][] = [];
      for (let i = 0; i < allNewProducts.length; i += batchSize) {
        const batch = allNewProducts.slice(i, i + batchSize);
        batches.push(batch);
      }

      const uploadBatch = async (batch: any[], batchIndex: number): Promise<{ success: boolean; count: number }> => {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            const cleanBatch = batch.map((product) => {
              const cleaned: any = {};
              Object.keys(product).forEach((key) => {
                if (product[key] !== undefined && product[key] !== null) {
                  cleaned[key] = product[key];
                }
              });
              return cleaned;
            });

            // ✅ Use RPC function instead of direct upsert
            const { data, error } = await supabase
              .rpc('bulk_insert_flipkart_master_with_distribution', {
                batch_data: cleanBatch
              });

            if (error) throw error;

            return { success: true, count: batch.length };
          } catch (error: any) {
            attempt++;
            console.error(`Batch ${batchIndex + 1} failed (attempt ${attempt}/${maxRetries}):`, error);
            if (attempt >= maxRetries) return { success: false, count: 0 };
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        return { success: false, count: 0 };
      };

      for (let i = 0; i < batches.length; i++) {
        toast.loading(
          `Uploading batch ${i + 1} of ${totalBatches}... (${successCount.toLocaleString()}/${allNewProducts.length.toLocaleString()})`,
          { id: toastId }
        );

        const result = await uploadBatch(batches[i], i);

        if (result.success) {
          successCount += result.count;
        } else {
          failedBatches++;
        }

        setUploadProgress({
          current: successCount,
          total: allNewProducts.length,
          batch: i + 1,
          totalBatches,
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // ============================================================
      // FINAL SUMMARY
      // ============================================================
      const summaryLines = [];
      if (totalUpdated > 0) summaryLines.push(`✅ Updated ${totalUpdated} products`);
      if (successCount > 0) summaryLines.push(`✅ Successfully inserted ${successCount.toLocaleString()} products`);
      if (totalDuplicates > 0) summaryLines.push(`⚠️ Skipped ${totalDuplicates.toLocaleString()} duplicates`);
      if (failedBatches > 0) summaryLines.push(`❌ ${failedBatches} batch(es) failed`);

      // AFTER (New code with auto-distribution):
      if (successCount > 0 || totalUpdated > 0) {
        toast.success(summaryLines.join('\n'), { id: toastId, duration: 6000 });
        setRefreshTrigger((prev) => prev + 1);

        // ✅ AUTO-TRIGGER BACKGROUND DISTRIBUTION
        triggerBackgroundDistribution(TABLE_NAME);
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

  // AUTO-TRIGGER BACKGROUND DISTRIBUTION (CHUNKED — 100K SAFE)
  const triggerBackgroundDistribution = async (tableName: string) => {
    if (!supabase) return;

    if (tableName === 'flipkart_master_sellers') {
      const distToastId = toast.loading('Distributing to all 24 tables...', {
        style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
      });

      try {
        // Get total records to distribute
        const { count, error: countError } = await supabase
          .from('flipkart_distribution_queue')
          .select('*', { count: 'exact', head: true });

        if (countError || !count) {
          toast.error('Failed to get record count', { id: distToastId });
          return;
        }

        const DIST_CHUNK = 10000;
        const totalChunks = Math.ceil(count / DIST_CHUNK);
        let totalInserted = 0;

        for (let chunk = 0; chunk < totalChunks; chunk++) {
          const offset = chunk * DIST_CHUNK;

          toast.loading(
            `Distributing ${Math.min(offset + DIST_CHUNK, count).toLocaleString()}/${count.toLocaleString()} to 24 tables...`,
            { id: distToastId }
          );

          const { data, error } = await supabase.rpc(
            'distributeflipkartchunked',
            { chunk_offset: offset, chunk_limit: DIST_CHUNK }
          );

          if (error) {
            console.error(`Distribution chunk ${chunk + 1}/${totalChunks} failed:`, error);
            // Don't throw — continue with next chunk
            continue;
          }

          if (data?.inserted) totalInserted += data.inserted;

          // Small delay between chunks
          if (chunk < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        toast.success(
          `✅ ${totalInserted.toLocaleString()} records distributed to all 24 tables!`,
          { id: distToastId, duration: 4000 }
        );
        setRefreshTrigger((prev: number) => prev + 1);

      } catch (err: any) {
        console.error('Distribution failed:', err);
        toast.error(`Distribution failed: ${err.message}`, { id: distToastId, duration: 4000 });
      }
      return;
    }

    // Non-flipkart tables — original logic
    const functionName =
      tableName === 'india_master_sellers'
        ? 'distributeindiatoalltables'
        : 'distributeuktoalltables';

    toast('Syncing to all tables in background...', {
      duration: 3000,
      style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
    });

    try {
      const { data, error } = await supabase.rpc(functionName);
      if (error) {
        console.error('Background distribution error:', error);
        toast.error('Distribution may be delayed. Check tables manually.', { duration: 4000 });
      } else if (data) {
        const duration = data.durationseconds ? ` (${Math.round(data.durationseconds)}s)` : '';
        toast.success(`All tables synced!${duration}`, { duration: 3000 });
        setRefreshTrigger((prev: number) => prev + 1);
      } else {
        toast('Distribution completed', { duration: 2000 });
        setRefreshTrigger((prev: number) => prev + 1);
      }
    } catch (err: any) {
      console.error('Distribution failed:', err);
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
        setToast({ message: 'No data to export', type: 'error' });
        setIsExporting(false);
        return;
      }

      setExportProgress({ current: 0, total: totalCount });

      let allData: any[] = [];
      let offset = 0;
      const batchSize = 300;
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

      // ✅ FORMAT DATA FOR EXPORT - Include Remark column
      const formattedData = allData.map((item, index) => ({
        'S.No': index + 1,
        'ASIN': item.asin || '',
        'Link': item.amz_link || '',
        'Product Name': item.product_name || '',
        'Remark': item.remark || '',
        'Brand': item.brand || '',
        'Price': item.price || '',
        'Monthly Units': item.monthly_unit || '',
        'Monthly Sales': item.monthly_sales || '',
        'BSR': item.bsr || '',
        'Sellers': item.seller || '',
        'Category': item.category || '',
        'Dimensions': item.dimensions || '',
        'Weight': item.weight ? `${item.weight} g` : '',
      }));

      exportData(formattedData, TABLE_NAME, format);
      setToast({ message: `Successfully exported ${allData.length} products!`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setToast({ message: 'Failed to export data', type: 'error' });
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalProducts);

  // --- UPDATED UI RETURN ---
  return (
    <>
      <div className="min-h-screen bg-[#111111] text-gray-100 p-6 lg:p-10 font-sans selection:bg-orange-400/30">
        <Toaster position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
          }}
        />

        {/* Upload Progress Modal - Dark Mode */}
        {isUploading && (
          <div className="fixed inset-0 bg-[#111111] flex items-center justify-center z-50">
            <div className="bg-[#111111] border border-white/[0.06] rounded-lg p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-16 w-16 text-orange-500 animate-spin" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white">Uploading Products...</h3>
                {uploadProgress.total > 0 && (
                  <>
                    <p className="text-gray-400 mb-2">Batch {uploadProgress.batch} of {uploadProgress.totalBatches}</p>
                    <p className="text-2xl font-bold text-orange-500 mb-4">{uploadProgress.current.toLocaleString()} / {uploadProgress.total.toLocaleString()}</p>
                    <div className="w-full bg-[#111111] rounded-full h-3 mb-2 overflow-hidden">
                      <div className="bg-orange-500/100 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-300">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}% complete</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export Loading Modal - Dark Mode */}
        {isExporting && (
          <div className="fixed inset-0 bg-[#111111] flex items-center justify-center z-50">
            <div className="bg-[#111111] border border-white/[0.06] rounded-lg p-8 max-w-md w-full shadow-2xl">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-16 w-16 text-emerald-500 animate-spin" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white">Exporting Data...</h3>
                {exportProgress.total > 0 && (
                  <>
                    <p className="text-2xl font-bold text-emerald-400 mb-4">{exportProgress.current.toLocaleString()} / {exportProgress.total.toLocaleString()} products</p>
                    <div className="w-full bg-[#111111] rounded-full h-3 mb-2 overflow-hidden">
                      <div className="bg-emerald-600 h-3 rounded-full transition-all duration-300" style={{ width: `${Math.round((exportProgress.current / exportProgress.total) * 100)}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-300">{Math.round((exportProgress.current / exportProgress.total) * 100)}% complete</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === HEADER === */}
        <div className="sticky top-0 z-40 bg-[#1a1a1a] border-b border-white/[0.06] -mx-10 px-10 py-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/100/10 rounded-xl border border-orange-500/20 shadow-lg shadow-indigo-500/10">
                <Database className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">FLIPKART Sellers Database</h1>
                <p className="text-sm text-gray-300">Master inventory records</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by ASIN, Brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-72 pl-10 pr-4 py-2 bg-[#111111] border border-white/[0.06] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-500"
                />
              </div>

              <button
                onClick={() => setIsColumnToggleOpen(true)}
                className="px-3 py-2 bg-[#111111] border border-white/[0.06] rounded-lg hover:bg-[#111111] text-gray-500 text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Columns className="w-4 h-4" /> Columns
              </button>

              <div onClick={() => handleExport('csv')} className="cursor-pointer">
                {/* Re-using your Export Button logic but styling wrapper or passing styles if supported */}
                <button className="px-3 py-2 bg-emerald-500/100/20 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/100/20 text-sm font-medium flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3 py-2 bg-orange-500/100 text-white rounded-lg hover:bg-orange-400 text-sm font-medium flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all"
              >
                <Upload className="w-4 h-4" /> Upload
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-300 font-mono mb-4">
          Showing <span className="text-gray-100">{totalProducts > 0 ? startItem : 0}-{endItem}</span> of <span className="text-white font-bold">{totalProducts.toLocaleString()}</span> records
        </div>

        {/* Table Component */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl overflow-hidden shadow-xl">
          <FlipkartMasterTable
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

          {/* Pagination */}
          <div className="border-t border-white/[0.06] bg-[#1a1a1a] p-4 flex items-center justify-between">
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-[#111111] border border-white/[0.06] text-gray-500 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Previous
                </button>
                <span className="text-xs text-gray-300">
                  Page <span className="text-gray-100">{currentPage}</span> of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-[#111111] border border-white/[0.06] text-gray-500 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modals - Keeping Logic, wrapping them if necessary */}
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
    </>
  );
}//C:\Users\Admin\Desktop\Project2\ScrappyioV2-main\app\dashboard\manage-sellers\flipkart-sellers\page.tsx