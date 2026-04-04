'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import PageTransition from '@/components/layout/PageTransition';
import { useAuth } from '@/lib/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
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

// ✅ ADD THIS - Safe UUID generator (works in all browsers)
const generateUUID = (): string => {
  if (typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/* === CONFIGURATION === */
const SELLER_ID = 1;
const SELLER_NAME = "Golden Aura";
const BASE_TABLE_PREFIX = `uk_listing_error_seller_${SELLER_ID}`;
const ITEMS_PER_PAGE = 100; // Matches your screenshot

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
}

type TabType = 'high_demand' | 'low_demand' | 'dropshipping' | 'done' | 'pending' | 'error' | 'removed';

const TABS = [
  { id: 'high_demand', label: 'High Demand', color: 'text-emerald-400', glow: 'shadow-[0_0_20px_-5px_rgba(52,211,153,0.5)]' },
  { id: 'low_demand', label: 'Low Demand', color: 'text-blue-400', glow: 'shadow-[0_0_20px_-5px_rgba(96,165,250,0.5)]' },
  { id: 'dropshipping', label: 'Dropshipping', color: 'text-amber-400', glow: 'shadow-[0_0_20px_-5px_rgba(251,191,36,0.5)]' },
  { id: 'done', label: 'Listed', color: 'text-gray-100', glow: '' },
  { id: 'pending', label: 'Pending', color: 'text-orange-500', glow: '' },
  { id: 'error', label: 'Errors', color: 'text-rose-400', glow: '' },
  { id: 'removed', label: 'Removed', color: 'text-gray-500', glow: '' },
];

export default function GoldenAuraListingPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('high_demand');
  const [products, setProducts] = useState<ListingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Pagination State
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

  // Reset page when tab changes
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
      setPage(1); // Reset to page 1 on new search
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

  // ✅ UPDATED FETCH LOGIC WITH PAGINATION
  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const tableName = `${BASE_TABLE_PREFIX}_${activeTab}`;
      let query = supabase.from(tableName).select('*', { count: 'exact' });

      // Apply Search
      if (debouncedSearch.trim()) {
        const term = debouncedSearch.trim();
        query = query.or(`asin.ilike.%${term}%,product_name.ilike.%${term}%,sku.ilike.%${term}%`);
      }

      // Calculate Range for Pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, count, error } = await query
        .order('id', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setProducts(data || []);
      setTotalItems(count || 0);

    } catch (err: any) {
      console.error('Fetch error:', err);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, user, page]); // Added 'page' dependency

  // Fetch on change
  useEffect(() => {
    fetchProducts();

    const tableName = `${BASE_TABLE_PREFIX}_${activeTab}`;
    const channelName = `realtime_${tableName}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

    // ✅ SELF-HEALING: If no journey_id exists (old data), start a fresh chain now.
    // This ensures the item will work correctly when it reaches the Reorder page.
    const journeyId = product.journey_id || generateUUID();
    const journeyNum = product.journey_number || 1;

    try {
      const sourceTableName = `${BASE_TABLE_PREFIX}_${activeTab}`;
      const targetTableName = `${BASE_TABLE_PREFIX}_${target}`;

      // 1. Prepare Payload (With Journey Data)
      const payload = {
        source_admin_validation_id: product.source_admin_validation_id,
        asin: product.asin,
        product_name: product.product_name,
        sku: product.sku,
        selling_price: product.selling_price,
        seller_link: product.seller_link,

        // 🔗 THE CRITICAL LINK
        journey_id: journeyId,
        journey_number: journeyNum,
        remark: product.remark ?? null,

        ...(target === 'done' ? { final_listed_price: product.selling_price } : {}),
        ...(target === 'error' ? { error_reason: reason || 'Unknown Error' } : {})
      };

      // 2. 📸 HISTORY SNAPSHOT (Only if Listed)
      if (target === 'done') {
        const { error: historyError } = await supabase.from('uk_asin_history').insert({
          asin: product.asin,
          journey_id: journeyId,
          journey_number: journeyNum,
          stage: 'listing_done',
          status: 'listed',
          profit: null, // We don't verify profit at this stage, just listing
          snapshot_data: {
            final_price: product.selling_price,
            sku: product.sku,
            listed_at: new Date().toISOString()
          }
        });

        if (historyError) {
          console.error("⚠️ History snapshot failed:", historyError);
          // We continue anyway, don't block the user
        }
      }

      // 3. Move Data (Upsert to Target)
      const { error: insertError } = await supabase.from(targetTableName).upsert(payload, { onConflict: 'asin' });
      if (insertError) throw insertError;

      // 4. Log Movement
      await logHistory(product, sourceTableName, targetTableName);

      // 5. Clean Up Source (Delete from potential source tables)
      const sourceTablesToCheck = [
        `${BASE_TABLE_PREFIX}_pending`,
        `${BASE_TABLE_PREFIX}_high_demand`,
        `${BASE_TABLE_PREFIX}_low_demand`,
        `${BASE_TABLE_PREFIX}_dropshipping`
      ];

      await Promise.all(sourceTablesToCheck.map(table => supabase.from(table).delete().eq('asin', product.asin)));

      // 6. Update Stats
      if (target === 'done') await updateProgressStats('listed', 1);
      else if (target === 'error') await updateProgressStats('error', 1);
      else if (target === 'removed') {
        const { data: stats } = await supabase.from('listing_error_progress').select('total_pending').eq('seller_id', SELLER_ID).single();
        if (stats) await supabase.from('listing_error_progress').update({ total_pending: Math.max(0, stats.total_pending - 1) }).eq('seller_id', SELLER_ID);
      }

      // 7. UI Update
      setProducts(prev => prev.filter(p => p.id !== product.id));
      setToast({ message: `Moved to ${target === 'done' ? 'Listed' : target}`, type: 'success' });

      // Handle empty page
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
    <PageTransition>
      <div className="h-screen bg-[#111111] text-gray-100 font-sans selection:bg-orange-400/30 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col w-full mx-auto p-3 overflow-hidden">
          {/* === HEADER & CONTROLS === */}
          <div className="flex-none space-y-4 pb-4">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.06]">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/100/10 rounded-lg border border-orange-500/20">
                    <LayoutList className="w-6 h-6 text-orange-500" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white">{SELLER_NAME}</h1>
                </div>
                <p className="text-gray-400 pl-[3.25rem]">Listing & Error Resolution Dashboard</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-[#111111] rounded-lg border border-white/[0.06] text-xs font-mono text-gray-300">
                  TOTAL ITEMS: <span className="text-white font-bold text-base ml-2">{totalItems}</span>
                </div>
              </div>
            </header>

            <div className="space-y-6">
              <div className="flex flex-wrap gap-2 p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.06] shadow-lg shadow-black/20 w-fit">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as TabType); setSearchQuery(''); }}
                    className={`relative px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 z-10 ${activeTab === tab.id ? 'text-white font-semibold' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'}`}
                  >
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-orange-500/100 rounded-xl shadow-sm -z-10"
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

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#1a1a1a] p-4 rounded-2xl border border-white/[0.06]">
                <div className="relative w-full sm:w-96 group">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by ASIN, Name, or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-[#111111] border border-white/[0.06] rounded-xl focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all outline-none text-sm placeholder:text-gray-500 text-gray-100"
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
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${hasRollback ? 'bg-orange-500/100 text-white shadow-lg shadow-orange-500/10 hover:bg-orange-400' : 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.06]'}`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Undo Action
                </motion.button>
              </div>
            </div>
          </div>

          {/* === TABLE CONTAINER === */}
          <div className="flex-1 min-h-0 bg-[#1a1a1a] rounded-2xl border border-white/[0.06] flex flex-col relative overflow-hidden">

            {/* Scrollable Table Area */}
            <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">

              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
                  <span className="text-sm font-medium tracking-wide">SYNCING DATA...</span>
                </div>
              ) : products.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                  <div className="p-4 bg-[#111111] rounded-full border border-white/[0.06]">
                    <AlertOctagon className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-sm">No items found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1a1a1a] border-b border-white/[0.06] sticky top-0 z-20 shadow-md">
                    <tr>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.06] last:border-r-0">ASIN</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider w-1/3 border-r border-white/[0.06] last:border-r-0">Product Details</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.06] last:border-r-0">SKU</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.06] last:border-r-0">Price</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.06] last:border-r-0">Source</th>
                      <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.06] last:border-r-0">Remark</th>
                      {['high_demand', 'low_demand', 'dropshipping', 'pending'].includes(activeTab) && (
                        <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider text-center border-r border-white/[0.06] last:border-r-0">Actions</th>
                      )}
                      {activeTab === 'error' && (
                        <th className="px-6 py-5 text-xs font-bold text-white uppercase tracking-wider border-r border-white/[0.06] last:border-r-0">Reason</th>
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
                          className="group hover:bg-white/[0.05]0/100/5 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-300 font-mono tracking-tight border-r border-white/[0.06] last:border-r-0">{product.asin}</td>
                          <td className="px-6 py-4 border-r border-white/[0.06] last:border-r-0">
                            <div className="text-sm text-gray-100 truncate max-w-sm" title={product.product_name || ''}>{product.product_name}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300 font-mono border-r border-white/[0.06] last:border-r-0">{product.sku}</td>
                          <td className="px-6 py-4 border-r border-white/[0.06] last:border-r-0">
                            <span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-500/100/20 text-emerald-400 border border-emerald-500/20 text-sm font-semibold font-mono">
                              {product.selling_price ? `₹${product.selling_price}` : '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center border-r border-white/[0.06] last:border-r-0">
                            {product.seller_link ? (
                              <a href={ensureAbsoluteUrl(product.seller_link || '')} target="_blank" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#111111] text-gray-400 hover:bg-white/[0.05]0/100 hover:text-white transition-all duration-200">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : <span className="text-gray-500">-</span>}
                          </td>
                          {/* ✅ ADD THIS NEW REMARK COLUMN */}
                          <td className="px-6 py-4 text-center border-r border-white/[0.06] last:border-r-0">
                            {product.remark ? (
                              <button
                                onClick={() => setSelectedRemark(product.remark)}
                                className="bg-orange-500/100 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>

                          {['high_demand', 'low_demand', 'dropshipping', 'pending'].includes(activeTab) && (
                            <td className="px-6 py-4 border-r border-white/[0.06] last:border-r-0">
                              <div className="flex items-center justify-center gap-3">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleMoveProduct(product, 'done')}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-emerald-500/100/20 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/100 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] transition-all"
                                  title="Mark as Listed"
                                >
                                  <Check className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => { setSelectedForError(product); setIsReasonModalOpen(true); }}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-rose-500/100/20 text-rose-500 border border-rose-500/20 hover:bg-rose-500/100 hover:text-white hover:shadow-[0_0_15px_-3px_rgba(244,63,94,0.4)] transition-all"
                                  title="Mark as Error"
                                >
                                  <X className="w-4 h-4" />
                                </motion.button>

                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleMoveProduct(product, 'removed')}
                                  disabled={processingId === product.id}
                                  className="p-2 rounded-lg bg-[#111111] text-gray-500 border border-white/[0.06] hover:bg-[#1a1a1a] hover:text-white transition-all"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </div>
                            </td>
                          )}

                          {activeTab === 'error' && (
                            <td className="px-6 py-4 border-r border-white/[0.06] last:border-r-0">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/100/20 border border-rose-500/20 text-rose-400 text-xs font-medium">
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

            {/* ✅ PAGINATION FOOTER */}
            <div className="flex-none border-t border-white/[0.06] bg-[#1a1a1a] p-4 flex items-center justify-between">
              <span className="text-sm text-gray-300">
                Showing <span className="font-medium text-white">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-white">{Math.min(page * ITEMS_PER_PAGE, totalItems)}</span> of <span className="font-medium text-white">{totalItems}</span> products
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] border border-white/[0.06] text-sm font-medium text-gray-500 hover:text-white hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <span className="text-sm font-mono text-gray-300 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                  Page <span className="text-white">{page}</span> / {totalPages || 1}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111111] border border-white/[0.06] text-sm font-medium text-gray-500 hover:text-white hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* CUSTOM ERROR REASON MODAL */}
          {isReasonModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]">
              <div className="bg-[#111111] border border-white/[0.06] p-6 rounded-2xl w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-4">Report Error</h3>
                <p className="text-gray-400 mb-4 text-sm">Why are you rejecting <b>{selectedForError?.asin}</b>?</p>
                <input
                  autoFocus
                  type="text"
                  placeholder="E.g., Price mismatch, Out of stock..."
                  value={errorReasonInput}
                  onChange={(e) => setErrorReasonInput(e.target.value)}
                  className="w-full p-3 bg-[#111111] border border-white/[0.06] rounded-lg text-white focus:border-rose-500 outline-none mb-6"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsReasonModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition">Cancel</button>
                  <button
                    onClick={() => selectedForError && handleMoveProduct(selectedForError, 'error', errorReasonInput)}
                    disabled={!errorReasonInput.trim()}
                    className="px-6 py-2 bg-rose-600 hover:bg-rose-500/100 text-white rounded-lg font-medium transition disabled:opacity-50"
                  >
                    Confirm Error
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {selectedRemark && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedRemark(null)}
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
                    className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/[0.06] overflow-hidden pointer-events-auto"
                  >
                    <div className="flex items-center justify-between px-6 py-4 bg-[#111111] border-b border-white/[0.06]">
                      <h2 className="text-xl font-bold text-white">Remark Details</h2>
                      <button onClick={() => setSelectedRemark(null)} className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                      <div className="bg-[#111111] rounded-lg p-4 border border-white/[0.06]">
                        <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{selectedRemark}</p>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-[#111111] border-t border-white/[0.06] flex justify-end">
                      <button onClick={() => setSelectedRemark(null)} className="px-4 py-2 bg-orange-500/100 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
                        Close
                      </button>
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
    </PageTransition>
  );
}