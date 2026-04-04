'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import { useAuth } from '@/lib/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import { ensureAbsoluteUrl } from '@/lib/utils';
import {
  Search,
  RotateCcw,
  Check,
  X,
  Trash2,
  ExternalLink,
  AlertOctagon,
  Loader2,
  LayoutList,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

/* === CONFIGURATION === */
const SELLER_ID = 5;
const SELLER_NAME = "Dropy Ecom";
const BASE_TABLE_PREFIX = `india_listing_error_seller_${SELLER_ID}`;
const ITEMS_PER_PAGE = 100;
const getTablesForTab = (tab: TabType): string[] => {
  switch (tab) {
    case 'high_demand': return [`${BASE_TABLE_PREFIX}_high_demand`, `${BASE_TABLE_PREFIX}_low_demand`];
    case 'dropshipping': return [`${BASE_TABLE_PREFIX}_dropshipping`];
    case 'done': return [`${BASE_TABLE_PREFIX}_done`];
    case 'pending': return [`${BASE_TABLE_PREFIX}_pending`];
    case 'error': return [`${BASE_TABLE_PREFIX}_error`];
    case 'removed': return [`${BASE_TABLE_PREFIX}_removed`];
    default: return [`${BASE_TABLE_PREFIX}_${tab}`];
  }
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// 🆕 SELLER TAG COLORS (same as purchases page)
const SELLER_TAG_COLORS: Record<string, string> = {
  GR: 'bg-yellow-500 text-black border border-yellow-600',
  RR: 'bg-slate-500 text-white border border-white/[0.1]',
  UB: 'bg-pink-500 text-white border border-pink-600',
  VV: 'bg-purple-500 text-white border border-purple-600',
  DE: 'bg-cyan-500 text-black border border-cyan-600',
  CV: 'bg-teal-500 text-white border border-teal-600',
};

// 🆕 SELLER TAG FILTER COLORS (gradient style for filter buttons)
const SELLER_TAG_FILTER_COLORS: Record<string, string> = {
  GR: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg',
  RR: 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg',
  UB: 'bg-gradient-to-br from-pink-400 to-pink-600 text-white shadow-lg',
  VV: 'bg-gradient-to-br from-purple-400 to-purple-600 text-white shadow-lg',
  DE: 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-lg',
  CV: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg',
};

interface ListingProduct {
  id: string;
  asin: string;
  product_name: string | null;
  sku: string | null;
  selling_price: number | null;
  seller_link: string | null;
  min_price?: number | null;
  max_price?: number | null;
  listing_notes?: string | null;
  error_reason?: string | null;
  source_admin_validation_id?: string;
  journey_id?: string | null;
  journey_number?: number | null;
  remark: string | null;
  seller_tag?: string | null; // 🆕
}

type TabType = 'high_demand' | 'low_demand' | 'dropshipping' | 'done' | 'pending' | 'error' | 'removed';

const TABS = [
  { id: 'high_demand', label: 'Restock', color: 'text-emerald-400', glow: 'shadow-[0_0_20px_-5px_rgba(52,211,153,0.5)]' },
  { id: 'dropshipping', label: 'Dropshipping', color: 'text-amber-400', glow: 'shadow-[0_0_20px_-5px_rgba(251,191,36,0.5)]' },
  { id: 'done', label: 'Listed', color: 'text-gray-100', glow: '' },
  { id: 'pending', label: 'Pending', color: 'text-orange-500', glow: '' },
  { id: 'error', label: 'Errors', color: 'text-rose-400', glow: '' },
  { id: 'removed', label: 'Removed', color: 'text-gray-500', glow: '' },
];

export default function DropyEcomListingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('high_demand');
  const [products, setProducts] = useState<ListingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { logActivity } = useActivityLogger();

  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [selectedForError, setSelectedForError] = useState<ListingProduct | null>(null);
  const [errorReasonInput, setErrorReasonInput] = useState('');

  const [movementHistory, setMovementHistory] = useState<{
    [key: string]: {
      product: ListingProduct;
      fromTable: string;
      toTable: string;
    } | null;
  }>({});

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [editingRemarkProductId, setEditingRemarkProductId] = useState<string | null>(null);

  const SELLER_TAG_MAP: Record<number, string> = { 1: 'GR', 2: 'RR', 3: 'UB', 4: 'VV', 5: 'DE', 6: 'CV', 7: 'MV', 8: 'KL' };
  const SELLER_NAME_MAP: Record<number, string> = {
    1: 'Golden Aura', 2: 'Rudra Retail', 3: 'UBeauty',
    4: 'Velvet Vista', 5: 'Dropy Ecom', 6: 'Costech Ventures',
    7: 'Maverick', 8: 'Kalash'
  };
  const ALL_SELLER_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

  type CrossSellerInfo = { tag: string; sellerName: string; listedAt: string | null };
  const [listedByOthers, setListedByOthers] = useState<Record<string, CrossSellerInfo[]>>({});
  const [minPercent, setMinPercent] = useState(5);
  const [maxPercent, setMaxPercent] = useState(20);
  const [editingMinHeader, setEditingMinHeader] = useState(false);
  const [editingMaxHeader, setEditingMaxHeader] = useState(false);
  const [tempHeaderValue, setTempHeaderValue] = useState('');

  // Calculate min/max from price
  const calcMin = (price: number | null) => price ? Math.round(price * (1 - minPercent / 100) * 100) / 100 : null;
  const calcMax = (price: number | null) => price ? Math.round(price * (1 + maxPercent / 100) * 100) / 100 : null;
  const batchUpdateMinMax = async (newMinPct: number, newMaxPct: number) => {
    try {
      const tables = getTablesForTab(activeTab);
      for (const table of tables) {
        const { data } = await supabase.from(table).select('id, selling_price');
        if (!data || data.length === 0) continue;
        const updates = data
          .filter((p: any) => p.selling_price)
          .map((p: any) =>
            supabase.from(table).update({
              min_price: Math.round(p.selling_price * (1 - newMinPct / 100) * 100) / 100,
              max_price: Math.round(p.selling_price * (1 + newMaxPct / 100) * 100) / 100,
            }).eq('id', p.id)
          );
        await Promise.all(updates);
      }
      setToast({ message: `Updated Min(${newMinPct}%) / Max(${newMaxPct}%) for all products`, type: 'success' });
      fetchProducts();
    } catch (err) {
      console.error('Batch update error', err);
      setToast({ message: 'Failed to update prices', type: 'error' });
    }
  };

  useEffect(() => {
    setPage(1);
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        handleRollBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movementHistory, activeTab]);

  const fetchCrossSellerStatus = async (asins: string[]) => {
    if (asins.length === 0) return;
    const otherSellerIds = ALL_SELLER_IDS.filter(id => id !== SELLER_ID);
    const promises = otherSellerIds.map(async (id) => {
      const tag = SELLER_TAG_MAP[id];
      const sellerName = SELLER_NAME_MAP[id];
      const { data } = await supabase
        .from(`india_listing_error_seller_${id}_done`)
        .select('asin, created_at')
        .in('asin', asins);
      return { tag, sellerName, items: data || [] };
    });
    const results = await Promise.all(promises);
    const statusMap: Record<string, CrossSellerInfo[]> = {};
    for (const { tag, sellerName, items } of results) {
      for (const item of items as any[]) {
        if (!statusMap[item.asin]) statusMap[item.asin] = [];
        statusMap[item.asin].push({ tag, sellerName, listedAt: item.created_at || null });
      }
    }
    setListedByOthers(statusMap);
  };

  const fetchProducts = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setLoading(true);

    try {
      const tables = getTablesForTab(activeTab);

      if (tables.length === 1) {
        let query = supabase.from(tables[0]).select('*', { count: 'exact' });

        if (debouncedSearch.trim()) {
          const term = debouncedSearch.trim();
          query = query.or(`asin.ilike.%${term}%,product_name.ilike.%${term}%,sku.ilike.%${term}%`);
        }

        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        const { data, count, error } = await query
          .order('id', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setProducts(data);
        setTotalItems(count || 0);
        fetchCrossSellerStatus(data.map((p: any) => p.asin));

      } else {
        const results = await Promise.all(
          tables.map(table => {
            let query = supabase.from(table).select('*', { count: 'exact' });
            if (debouncedSearch.trim()) {
              const term = debouncedSearch.trim();
              query = query.or(`asin.ilike.%${term}%,product_name.ilike.%${term}%,sku.ilike.%${term}%`);
            }
            return query.order('id', { ascending: false });
          })
        );

        let allData: (ListingProduct & { _sourceTable?: string })[] = [];
        let totalCount = 0;

        results.forEach((res, i) => {
          if (res.error) console.error('Fetch error from', tables[i], res.error);
          const tagged = (res.data || []).map((item: any) => ({ ...item, _sourceTable: tables[i] }));
          allData = [...allData, ...tagged];
          totalCount += (res.count || 0);
        });

        allData.sort((a, b) => (b.id > a.id ? 1 : -1));

        const from = (page - 1) * ITEMS_PER_PAGE;
        const sliced = allData.slice(from, from + ITEMS_PER_PAGE);

        setProducts(sliced);
        setTotalItems(totalCount);
        fetchCrossSellerStatus(sliced.map((p: any) => p.asin));
      }

    } catch (err: any) {
      console.error('Fetch error:', err);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, user, page]); // 🆕 Added sellerTagFilter

  useEffect(() => {
    fetchProducts(true);

    // Subscribe to current seller's tables
    const tables = getTablesForTab(activeTab);
    const channels = tables.map((tableName) => {
      const channelName = `realtime_${tableName}`;
      return supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => fetchProducts())
        .subscribe();
    });

    // Subscribe to OTHER sellers' _done tables for cross-seller status updates
    const otherSellerIds = ALL_SELLER_IDS.filter(id => id !== SELLER_ID);
    const crossChannels = otherSellerIds.map((id) => {
      const doneTable = `india_listing_error_seller_${id}_done`;
      return supabase
        .channel(`cross_seller_${id}_done`)
        .on('postgres_changes', { event: '*', schema: 'public', table: doneTable }, () => {
          // Silent re-fetch of cross-seller status only (not full product reload)
          const currentAsins = products.map(p => p.asin);
          fetchCrossSellerStatus(currentAsins);
        })
        .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
      crossChannels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [fetchProducts, activeTab]);

  const updateProgressStats = async (type: 'listed' | 'error', increment: number) => {
    const { data: stats } = await supabase.from('listing_error_progress').select('*').eq('seller_id', SELLER_ID).single();
    if (stats) {
      const pendingChange = increment > 0 ? -1 : 1;
      const updates = {
        total_pending: Math.max(0, stats.total_pending + pendingChange),
        [type]: Math.max(0, stats[type] + increment),
        updated_at: new Date().toISOString()
      };
      await supabase.from('listing_error_progress').update(updates).eq('seller_id', SELLER_ID);
    }
  };

  const logHistory = async (product: ListingProduct, fromTable: string, toTable: string) => {
    try {
      await supabase.from(`${BASE_TABLE_PREFIX}_movement_history`).insert({
        source_admin_validation_id: product.source_admin_validation_id || null,
        asin: product.asin,
        product_name: product.product_name,
        sku: product.sku,
        selling_price: product.selling_price,
        seller_link: product.seller_link,
        from_table: fromTable,
        to_table: toTable,
        remark: product.remark ?? null
      });
      setMovementHistory((prev) => ({
        ...prev,
        [`${BASE_TABLE_PREFIX}_${activeTab}`]: { product, fromTable, toTable },
      }));
    } catch (err) { console.error("Log error:", err); }
  };

  const handleMoveProduct = async (product: ListingProduct, target: 'done' | 'error' | 'removed', reason?: string) => {
    setProcessingId(product.id);

    const journeyId = product.journey_id || generateUUID();
    const journeyNum = product.journey_number || 1;

    try {
      const sourceTableName = activeTab === 'high_demand'
        ? ((product as any)._sourceTable || `${BASE_TABLE_PREFIX}_high_demand`)
        : `${BASE_TABLE_PREFIX}_${activeTab}`;
      const targetTableName = `${BASE_TABLE_PREFIX}_${target}`;

      const payload = {
        source_admin_validation_id: product.source_admin_validation_id,
        asin: product.asin,
        product_name: product.product_name,
        sku: product.sku,
        selling_price: product.selling_price,
        seller_link: product.seller_link,
        journey_id: journeyId,
        journey_number: journeyNum,
        remark: product.remark ?? null,
        seller_tag: product.seller_tag ?? null,
        min_price: calcMin(product.selling_price),
        max_price: calcMax(product.selling_price),
        ...(target === 'done' ? { final_listed_price: product.selling_price } : {}),
        ...(target === 'error' ? { error_reason: reason || 'Unknown Error' } : {})
      };

      if (target === 'done') {
        const { error: historyError } = await supabase.from('india_asin_history').insert({
          asin: product.asin,
          journey_id: journeyId,
          journey_number: journeyNum,
          stage: 'listing_done',
          status: 'listed',
          profit: null,
          snapshot_data: {
            final_price: product.selling_price,
            sku: product.sku,
            listed_at: new Date().toISOString()
          }
        });
        if (historyError) console.error("⚠️ History snapshot failed:", historyError);
      }

      const { error: insertError } = await supabase.from(targetTableName).upsert(payload, { onConflict: 'asin' });
      if (insertError) throw insertError;

      await logHistory(product, sourceTableName, targetTableName);

      const sourceTablesToCheck = [
        `${BASE_TABLE_PREFIX}_pending`,
        `${BASE_TABLE_PREFIX}_high_demand`,
        `${BASE_TABLE_PREFIX}_low_demand`,
        `${BASE_TABLE_PREFIX}_dropshipping`,
        `${BASE_TABLE_PREFIX}_done`,
        `${BASE_TABLE_PREFIX}_error`,
      ].filter(t => t !== targetTableName);
      await Promise.all(sourceTablesToCheck.map(table => supabase.from(table).delete().eq('asin', product.asin)));

      if (target === 'done') await updateProgressStats('listed', 1);
      else if (target === 'error') await updateProgressStats('error', 1);
      else if (target === 'removed') {
        const { data: stats } = await supabase.from('listing_error_progress').select('total_pending').eq('seller_id', SELLER_ID).single();
        if (stats) await supabase.from('listing_error_progress').update({ total_pending: Math.max(0, stats.total_pending - 1) }).eq('seller_id', SELLER_ID);
      }

      setProducts(prev => prev.filter(p => p.id !== product.id));
      setToast({ message: `Moved to ${target === 'done' ? 'Listed' : target}`, type: 'success' });

      logActivity({
        action: target === 'done' ? 'listed' : target === 'error' ? 'error' : 'removed',
        marketplace: 'india',
        page: 'listing-error',
        table_name: `${BASE_TABLE_PREFIX}_${target}`,
        asin: product.asin,
        details: {
          from: activeTab,
          to: target,
          seller_id: SELLER_ID,
          seller_name: 'dropy-ecom',
          ...(reason ? { error_reason: reason } : {})
        }
      });

      if (products.length === 1 && page > 1) {
        setPage(prev => prev - 1);
      } else {
        fetchProducts();
      }

    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setProcessingId(null);
      setIsReasonModalOpen(false);
      setSelectedForError(null);
      setErrorReasonInput('');
    }
  };

  const handleRemarkSave = async (productId: string, newRemark: string | null) => {
    try {
      const currentTable = `${BASE_TABLE_PREFIX}_${activeTab}`;
      const { error } = await supabase.from(currentTable).update({ remark: newRemark }).eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, remark: newRemark } : p));
    } catch (err: any) { console.error('Failed to update remark:', err); }
  };

  const handleRollBack = async () => {
    const currentTable = `${BASE_TABLE_PREFIX}_${activeTab}`;
    const lastMovement = movementHistory[currentTable];
    if (!lastMovement) {
      setToast({ message: 'Nothing to undo', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { product, fromTable, toTable } = lastMovement;
      const { id, ...rest } = product;

      await supabase.from(fromTable).insert(rest);

      const funnelTables = [
        `${BASE_TABLE_PREFIX}_high_demand`,
        `${BASE_TABLE_PREFIX}_low_demand`,
        `${BASE_TABLE_PREFIX}_dropshipping`
      ];

      if (funnelTables.includes(fromTable)) {
        await supabase.from(`${BASE_TABLE_PREFIX}_pending`).upsert(rest, { onConflict: 'asin' });
      }

      await supabase.from(toTable).delete().eq('asin', product.asin);

      if (toTable.includes('done')) await updateProgressStats('listed', -1);
      else if (toTable.includes('error')) await updateProgressStats('error', -1);
      else if (toTable.includes('removed')) {
        const { data: stats } = await supabase.from('listing_error_progress').select('total_pending').eq('seller_id', SELLER_ID).single();
        if (stats) await supabase.from('listing_error_progress').update({ total_pending: stats.total_pending + 1 }).eq('seller_id', SELLER_ID);
      }

      setMovementHistory((prev) => ({ ...prev, [currentTable]: null }));
      fetchProducts();
      setToast({ message: `Restored ${product.asin} to ${activeTab} and Pending`, type: 'success' });

      logActivity({
        action: 'rollback',
        marketplace: 'india',
        page: 'listing-error',
        table_name: fromTable,
        asin: product.asin,
        details: { from: toTable, to: fromTable, seller_id: SELLER_ID, seller_name: 'dropy-ecom' }
      });
    } catch (err: any) {
      console.error("Rollback error:", err);
      setToast({ message: "Rollback failed", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const hasRollback = !!movementHistory[`${BASE_TABLE_PREFIX}_${activeTab}`];
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <>
      <div className="h-screen bg-[#111111] text-gray-100 font-sans selection:bg-orange-400/30 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col w-full mx-auto p-3 overflow-hidden">
          {/* === HEADER & CONTROLS === */}
          <div className="flex-none space-y-4 pb-4">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-white/[0.1]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <LayoutList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  </div>
                  <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">{SELLER_NAME}</h1>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 pl-[3.25rem]">Listing & Error Resolution Dashboard</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="px-3 sm:px-4 py-2 bg-[#111111] rounded-lg border border-white/[0.1] text-xs font-mono text-gray-300">
                  <span className="hidden sm:inline">TOTAL ITEMS:</span><span className="sm:hidden">TOTAL:</span> <span className="text-white font-bold text-sm sm:text-base ml-1 sm:ml-2">{totalItems}</span>
                </div>
              </div>
            </header>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-full sm:w-fit overflow-x-auto scrollbar-none">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as TabType); setSearchQuery(''); }}
                    className={`relative px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all duration-300 z-10 whitespace-nowrap ${activeTab === tab.id ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'}`}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-orange-500 rounded-xl shadow-sm -z-10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      {tab.label}
                      {activeTab === tab.id && <Sparkles className={`w-3 h-3 ${tab.color}`} />}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 bg-[#1a1a1a] p-3 sm:p-4 rounded-2xl border border-white/[0.1]">
                <div className="relative w-full sm:w-96 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by ASIN, Name, or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#111111] border border-white/[0.1] rounded-xl focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all outline-none text-sm placeholder:text-gray-500 text-gray-100"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <motion.button
                  whileHover={hasRollback ? { scale: 1.02 } : {}}
                  whileTap={hasRollback ? { scale: 0.98 } : {}}
                  onClick={handleRollBack}
                  disabled={!hasRollback}
                  className={`flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${hasRollback ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/10 hover:bg-orange-400' : 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'}`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Undo Action
                </motion.button>
              </div>
            </div>
          </div>

          {/* === TABLE CONTAINER === */}
          <div className="flex-1 min-h-0 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] flex flex-col relative overflow-hidden">
            <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">

              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                  <span className="text-sm font-medium tracking-wide">SYNCING DATA...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                  <div className="p-4 bg-[#111111] rounded-full border border-white/[0.1]">
                    <AlertOctagon className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-sm">No items found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1a1a1a] border-b border-white/[0.1] sticky top-0 z-20 shadow-md">
                    <tr>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0">ASIN</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider w-1/3 border-r border-white/[0.1] last:border-r-0">Product Details</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0">SKU</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0">Price</th>
                      {/* MIN PRICE - EDITABLE HEADER */}
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0 cursor-pointer select-none"
                        onClick={() => { setEditingMinHeader(true); setTempHeaderValue(String(minPercent)); }}>
                        {editingMinHeader ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-amber-400">Min</span>
                            <input
                              autoFocus
                              type="number"
                              value={tempHeaderValue}
                              onChange={(e) => setTempHeaderValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(tempHeaderValue);
                                  if (!isNaN(val) && val >= 0 && val <= 100) {
                                    setMinPercent(val);
                                    setEditingMinHeader(false);
                                    batchUpdateMinMax(val, maxPercent);
                                  }
                                }
                                if (e.key === 'Escape') setEditingMinHeader(false);
                              }}
                              onBlur={() => setEditingMinHeader(false)}
                              className="w-12 px-1 py-0.5 bg-[#111111] border border-orange-500 rounded text-xs text-white text-center focus:ring-1 focus:ring-orange-500"
                            />
                            <span className="text-amber-400">%</span>
                          </div>
                        ) : (
                          <span className="hover:text-amber-400 transition-colors" title="Click to edit %">
                            Min ({minPercent}%) ✎
                          </span>
                        )}
                      </th>

                      {/* MAX PRICE - EDITABLE HEADER */}
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0 cursor-pointer select-none"
                        onClick={() => { setEditingMaxHeader(true); setTempHeaderValue(String(maxPercent)); }}>
                        {editingMaxHeader ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-sky-400">Max</span>
                            <input
                              autoFocus
                              type="number"
                              value={tempHeaderValue}
                              onChange={(e) => setTempHeaderValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseFloat(tempHeaderValue);
                                  if (!isNaN(val) && val >= 0 && val <= 100) {
                                    setMaxPercent(val);
                                    setEditingMaxHeader(false);
                                    batchUpdateMinMax(minPercent, val);
                                  }
                                }
                                if (e.key === 'Escape') setEditingMaxHeader(false);
                              }}
                              onBlur={() => setEditingMaxHeader(false)}
                              className="w-12 px-1 py-0.5 bg-[#111111] border border-orange-500 rounded text-xs text-white text-center focus:ring-1 focus:ring-orange-500"
                            />
                            <span className="text-sky-400">%</span>
                          </div>
                        ) : (
                          <span className="hover:text-sky-400 transition-colors" title="Click to edit %">
                            Max ({maxPercent}%) ✎
                          </span>
                        )}
                      </th>
                      {/* 🆕 SELLER TAG COLUMN HEADER */}
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.1] last:border-r-0">Seller Tag</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.1] last:border-r-0">Source</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.1] last:border-r-0">Remark</th>
                      {/* 🆕 ACTIONS on ALL tabs: Restock, Dropshipping, Pending get full actions; Listed gets Error+Remove; Error & Removed get nothing extra */}
                      {['high_demand', 'dropshipping', 'pending'].includes(activeTab) && (
                        <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.1] last:border-r-0">Actions</th>
                      )}
                      {activeTab === 'done' && (
                        <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.1] last:border-r-0">Actions</th>
                      )}
                      {activeTab === 'error' && (
                        <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.1] last:border-r-0">Reason</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    <AnimatePresence>
                      {products.map((product, index) => (
                        <motion.tr
                          key={product.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.2 }}
                          className={`group transition-colors ${(() => {
                            const currentSellerTag = SELLER_TAG_MAP[SELLER_ID];
                            const otherTags = (product.seller_tag?.split(',').map(t => t.trim().toUpperCase()).filter(Boolean) || [])
                              .filter(t => t !== currentSellerTag);
                            const allOthersListed = otherTags.length > 0 && otherTags.every(tag =>
                              (listedByOthers[product.asin] || []).some(s => s.tag === tag)
                            );
                            return allOthersListed ? 'bg-emerald-500/10 hover:bg-emerald-900/30' : 'hover:bg-white/[0.05]';
                          })()
                            }`}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-300 font-mono tracking-tight border-r border-white/[0.1] last:border-r-0">{product.asin}</td>
                          <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                            <div className="text-sm text-gray-100 truncate max-w-sm" title={product.product_name || ''}>{product.product_name}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 font-mono border-r border-white/[0.1] last:border-r-0">{product.sku}</td>
                          <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                            <span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-sm font-semibold font-mono">
                              {product.selling_price ? `₹${product.selling_price}` : '-'}
                            </span>
                          </td>

                          {/* MIN PRICE CELL */}
                          <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                            <span className="inline-flex px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/20 text-sm font-semibold font-mono">
                              {product.selling_price ? `₹${calcMin(product.selling_price)}` : '-'}
                            </span>
                          </td>

                          {/* MAX PRICE CELL */}
                          <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                            <span className="inline-flex px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-400 border border-sky-500/20 text-sm font-semibold font-mono">
                              {product.selling_price ? `₹${calcMax(product.selling_price)}` : '-'}
                            </span>
                          </td>

                          {/* SELLER TAG COLUMN CELL */}
                          <td className="px-6 py-4 text-center border-r border-white/[0.1] last:border-r-0">
                            {product.seller_tag ? (
                              <div className="grid grid-cols-2 gap-2.5 justify-items-center w-fit mx-auto">
                                {product.seller_tag.split(',').map((tag: string) => {
                                  const cleanTag = tag.trim().toUpperCase();
                                  const crossInfo = (listedByOthers[product.asin] || []).find(s => s.tag === cleanTag);
                                  const isListedByOther = !!crossInfo;
                                  const tooltipText = isListedByOther
                                    ? `✓ Listed by ${crossInfo.sellerName}${crossInfo.listedAt ? ` on ${new Date(crossInfo.listedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}`
                                    : cleanTag;
                                  return (
                                    <span key={cleanTag} title={tooltipText} className={`relative w-7 h-7 flex items-center justify-center rounded-full text-[9px] font-bold cursor-default ${SELLER_TAG_COLORS[cleanTag] || 'bg-[#1a1a1a] text-white'} ${isListedByOther ? 'ring-2 ring-emerald-400' : ''}`}>
                                      {cleanTag}
                                      {isListedByOther && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                                          <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-center border-r border-white/[0.1] last:border-r-0">
                            {product.seller_link ? (
                              <a href={ensureAbsoluteUrl(product.seller_link || '')} target="_blank" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#111111] text-gray-400 hover:bg-white/[0.05]/100 hover:text-white transition-all duration-200">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : <span className="text-gray-300">-</span>}
                          </td>

                          <td className="px-6 py-4 text-center border-r border-white/[0.1] last:border-r-0">
                            {product.remark ? (
                              <button
                                onClick={() => { setSelectedRemark(product.remark || ' '); setEditingRemarkText(product.remark || ''); setEditingRemarkProductId(product.id); }}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                              >
                                View
                              </button>
                            ) : (
                              <button onClick={() => { setSelectedRemark(' '); setEditingRemarkText(''); setEditingRemarkProductId(product.id); }} className="text-gray-300 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>
                            )}
                          </td>

                          {/* Original actions for Restock, Dropshipping, Pending */}
                          {['high_demand', 'dropshipping', 'pending'].includes(activeTab) && (
                            <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                              <div className="flex items-center justify-center gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleMoveProduct(product, 'done')}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] transition-all"
                                  title="Mark as Listed"
                                >
                                  <Check className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => { setSelectedForError(product); setIsReasonModalOpen(true); }}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-rose-500/20 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)] transition-all"
                                  title="Mark as Error"
                                >
                                  <X className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleMoveProduct(product, 'removed')}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-[#111111] text-gray-500 border border-white/[0.1] hover:bg-[#1a1a1a] hover:text-white transition-all"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          )}

                          {/* 🆕 ACTIONS FOR LISTED TAB - Move to Error or Removed */}
                          {activeTab === 'done' && (
                            <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                              <div className="flex items-center justify-center gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => { setSelectedForError(product); setIsReasonModalOpen(true); }}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-rose-500/20 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)] transition-all"
                                  title="Move to Error"
                                >
                                  <X className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleMoveProduct(product, 'removed')}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-[#111111] text-gray-500 border border-white/[0.1] hover:bg-[#1a1a1a] hover:text-white transition-all"
                                  title="Move to Removed"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          )}

                          {activeTab === 'error' && (
                            <td className="px-6 py-4 border-r border-white/[0.1] last:border-r-0">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-medium">
                                <AlertOctagon className="w-3 h-3" />
                                {product.error_reason}
                              </span>
                            </td>
                          )}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>

            {/* PAGINATION FOOTER */}
            <div className="flex-none border-t border-white/[0.1] bg-[#1a1a1a] p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs sm:text-sm text-gray-300">
                Showing <span className="font-medium text-white">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-white">{Math.min(page * ITEMS_PER_PAGE, totalItems)}</span> of <span className="font-medium text-white">{totalItems}</span>
              </span>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] border border-white/[0.1] text-sm font-medium text-gray-300 hover:text-white hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <span className="text-sm font-mono text-gray-300 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.1]">
                  Page <span className="text-white">{page}</span> / {totalPages || 1}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] border border-white/[0.1] text-sm font-medium text-gray-300 hover:text-white hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ERROR REASON MODAL */}
          {isReasonModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]">
              <div className="bg-[#111111] border border-white/[0.1] p-4 sm:p-6 rounded-2xl w-full max-w-md mx-3 sm:mx-0 shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Report Error</h3>
                <p className="text-gray-400 mb-4 text-sm">Why are you rejecting <b>{selectedForError?.asin}</b>?</p>
                <input
                  autoFocus
                  type="text"
                  placeholder="E.g., Price mismatch, Out of stock..."
                  value={errorReasonInput}
                  onChange={(e) => setErrorReasonInput(e.target.value)}
                  className="w-full p-3 bg-[#111111] border border-white/[0.1] rounded-lg text-white focus:border-rose-500 outline-none mb-6"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsReasonModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                  <button
                    onClick={() => selectedForError && handleMoveProduct(selectedForError, 'error', errorReasonInput)}
                    disabled={!errorReasonInput.trim()}
                    className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    Confirm Error
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* REMARK MODAL */}
          <AnimatePresence>
            {selectedRemark && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                  className="fixed inset-0 z-50 bg-[#111111]/60"
                />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full mx-3 sm:mx-4 border border-white/[0.1] overflow-hidden pointer-events-auto"
                  >
                    <div className="flex items-center justify-between px-6 py-4 bg-[#111111] border-b border-white/[0.1]">
                      <h2 className="text-xl font-bold text-white">Remark Details</h2>
                      <button onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }} className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-[#1a1a1a]/50 rounded-xl p-5 border border-white/[0.1]">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.1]">
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Validation Remark</span>
                    </div>
                    <textarea
                      value={editingRemarkText}
                      onChange={(e) => setEditingRemarkText(e.target.value)}
                      className="w-full bg-transparent text-gray-100 text-sm leading-relaxed resize-none focus:outline-none min-h-[100px] placeholder:text-gray-500"
                      placeholder="Enter remark..."
                      rows={4}
                    />
                    <div className="mt-4 pt-3 border-t border-white/[0.1] flex items-center justify-between text-xs text-gray-300">
                      <span>{editingRemarkText.length} characters</span>
                      <span>{editingRemarkText.split('\n').length} lines</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#1a1a1a]/50 border-t border-white/[0.1] flex items-center justify-between">
                  <div className="text-xs text-gray-300">
                    Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded text-gray-500">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(editingRemarkText)}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-slate-600 text-gray-100 rounded-lg font-medium transition-colors text-sm"
                    >
                      Copy
                    </button>
                    {editingRemarkText.trim() !== (selectedRemark || '').trim() && editingRemarkProductId && (
                      <button
                        onClick={async () => {
                          if (!editingRemarkProductId) return;
                          await handleRemarkSave(editingRemarkProductId, editingRemarkText.trim() || null);
                          setSelectedRemark(null);
                          setEditingRemarkText('');
                          setEditingRemarkProductId(null);
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-emerald-900/20"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
          {toast && (
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          )}
        </div>
      </div>
    </>
  )
}