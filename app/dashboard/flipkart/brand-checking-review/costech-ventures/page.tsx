'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect, useMemo, useCallback } from 'react';
import PageTransition from '@/components/layout/PageTransition';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import { Search, ExternalLink, ArrowLeft, Check, X } from 'lucide-react';

interface ProductRow {
  id: string;
  asin: string;
  product_name: string | null;
  brand: string | null;
  funnel: string | null;
  monthly_unit: number | null;
  link: string | null;
  amz_link: string | null;
  remark: string | null;
  category: string | null;
  category_root: string | null;
  category_sub: string | null;
  category_child: string | null;
  category_tree: string | null;
  approval_status: string | null;
  listing_status: string | null;
  price: number | null;
  monthly_sales: number | null;
  bsr: number | null;
  seller: string | null;
  dimensions: string | null;
  weight: number | null;
  weight_unit: string | null;
  sku: string | null;
  source_id: string | null;
  tag: string | null;
}

type TabKey = 'main' | 'listed' | 'not_listed';

const SELLER_ID = 6;
const MARKETPLACE = 'flipkart';
const SELLER_CODE_MAP: Record<number, string> = { 1: 'GR', 2: 'RR', 3: 'UB', 4: 'VV', 5: 'DE', 6: 'CV' };
const SELLER_CODE = SELLER_CODE_MAP[SELLER_ID];

const LISTING_STATUS_FOR_TAB: Record<TabKey, string> = {
  main: 'pending',
  listed: 'listed',
  not_listed: 'not_listed',
};

const getFunnelBadgeStyle = (funnel: string) => {
  const f = (funnel || '').toUpperCase();
  if (f === 'HD' || f === 'RS') return { display: f, color: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white' };
  if (f === 'DP') return { display: 'DP', color: 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' };
  if (f === 'LD') return { display: 'LD', color: 'bg-gradient-to-br from-slate-500 to-slate-700 text-white' };
  return { display: '-', color: '' };
};

const formatUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
};

export default function CostechVenturesReviewPage() {
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('main');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mainCount, setMainCount] = useState(0);
  const [listedCount, setListedCount] = useState(0);
  const [notListedCount, setNotListedCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_checking')
        .select('*')
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'approved')
        .eq('listing_status', LISTING_STATUS_FOR_TAB[activeTab])
        .order('brand', { ascending: true });

      if (error) {
        console.error(error);
        setToast({ message: 'Failed to load products', type: 'error' });
        setProducts([]);
      } else {
        setProducts(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchCounts = useCallback(async () => {
    const [mainRes, listedRes, notListedRes] = await Promise.all([
      supabase
        .from('brand_checking')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'approved')
        .eq('listing_status', 'pending'),
      supabase
        .from('brand_checking')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'approved')
        .eq('listing_status', 'listed'),
      supabase
        .from('brand_checking')
        .select('*', { count: 'exact', head: true })
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'approved')
        .eq('listing_status', 'not_listed'),
    ]);
    setMainCount(mainRes.count || 0);
    setListedCount(listedRes.count || 0);
    setNotListedCount(notListedRes.count || 0);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchProducts();
      fetchCounts();
    }
  }, [authLoading, user, fetchProducts, fetchCounts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.asin || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q),
    );
  }, [products, searchQuery]);

  const removeProductLocal = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleListAction = async (product: ProductRow, action: 'listed' | 'not_listed') => {
    setProcessingIds((prev) => new Set(prev).add(product.id));
    try {
      const { error: updateError } = await supabase
        .from('brand_checking')
        .update({ listing_status: action })
        .eq('id', product.id);
      if (updateError) {
        setToast({ message: 'Failed to update', type: 'error' });
        return;
      }

      const { data: existing, error: selectError } = await supabase
        .from('flipkart_validation_main_file')
        .select('id, seller_tag')
        .eq('asin', product.asin)
        .maybeSingle();

      if (selectError) console.warn('Validation select warning:', selectError);

      if (!existing) {
        const { error: insertError } = await supabase.from('flipkart_validation_main_file').insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          seller_tag: SELLER_CODE,
          funnel: product.funnel,
          no_of_seller: 1,
          flipkart_link: product.link,
          amz_link: product.amz_link,
          remark: product.remark,
          listing_status: action,
        });
        if (insertError) {
          setToast({ message: 'Failed to insert to validation', type: 'error' });
          return;
        }
      } else {
        const tags = existing.seller_tag?.split(',').map((t: string) => t.trim()).filter(Boolean) ?? [];
        if (!tags.includes(SELLER_CODE)) {
          const newTags = [...tags, SELLER_CODE];
          const { error: mergeError } = await supabase
            .from('flipkart_validation_main_file')
            .update({
              seller_tag: newTags.join(','),
              no_of_seller: newTags.length,
              listing_status: action,
            })
            .eq('id', existing.id);
          if (mergeError) {
            setToast({ message: 'Failed to merge tag in validation', type: 'error' });
            return;
          }
        } else {
          await supabase
            .from('flipkart_validation_main_file')
            .update({ listing_status: action })
            .eq('id', existing.id);
        }
      }

      removeProductLocal(product.id);
      setMainCount((c) => Math.max(0, c - 1));
      if (action === 'listed') setListedCount((c) => c + 1);
      else setNotListedCount((c) => c + 1);
      setToast({
        message: `${product.asin} marked as ${action === 'listed' ? 'Listed' : 'Not Listed'}`,
        type: 'success',
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  const handleRollbackToMain = async (product: ProductRow) => {
    setProcessingIds((prev) => new Set(prev).add(product.id));
    try {
      const previousStatus = product.listing_status;
      const { error } = await supabase
        .from('brand_checking')
        .update({ listing_status: 'pending' })
        .eq('id', product.id);
      if (error) {
        setToast({ message: 'Failed to rollback', type: 'error' });
        return;
      }

      const { data: valRow, error: selectError } = await supabase
        .from('flipkart_validation_main_file')
        .select('id, seller_tag')
        .eq('asin', product.asin)
        .maybeSingle();

      if (selectError) console.warn('Validation select warning:', selectError);

      if (valRow) {
        const tags =
          valRow.seller_tag
            ?.split(',')
            .map((t: string) => t.trim())
            .filter((t: string) => t && t !== SELLER_CODE) ?? [];
        if (tags.length === 0) {
          await supabase.from('flipkart_validation_main_file').delete().eq('id', valRow.id);
        } else {
          await supabase
            .from('flipkart_validation_main_file')
            .update({ seller_tag: tags.join(','), no_of_seller: tags.length })
            .eq('id', valRow.id);
        }
      }

      removeProductLocal(product.id);
      setMainCount((c) => c + 1);
      if (previousStatus === 'listed') setListedCount((c) => Math.max(0, c - 1));
      else if (previousStatus === 'not_listed') setNotListedCount((c) => Math.max(0, c - 1));
      setToast({ message: `${product.asin} moved back to Main`, type: 'success' });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }
  };

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0f]" />;
  if (!user) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-white/10 px-6 py-5">
          <div className="max-w-[1920px] mx-auto space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Flipkart Brand Checking Review — Costech Ventures ({SELLER_CODE})
              </h1>
              <p className="text-sm text-gray-400 mt-1">Mark approved products as Listed or Not Listed</p>
            </div>

            {/* TABS */}
            <div className="flex gap-1 border-b border-white/10">
              <TabButton
                active={activeTab === 'main'}
                onClick={() => setActiveTab('main')}
                label={`MAIN (${mainCount})`}
              />
              <TabButton
                active={activeTab === 'listed'}
                onClick={() => setActiveTab('listed')}
                label={`LISTED (${listedCount})`}
              />
              <TabButton
                active={activeTab === 'not_listed'}
                onClick={() => setActiveTab('not_listed')}
                label={`NOT LISTED (${notListedCount})`}
              />
            </div>

            {/* SEARCH */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by ASIN or product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>
              <span className="text-xs font-mono text-gray-500">
                Showing {filteredProducts.length} of {products.length}
              </span>
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="max-w-[1920px] mx-auto px-6 py-5">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            {loading ? (
              <div className="h-96 flex items-center justify-center text-gray-400">
                <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-2">
                <p className="text-base font-medium">No products in {activeTab.replace('_', ' ')}</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-260px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-white/10">
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 w-32">ASIN</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3 w-32">Brand</th>
                      <th className="px-4 py-3 w-32">Root Cat</th>
                      <th className="px-4 py-3 w-32">Child Cat</th>
                      <th className="px-4 py-3 w-20 text-center">Funnel</th>
                      <th className="px-4 py-3 w-20 text-right">Monthly</th>
                      <th className="px-4 py-3 w-24 text-right">BSR</th>
                      <th className="px-4 py-3 w-16 text-center">Link</th>
                      <th className="px-4 py-3 w-20 text-center">Remark</th>
                      <th className="px-4 py-3 w-56 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => {
                      const badge = getFunnelBadgeStyle(p.funnel || '');
                      const isProcessing = processingIds.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-blue-400">{p.asin}</td>
                          <td className="px-4 py-3">
                            <span className="text-gray-200 line-clamp-2" title={p.product_name || ''}>
                              {p.product_name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-xs truncate" title={p.brand || ''}>
                            {p.brand || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs truncate" title={p.category_root || ''}>
                            {p.category_root || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs truncate" title={p.category_child || ''}>
                            {p.category_child || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {badge.display !== '-' ? (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.color}`}>
                                {badge.display}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                            {p.monthly_unit ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                            {p.bsr ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.link ? (
                              <a
                                href={formatUrl(p.link) || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center p-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20 transition-colors"
                                title="Open product link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.remark ? (
                              <button
                                onClick={() => setSelectedRemark(p.remark || '')}
                                className="px-2 py-0.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white border border-orange-500/20 rounded text-xs font-medium transition-colors"
                              >
                                View
                              </button>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {activeTab === 'main' ? (
                              <div className="flex justify-center gap-1.5">
                                <button
                                  onClick={() => handleListAction(p, 'listed')}
                                  disabled={isProcessing}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> List
                                </button>
                                <button
                                  onClick={() => handleListAction(p, 'not_listed')}
                                  disabled={isProcessing}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors inline-flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Not List
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRollbackToMain(p)}
                                disabled={isProcessing}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors inline-flex items-center gap-1"
                              >
                                <ArrowLeft className="w-3 h-3" /> Move to Main
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {selectedRemark !== null && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedRemark(null)}
          >
            <div
              className="bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Remark</h3>
                <button
                  onClick={() => setSelectedRemark(null)}
                  className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="whitespace-pre-wrap text-gray-200 bg-[#0a0a0f] p-4 rounded-lg border border-white/10 max-h-96 overflow-y-auto text-sm">
                {selectedRemark || '(empty)'}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
        active
          ? 'text-white border-blue-500'
          : 'text-gray-400 border-transparent hover:text-white hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}
