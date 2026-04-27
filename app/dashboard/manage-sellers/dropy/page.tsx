'use client';

export const dynamic = 'force-dynamic'

import {
  normalizeDataForDB,
  // filterDuplicateASINs,
} from '@/lib/utils/master-table/dataHelpers'
import { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import ColumnToggle from '@/components/shared/master-table/ColumnToggle';
import UploadModal from '@/components/shared/master-table/UploadModal';
import ExportButton from '@/components/shared/master-table/ExportButton';
import DropyMasterTable from './components/DropyMasterTable';
import {
  parseFile as parseUploadedFile
} from '@/lib/utils/master-table/uploadHelpers'
import { exportData } from '@/lib/utils/exportHelpers'
import { supabase } from '@/lib/supabaseClient'
import { filterDuplicateASINs } from '@/lib/utils/master-table/uploadHelpers';
import {
  Search,
  Database,
  Upload,
  Columns,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

const TABLE_NAME = 'dropy_master_sellers';

// ✅ UPDATE 1: Add 'country_tag' column definition
const ALL_COLUMNS = [
  's_no', 'country_tag', 'asin', 'link', 'amz_link', 'product_name', 'brand', 'price',
  'monthly_unit', 'monthly_sales', 'bsr', 'seller', 'category',
  'dimensions', 'weight', 'weight_unit'
];

// ✅ UPDATE 2: Set width for the new column
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  's_no': 60,
  'country_tag': 80, // New Column
  'asin': 120,
  'link': 80,
  'amz_link': 120,
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

export default function DropySellersPage() {
  const [toastState, setToastState] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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

  const generateAmazonLink = (asin: string, country: 'usa' | 'india'): string => {
    if (!asin) return '';
    const domain = country === 'usa' ? 'amazon.com' : 'amazon.in';
    return `https://www.${domain}/dp/${asin}`;
  };

  // ... existing imports

  // ... existing imports

  const handleUpload = async (files: File[]) => {
    if (!supabase) return;
    if (files.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Processing ${files.length} file(s)...`);

    try {
      let allProcessedProducts: any[] = [];

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

        const normalizedData = normalizeDataForDB(data)
          .map((product) => {
            if (product && product.asin) {
              // 1. Detect Country from this file
              let country: 'usa' | 'india' = 'usa'; // Default

              const linksToCheck = [product.link, product.amz_link, product.url, product.product_link].filter(Boolean);
              const allValues = Object.values(product).map(v => String(v).toLowerCase());

              const hasIndiaLink = linksToCheck.some(l => l.toLowerCase().includes('amazon.in') || l.toLowerCase().includes('.in/'));
              const hasIndiaSignal = allValues.some(v => v.includes('amazon.in') || v === 'in' || v === 'india');

              if (hasIndiaLink || hasIndiaSignal) {
                country = 'india';
              }

              // 2. Set the Initial Tag
              product.country_tag = country === 'india' ? 'IN' : 'USA';

              // 3. Generate Link
              if (!product.amz_link) {
                product.amz_link = generateAmazonLink(product.asin, country);
              }
              if (!product.link) {
                product.link = product.amz_link;
              }
            }
            return product;
          })
          .filter(Boolean);

        // We push ALL products because we need to check/update existing ones, not skip them.
        allProcessedProducts.push(...normalizedData);
      }

      if (allProcessedProducts.length === 0) {
        toast.error('No valid products found to process.', { id: toastId });
        setIsUploading(false);
        return;
      }

      // Deduplicate within the current upload batch (last one wins)
      const uniqueProductsMap = new Map();
      allProcessedProducts.forEach(product => {
        if (product.asin) {
          uniqueProductsMap.set(product.asin, product);
        }
      });
      const finalBatch = Array.from(uniqueProductsMap.values());

      // --- BATCH PROCESSING WITH MERGE LOGIC ---
      const batchSize = 100;
      const totalBatches = Math.ceil(finalBatch.length / batchSize);
      let successCount = 0;
      let failedBatches = 0;

      setUploadProgress({
        current: 0,
        total: finalBatch.length,
        batch: 0,
        totalBatches,
      });

      for (let i = 0; i < finalBatch.length; i += batchSize) {
        const batch = finalBatch.slice(i, i + batchSize);
        const batchAsins = batch.map(p => p.asin);

        toast.loading(
          `Syncing batch ${Math.floor(i / batchSize) + 1}/${totalBatches}...`,
          { id: toastId }
        );

        // A. Fetch existing tags for these ASINs from DB
        const { data: existingRows } = await supabase
          .from(TABLE_NAME)
          .select('asin, country_tag')
          .in('asin', batchAsins);

        const existingTagMap = new Map();
        existingRows?.forEach(row => {
          existingTagMap.set(row.asin, row.country_tag);
        });

        // B. Prepare Upsert Payload with Merged Tags
        const cleanBatch = batch.map((product) => {
          const cleaned: any = {};

          // Copy fields
          Object.keys(product).forEach((key) => {
            if (product[key] !== undefined && product[key] !== null) {
              cleaned[key] = product[key];
            }
          });

          // ✅ MERGE LOGIC
          const newTag = product.country_tag || 'USA';
          const oldTag = existingTagMap.get(product.asin);

          if (oldTag) {
            // If old tag exists and is different (e.g. "USA" vs "IN"), combine them
            if (!oldTag.includes(newTag)) {
              // Example: old="USA", new="IN" -> "USA, IN"
              cleaned.country_tag = `${oldTag}, ${newTag}`;
            } else {
              // Keep existing (might be "USA, IN" already)
              cleaned.country_tag = oldTag;
            }
          } else {
            // New record
            cleaned.country_tag = newTag;
          }

          return cleaned;
        });

        // C. Upsert
        const { error } = await supabase
          .from(TABLE_NAME)
          .upsert(cleanBatch, {
            onConflict: 'asin',
            ignoreDuplicates: false // We want to update!
          });

        if (!error) {
          successCount += batch.length;
        } else {
          console.error('Batch error:', error);
          failedBatches++;
        }

        setUploadProgress({
          current: successCount,
          total: finalBatch.length,
          batch: Math.floor(i / batchSize) + 1,
          totalBatches,
        });
      }

      toast.success(`Processed ${successCount} products! Distributing to validation...`, { id: toastId });

      // Auto-distribute to validation + seller_products
      try {
        const { data: masterData } = await supabase
          .from('dropy_master_sellers')
          .select('asin, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, remark')
          .in('asin', Array.from(uniqueProductsMap.keys()));

        if (masterData && masterData.length > 0) {
          const batchSize = 500;
          for (let i = 0; i < masterData.length; i += batchSize) {
            const chunk = masterData.slice(i, i + batchSize).map(r => ({
              ...r, remark: r.remark || ''
            }));
            await supabase.rpc('bulk_insert_dropy_master_with_distribution', { batch_data: chunk });
          }
          toast.success(`${successCount} products uploaded & distributed to validation!`, { id: toastId });
        }
      } catch (distErr: any) {
        console.error('Distribution error:', distErr);
        toast.error(`Uploaded but distribution failed: ${distErr.message}`, { id: toastId });
      }

      setRefreshTrigger(prev => prev + 1);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Upload failed.', { id: toastId });
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, batch: 0, totalBatches: 0 });
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    // (Export logic maintained - just referencing TABLE_NAME)
    // I'm keeping the original logic for brevity as requested, it just needs the TABLE_NAME constant
    // which is already defined.
    // ... original export logic ...
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
        setToastState({ message: 'No data to export', type: 'error' });
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
      setToastState({ message: `Successfully exported ${allData.length} products!`, type: 'success' });
      setTimeout(() => setToastState(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setToastState({ message: 'Failed to export data', type: 'error' });
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalProducts);

  return (
    <>
      <div className="min-h-screen bg-[#111111] text-gray-100 p-6 lg:p-10 font-sans selection:bg-orange-400/30">
        <Toaster position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
          }}
        />

        {isUploading && (
          <div className="fixed inset-0 bg-[#111111] flex items-center justify-center z-50">
            <div className="bg-[#111111] border border-white/[0.1] rounded-lg p-8 max-w-md w-full shadow-2xl">
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
                      <div className="bg-orange-500 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-300">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}% complete</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {isExporting && (
          <div className="fixed inset-0 bg-[#111111] flex items-center justify-center z-50">
            <div className="bg-[#111111] border border-white/[0.1] rounded-lg p-8 max-w-md w-full shadow-2xl">
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

        <div className="sticky top-0 z-40 bg-[#1a1a1a] border-b border-white/[0.1] -mx-10 px-10 py-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20 shadow-lg shadow-indigo-500/10">
                <Database className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Dropy Sellers Database</h1>
                <p className="text-sm text-gray-300">Master inventory records</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Search by ASIN, Brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-72 pl-10 pr-4 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-gray-100 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-gray-500"
                />
              </div>

              <button
                onClick={() => setIsColumnToggleOpen(true)}
                className="px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg hover:bg-[#111111] text-gray-500 text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Columns className="w-4 h-4" /> Columns
              </button>

              <div onClick={() => handleExport('csv')} className="cursor-pointer">
                <button className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/20 text-sm font-medium flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-400 text-sm font-medium flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all"
              >
                <Upload className="w-4 h-4" /> Upload
              </button>
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-300 font-mono mb-4">
          Showing <span className="text-gray-100">{totalProducts > 0 ? startItem : 0}-{endItem}</span> of <span className="text-white font-bold">{totalProducts.toLocaleString()}</span> records
        </div>

        <div className="bg-[#111111] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
          <DropyMasterTable
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

          <div className="border-t border-white/[0.1] bg-[#1a1a1a] p-4 flex items-center justify-between">
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Previous
                </button>
                <span className="text-xs text-gray-300">
                  Page <span className="text-gray-100">{currentPage}</span> of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

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
        {toastState && (
          <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
            <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toastState.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
              <span className="text-2xl">{toastState.type === 'success' ? '✅' : '❌'}</span>
              <span className="font-semibold flex-1 text-sm">{toastState.message}</span>
              <button onClick={() => setToastState(null)} className="text-white/70 hover:text-white ml-2">✕</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}