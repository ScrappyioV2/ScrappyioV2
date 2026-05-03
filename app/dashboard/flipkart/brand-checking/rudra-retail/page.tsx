'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useState, useEffect, useMemo, useCallback } from 'react';
import PageTransition from '@/components/layout/PageTransition';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import { Search, ChevronDown, ChevronRight, Check, X, Filter, RotateCcw } from 'lucide-react';

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

type TabKey = 'pending' | 'not_approved';

const SELLER_ID = 2;
const MARKETPLACE = 'flipkart';
const SELLER_CODE = 'RR';

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

export default function RudraRetailPage() {
  const { user, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notApprovedCount, setNotApprovedCount] = useState(0);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, categoryFilter]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('brand_checking')
        .select('*')
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', activeTab)
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
    const [pendingRes, notApprovedRes] = await Promise.all([
      supabase
        .from('brand_checking')
        .select('id', { count: 'exact', head: true })
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'pending'),
      supabase
        .from('brand_checking')
        .select('id', { count: 'exact', head: true })
        .eq('marketplace', MARKETPLACE)
        .eq('seller_id', SELLER_ID)
        .eq('approval_status', 'not_approved'),
    ]);
    setPendingCount(pendingRes.count || 0);
    setNotApprovedCount(notApprovedRes.count || 0);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchProducts();
      fetchCounts();
    }
  }, [authLoading, user, fetchProducts, fetchCounts]);

  useEffect(() => {
    setExpandedBrands(new Set());
    setSelectedIds(new Set());
  }, [activeTab]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category_root) set.add(p.category_root);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category_root !== categoryFilter) return false;
      if (!q) return true;
      return (
        (p.asin || '').toLowerCase().includes(q) ||
        (p.product_name || '').toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, categoryFilter]);

  const groupedByBrand = useMemo(() => {
    const map = new Map<string, ProductRow[]>();
    filteredProducts.forEach((p) => {
      const key = p.brand || '(No Brand)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    const groups = Array.from(map.entries()).map(([brand, items]) => {
      const rootCounts = new Map<string, number>();
      items.forEach((it) => {
        if (it.category_root) {
          rootCounts.set(it.category_root, (rootCounts.get(it.category_root) || 0) + 1);
        }
      });
      let topRoot = '';
      let topRootCount = 0;
      rootCounts.forEach((cnt, root) => {
        if (cnt > topRootCount) {
          topRootCount = cnt;
          topRoot = root;
        }
      });
      return { brand, items, count: items.length, topRoot };
    });
    groups.sort((a, b) => b.count - a.count);
    return groups;
  }, [filteredProducts]);

  const totalPages = Math.max(1, Math.ceil(groupedByBrand.length / ITEMS_PER_PAGE));
  const paginatedProducts = groupedByBrand.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleBrand = (brand: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const handleCategoryEdit = async (id: string, field: string, value: string) => {
    const { error } = await supabase.from('brand_checking').update({ [field]: value }).eq('id', id);
    if (error) {
      setToast({ message: 'Failed to update category', type: 'error' });
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const removeProductLocal = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleApprove = async (product: ProductRow) => {
    setProcessingIds((prev) => new Set(prev).add(product.id));
    const { error } = await supabase
      .from('brand_checking')
      .update({ approval_status: 'approved', listing_status: 'pending' })
      .eq('id', product.id);
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    if (error) {
      setToast({ message: 'Failed to approve', type: 'error' });
      return;
    }
    removeProductLocal(product.id);
    setPendingCount((c) => Math.max(0, c - 1));
    setToast({ message: `${product.asin} approved`, type: 'success' });
  };

  const handleNotApprove = async (product: ProductRow) => {
    setProcessingIds((prev) => new Set(prev).add(product.id));
    const { error } = await supabase
      .from('brand_checking')
      .update({ approval_status: 'not_approved' })
      .eq('id', product.id);
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    if (error) {
      setToast({ message: 'Failed', type: 'error' });
      return;
    }
    removeProductLocal(product.id);
    setPendingCount((c) => Math.max(0, c - 1));
    setNotApprovedCount((c) => c + 1);
    setToast({ message: `${product.asin} moved to Not Approved`, type: 'success' });
  };

  const handleRestoreToPending = async (product: ProductRow) => {
    setProcessingIds((prev) => new Set(prev).add(product.id));
    const { error } = await supabase
      .from('brand_checking')
      .update({ approval_status: 'pending' })
      .eq('id', product.id);
    setProcessingIds((prev) => {
      const next = new Set(prev);
      next.delete(product.id);
      return next;
    });
    if (error) {
      setToast({ message: 'Failed', type: 'error' });
      return;
    }
    removeProductLocal(product.id);
    setNotApprovedCount((c) => Math.max(0, c - 1));
    setPendingCount((c) => c + 1);
    setToast({ message: `${product.asin} restored to Pending`, type: 'success' });
  };

  const handleApproveBrand = async (items: ProductRow[]) => {
    for (const p of items) {
      // eslint-disable-next-line no-await-in-loop
      await handleApprove(p);
    }
  };

  const handleNotApproveBrand = async (items: ProductRow[]) => {
    for (const p of items) {
      // eslint-disable-next-line no-await-in-loop
      await handleNotApprove(p);
    }
  };

  const handleApproveSelected = async () => {
    const targets = products.filter((p) => selectedIds.has(p.id));
    for (const p of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleApprove(p);
    }
  };

  const handleNotApproveSelected = async () => {
    const targets = products.filter((p) => selectedIds.has(p.id));
    for (const p of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleNotApprove(p);
    }
  };

  const handleRestoreSelected = async () => {
    const targets = products.filter((p) => selectedIds.has(p.id));
    for (const p of targets) {
      // eslint-disable-next-line no-await-in-loop
      await handleRestoreToPending(p);
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBrandSelect = (items: ProductRow[]) => {
    const allSelected = items.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) items.forEach((p) => next.delete(p.id));
      else items.forEach((p) => next.add(p.id));
      return next;
    });
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
                Flipkart Brand Checking — Rudra Retail ({SELLER_CODE})
              </h1>
              <p className="text-sm text-gray-400 mt-1">Brand-grouped approval view</p>
            </div>

            {/* TABS */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setActiveTab('not_approved')}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'not_approved'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                Not Approved ({notApprovedCount})
              </button>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[260px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by ASIN or product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pl-10 pr-8 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-orange-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {selectedIds.size > 0 && activeTab === 'pending' && (
                <>
                  <button
                    onClick={handleApproveSelected}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Approve Selected ({selectedIds.size})
                  </button>
                  <button
                    onClick={handleNotApproveSelected}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <X className="w-4 h-4" /> Not Approve Selected ({selectedIds.size})
                  </button>
                </>
              )}

              {selectedIds.size > 0 && activeTab === 'not_approved' && (
                <button
                  onClick={handleRestoreSelected}
                  className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Restore Selected ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="max-w-[1920px] mx-auto px-6 py-5">
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            {loading ? (
              <div className="h-96 flex items-center justify-center text-gray-400">
                <div className="w-8 h-8 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : groupedByBrand.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-2">
                <Filter className="w-12 h-12" />
                <p className="text-base font-medium">No products in {activeTab.replace('_', ' ')}</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-260px)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-[#0a0a0f] border-b border-white/10">
                    <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 w-12"></th>
                      <th className="px-4 py-3">Brand / Product</th>
                      <th className="px-4 py-3 w-40">Root Category</th>
                      <th className="px-4 py-3 w-40">Sub Category</th>
                      <th className="px-4 py-3 w-40">Child Category</th>
                      <th className="px-4 py-3 w-20 text-center">Funnel</th>
                      <th className="px-4 py-3 w-24 text-right">Monthly</th>
                      <th className="px-4 py-3 w-20 text-center">Links</th>
                      <th className="px-4 py-3 w-24 text-center">Remark</th>
                      <th className="px-4 py-3 w-56 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map(({ brand, items, count, topRoot }) => {
                      const isExpanded = expandedBrands.has(brand);
                      const allSelected = items.every((p) => selectedIds.has(p.id));
                      const someSelected = !allSelected && items.some((p) => selectedIds.has(p.id));
                      return (
                        <BrandRows
                          key={brand}
                          brand={brand}
                          items={items}
                          count={count}
                          topRoot={topRoot}
                          isExpanded={isExpanded}
                          allSelected={allSelected}
                          someSelected={someSelected}
                          activeTab={activeTab}
                          processingIds={processingIds}
                          selectedIds={selectedIds}
                          onToggle={() => toggleBrand(brand)}
                          onToggleBrandSelect={() => toggleBrandSelect(items)}
                          onToggleRowSelect={toggleRowSelect}
                          onApproveBrand={() => handleApproveBrand(items)}
                          onNotApproveBrand={() => handleNotApproveBrand(items)}
                          onApprove={handleApprove}
                          onNotApprove={handleNotApprove}
                          onRestore={handleRestoreToPending}
                          onCategoryEdit={handleCategoryEdit}
                          onShowRemark={(r) => setSelectedRemark(r)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stats Footer - FIXED AT BOTTOM */}
            <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 flex items-center justify-between text-sm text-gray-300">
              <div>
                Showing <span className="font-bold text-white">{groupedByBrand.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span>
                {' - '}
                <span className="font-bold text-white">{Math.min(currentPage * ITEMS_PER_PAGE, groupedByBrand.length)}</span>
                {' of '}
                <span className="font-bold text-white">{groupedByBrand.length}</span> products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium border border-white/[0.1]"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-400 px-2">
                  Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium border border-white/[0.1]"
                >
                  Next
                </button>
              </div>
            </div>
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

interface BrandRowsProps {
  brand: string;
  items: ProductRow[];
  count: number;
  topRoot: string;
  isExpanded: boolean;
  allSelected: boolean;
  someSelected: boolean;
  activeTab: TabKey;
  processingIds: Set<string>;
  selectedIds: Set<string>;
  onToggle: () => void;
  onToggleBrandSelect: () => void;
  onToggleRowSelect: (id: string) => void;
  onApproveBrand: () => void;
  onNotApproveBrand: () => void;
  onApprove: (p: ProductRow) => void;
  onNotApprove: (p: ProductRow) => void;
  onRestore: (p: ProductRow) => void;
  onCategoryEdit: (id: string, field: string, value: string) => void;
  onShowRemark: (r: string) => void;
}

function BrandRows({
  brand,
  items,
  count,
  topRoot,
  isExpanded,
  allSelected,
  someSelected,
  activeTab,
  processingIds,
  selectedIds,
  onToggle,
  onToggleBrandSelect,
  onToggleRowSelect,
  onApproveBrand,
  onNotApproveBrand,
  onApprove,
  onNotApprove,
  onRestore,
  onCategoryEdit,
  onShowRemark,
}: BrandRowsProps) {
  return (
    <>
      <tr className="border-b border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={onToggleBrandSelect}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/30 cursor-pointer"
          />
        </td>
        <td className="px-4 py-3 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <span className="font-semibold text-white">{brand}</span>
            <span className="text-xs text-gray-500 font-mono">({count} products)</span>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-400 text-xs">{topRoot || '-'}</td>
        <td className="px-4 py-3 text-gray-500 text-xs">—</td>
        <td className="px-4 py-3 text-gray-500 text-xs">—</td>
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3"></td>
        <td className="px-4 py-3 text-center">
          {activeTab === 'pending' ? (
            <div className="flex justify-center gap-1.5">
              <button
                onClick={onApproveBrand}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors"
                title="Approve all in brand"
              >
                ✓ All
              </button>
              <button
                onClick={onNotApproveBrand}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded transition-colors"
                title="Not approve all in brand"
              >
                ✗ All
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {isExpanded &&
        items.map((p) => {
          const badge = getFunnelBadgeStyle(p.funnel || '');
          const isProcessing = processingIds.has(p.id);
          return (
            <tr
              key={p.id}
              className={`border-b border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors ${
                selectedIds.has(p.id) ? 'bg-orange-500/5' : ''
              }`}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => onToggleRowSelect(p.id)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/30 cursor-pointer"
                />
              </td>
              <td className="px-4 py-3 pl-10">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-orange-400">{p.asin}</span>
                  <span className="text-gray-200 text-sm line-clamp-2" title={p.product_name || ''}>
                    {p.product_name || '-'}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <CategoryInput
                  initial={p.category_root || ''}
                  onSave={(v) => onCategoryEdit(p.id, 'category_root', v)}
                />
              </td>
              <td className="px-4 py-3">
                <CategoryInput
                  initial={p.category_sub || ''}
                  onSave={(v) => onCategoryEdit(p.id, 'category_sub', v)}
                />
              </td>
              <td className="px-4 py-3">
                <CategoryInput
                  initial={p.category_child || ''}
                  onSave={(v) => onCategoryEdit(p.id, 'category_child', v)}
                />
              </td>
              <td className="px-4 py-3 text-center">
                {badge.display !== '-' ? (
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${badge.color}`}
                  >
                    {badge.display}
                  </span>
                ) : (
                  <span className="text-gray-600 text-xs">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                {p.monthly_unit ?? '-'}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex justify-center gap-1">
                  {p.link && (
                    <a
                      href={formatUrl(p.link) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white text-[10px] font-medium border border-blue-500/20 transition-colors"
                      title="Product link"
                    >
                      P
                    </a>
                  )}
                  {p.amz_link && (
                    <a
                      href={formatUrl(p.amz_link) || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white text-[10px] font-medium border border-emerald-500/20 transition-colors"
                      title="Amazon link"
                    >
                      A
                    </a>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                {p.remark ? (
                  <button
                    onClick={() => onShowRemark(p.remark || '')}
                    className="px-2 py-0.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white border border-orange-500/20 rounded text-xs font-medium transition-colors"
                  >
                    View
                  </button>
                ) : (
                  <span className="text-gray-600 text-xs">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {activeTab === 'pending' ? (
                  <div className="flex justify-center gap-1.5">
                    <button
                      onClick={() => onApprove(p)}
                      disabled={isProcessing}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => onNotApprove(p)}
                      disabled={isProcessing}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Not
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onRestore(p)}
                    disabled={isProcessing}
                    className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold rounded transition-colors inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                )}
              </td>
            </tr>
          );
        })}
    </>
  );
}

interface CategoryInputProps {
  initial: string;
  onSave: (value: string) => void;
}

function CategoryInput({ initial, onSave }: CategoryInputProps) {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
      placeholder="-"
      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-200 placeholder:text-gray-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-all"
    />
  );
}
