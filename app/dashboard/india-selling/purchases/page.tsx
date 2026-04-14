'use client';

import { supabase } from '@/lib/supabaseClient';
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import { useState, useEffect, useRef, Fragment } from 'react';
import { History, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx';
import { useActivityLogger } from '@/lib/hooks/useActivityLogger';

type PassFileProduct = {
  id: string
  asin: string
  product_name: string | null  // ✅ Underscore
  brand: string | null
  seller_tag: string | null  // ✅ Underscore
  funnel: string | null
  origin_india: boolean | null  // ✅ Underscore
  origin_china: boolean | null  // ✅ Underscore
  origin_us: boolean | null;
  usd_price: number | null  // ✅ Underscore  
  inr_purchase: number | null  // ✅ Underscore
  india_link: string | null  // ✅ Underscore
  product_link: string | null  // ✅ Underscore
  target_price: number | null  // ✅ Underscore
  admin_target_price: number | null  // ✅ Underscore
  target_quantity: number | null  // ✅ Underscore
  funnel_quantity?: number | null  // ✅ Underscore
  funnel_seller?: string | null  // ✅ Underscore
  inr_purchase_link?: string | null  // ✅ Underscore
  buying_price: number | null  // ✅ Underscore
  buying_quantity: number | null  // ✅ Underscore
  buying_quantities?: Record<string, number> | null;
  seller_link: string | null  // ✅ Underscore
  seller_phone: string | null  // ✅ Underscore
  payment_method: string | null  // ✅ Underscore
  tracking_details: string | null  // ✅ Underscore
  delivery_date: string | null  // ✅ Underscore
  order_date: string | null
  status: string | null
  move_to: string | null  // ✅ Underscore
  sent_to_admin: boolean | null  // ✅ Underscore
  sent_to_admin_at: string | null  // ✅ Underscore
  admin_confirmed: boolean | null  // ✅ Underscore
  admin_confirmed_at: string | null  // ✅ Underscore
  check_brand: boolean | null  // ✅ Underscore
  check_item_expire: boolean | null  // ✅ Underscore
  check_small_size: boolean | null  // ✅ Underscore
  check_multi_seller: boolean | null  // ✅ Underscore
  created_at: string | null  // ✅ Underscore
  validation_funnel_seller?: string | null  // ✅ Underscore
  validation_funnel_quantity?: number | null  // ✅ Underscore
  validation_seller_tag?: string | null  // ✅ Underscore
  validation_funnel?: string | null  // ✅ Underscore
  productweight?: number | null    // ✅ NEW
  product_weight?: number | null
  target_price_validation?: number | null
  target_price_link_validation?: string | null
  profit?: number | null
  origin?: string | null
  admin_target_quantity?: number | null
  journey_id?: string | null
  journey_number?: number | null
  total_cost?: number | null
  total_revenue?: number | null
  inr_purchase_from_validation?: number | null
  remark: string | null
  sku?: string | null
  address?: string | null
  sns_active?: boolean | null
  sns_period?: string | null
  sns_quantity?: number | null
  sns_start_date?: string | null
  sns_next_due?: string | null
  split_id?: string | null
  split_from_id?: string | null
}

// ADD THIS TYPE
type HistorySnapshot = {
  id: string
  stage: string
  createdat: string
  snapshotdata: any
  journeynumber: number
  profit?: number
  totalcost?: number
  status?: string
}


type TabType = 'main_file' | 'price_wait' | 'order_confirmed' | 'copy' | 'sns' | 'china' | 'india' | 'us' | 'pending' | 'not_found' | 'reject';

const calculateNextDue = (period: string): Date => {
  const now = new Date();
  switch (period) {
    case '2_weeks': now.setDate(now.getDate() + 14); break;
    case '3_weeks': now.setDate(now.getDate() + 21); break;
    case '1_month': now.setMonth(now.getMonth() + 1); break;
    case '5_weeks': now.setDate(now.getDate() + 35); break;
    case '6_weeks': now.setDate(now.getDate() + 42); break;
    case '7_weeks': now.setDate(now.getDate() + 49); break;
    case '2_months': now.setMonth(now.getMonth() + 2); break;
    case '3_months': now.setMonth(now.getMonth() + 3); break;
    case '4_months': now.setMonth(now.getMonth() + 4); break;
    case '5_months': now.setMonth(now.getMonth() + 5); break;
    case '6_months': now.setMonth(now.getMonth() + 6); break;
    default: now.setMonth(now.getMonth() + 1); break;
  }
  return now;
};

const SNS_PERIOD_LABELS: Record<string, string> = {
  '2_weeks': '2 Weeks',
  '3_weeks': '3 Weeks',
  '1_month': '1 Month',
  '5_weeks': '5 Weeks',
  '6_weeks': '6 Weeks',
  '7_weeks': '7 Weeks',
  '2_months': '2 Months',
  '3_months': '3 Months',
  '4_months': '4 Months',
  '5_months': '5 Months',
  '6_months': '6 Months',
};

const FUNNEL_STYLES: Record<string, string> = {
  'RS': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  'DP': 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30',
  'HD': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  'LD': 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg border border-blue-600/30',
};

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('main_file');
  const [products, setProducts] = useState<PassFileProduct[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [selectedCopyIds, setSelectedCopyIds] = useState<Set<string>>(new Set());
  const [copySellerModal, setCopySellerModal] = useState<{ copy: any; tags: string[] } | null>(null);
  const [snsData, setSnsData] = useState<any[]>([]);
  const [snsSelections, setSnsSelections] = useState<Record<string, { period: string; quantity: number }>>({});
  const [snsEditingId, setSnsEditingId] = useState<string | null>(null);
  const [splitModalProduct, setSplitModalProduct] = useState<PassFileProduct | null>(null);
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { logActivity } = useActivityLogger();
  const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaPurchasesFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
  });
  const ensureURL = (url: string | null | undefined): string | undefined => {
    if (!url || !url.trim()) return undefined;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return 'https://' + trimmed;
  };
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 100;

  useEffect(() => {
    localStorage.setItem('indiaPurchasesFunnelFilter', funnelFilter);
  }, [funnelFilter]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [movementHistory, setMovementHistory] = useState<Record<string, Array<{
    product: PassFileProduct
    fromStatus: string | null
    toStatus: string
    wasAdminConfirmed?: boolean
    originalSellerTag?: string | null
    originalBuyingQuantities?: Record<string, number> | null
  }>>>({})

  // ─── Toast notification ───
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const toastIdRef = useRef(0);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const [showAllJourneys, setShowAllJourneys] = useState(false);

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Remark Modal State
  const [selectedRemark, setSelectedRemark] = useState<{ id: string; remark: string } | null>(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editingSellerLinkId, setEditingSellerLinkId] = useState<string | null>(null);
  const [editingSellerLinkValue, setEditingSellerLinkValue] = useState<string>('');
  const [editingSkuValue, setEditingSkuValue] = useState<string>('');
  const [dollarRate, setDollarRate] = useState<number>(1);
  const [openFunnelId, setOpenFunnelId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const fetchConstants = async () => {
    try {
      const { data, error } = await supabase
        .from('india_validation_constants')
        .select('dollarrate')
        .limit(1)
        .single();
      if (error) throw error;
      if (data?.dollarrate) setDollarRate(data.dollarrate);
    } catch (err) {
      console.error('Error fetching constants:', err);
    }
  };

  // Column visibility state - ALL columns visible by default
  const [visibleColumns, setVisibleColumns] = useState({
    checkbox: true,
    asin: true,
    productlink: true,
    productname: true,
    targetprice: true,
    // targetquantity: true,
    funnelquantity: true,
    funnelseller: true,
    inrpurchaselink: true,
    origin: true,
    buyingprice: true,
    buyingquantity: true,
    sellerlink: true,
    sellerphno: true,
    paymentmethod: true,
    trackingdetails: true,
    deliverydate: true,
    orderdate: true,
    moveto: true,
    address: true,
    admintargetprice: true,
    remark: true,
  });

  const [sellerTagFilter, setSellerTagFilter] = useState<string>('ALL');
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  // === DRAGGABLE COLUMN ORDER ===
  const DEFAULT_PURCHASE_COLUMN_ORDER = [
    'asin', 'sku', 'history', 'remark', 'productlink', 'productname',
    'targetprice', 'targetquantity', 'admintargetprice',
    'funnelquantity', 'funnelseller', 'inrpurchaselink', 'origin',
    'buyingprice', 'buyingquantity', 'sellerlink', 'sellerphno',
    'paymentmethod', 'address', 'trackingdetails', 'deliverydate', 'orderdate', 'moveto',
  ];

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_PURCHASE_COLUMN_ORDER;
    try {
      const saved = localStorage.getItem('indiaPurchasesColumnOrder');
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const merged = parsed.filter((k) => DEFAULT_PURCHASE_COLUMN_ORDER.includes(k));
        DEFAULT_PURCHASE_COLUMN_ORDER.forEach((k) => {
          if (!merged.includes(k)) merged.push(k);
        });
        return merged;
      }
    } catch { /* ignore */ }
    return DEFAULT_PURCHASE_COLUMN_ORDER;
  });

  const dragColumnRef = useRef<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);

  const handleColumnDragStart = (colkey: string) => {
    dragColumnRef.current = colkey;
  };

  const handleColumnDragOver = (e: React.DragEvent, colkey: string) => {
    e.preventDefault();
    dragOverColumnRef.current = colkey;
  };

  const handleColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragColumnRef.current || !dragOverColumnRef.current) return;
    if (dragColumnRef.current === dragOverColumnRef.current) return;
    const newOrder = [...columnOrder];
    const fromIdx = newOrder.indexOf(dragColumnRef.current);
    const toIdx = newOrder.indexOf(dragOverColumnRef.current);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragColumnRef.current);
    setColumnOrder(newOrder);
    localStorage.setItem('indiaPurchasesColumnOrder', JSON.stringify(newOrder));
    dragColumnRef.current = null;
    dragOverColumnRef.current = null;
  };
  // === END COLUMN DRAG REORDER ===

  // === RENDER CELL BY COLUMN KEY ===
  const renderPurchaseCell = (colkey: string, product: PassFileProduct) => {
    switch (colkey) {

      case 'asin':
        if (!visibleColumns.asin) return null;
        return (
          <td key={colkey} className="px-6 py-4 font-mono text-sm text-gray-300" style={{ width: columnWidths.asin }}>
            <div className="truncate">{product.asin}</div>
          </td>
        );

      case 'sku':
        return (
          <td key={colkey} className="px-6 py-4 text-sm overflow-hidden" style={{ maxWidth: 220, width: 220 }}>
            <div className="w-full overflow-hidden">
              {editingSkuId === product.id ? (
                <div className="flex items-center gap-1 max-w-full">
                  <input
                    type="text"
                    value={editingSkuValue}
                    onChange={(e) => setEditingSkuValue(e.target.value)}
                    className="min-w-0 flex-1 px-2 py-1 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                    placeholder="Enter SKU..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCellEdit(product.id, 'sku', editingSkuValue.trim() || null);
                        setEditingSkuId(null);
                      } else if (e.key === 'Escape') {
                        setEditingSkuId(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => { handleCellEdit(product.id, 'sku', editingSkuValue.trim() || null); setEditingSkuId(null); }}
                    className="text-emerald-500 hover:text-emerald-400 flex-shrink-0" title="Save (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => setEditingSkuId(null)} className="text-rose-500 hover:text-rose-400 flex-shrink-0" title="Cancel (Esc)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : product.sku ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-100 text-xs break-all leading-tight" title={product.sku}>{product.sku}</span>
                  <button onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(product.sku!); }} className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit SKU">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(''); }} className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add SKU
                </button>
              )}
            </div>
          </td>
        );

      case 'history':
        return (
          <td key={colkey} className="px-6 py-4 text-center" style={{ width: columnWidths.history }}>
            <button onClick={() => fetchHistory(product.asin)} className="p-2 rounded-full hover:bg-white/[0.08] text-gray-400 hover:text-orange-500 transition-colors" title="View Journey History">
              <History className="w-4 h-4" />
            </button>
          </td>
        );

      case 'remark':
        if (!visibleColumns.remark) return null;
        return (
          <td key={colkey} className="px-6 py-4 text-center" style={{ width: columnWidths.remark }}>
            {product.remark ? (
              <button onClick={() => { setSelectedRemark({ id: product.id, remark: product.remark || '' }); setEditingRemarkText(product.remark || ''); }} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">View</button>
            ) : (
              <button onClick={() => { setSelectedRemark({ id: product.id, remark: '' }); setEditingRemarkText(''); }} className="text-gray-300 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>
            )}
          </td>
        );

      case 'productlink':
        if (!visibleColumns.productlink) return null;
        return (
          <td key={colkey} className="px-6 py-4 text-center overflow-hidden" style={{ width: columnWidths.productlink }}>
            {(product.india_link || product.product_link) ? (
              <a href={ensureURL(product.india_link || product.product_link)} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline text-xs font-medium">View</a>
            ) : <span className="text-xs text-gray-300">-</span>}
          </td>
        );

      case 'productname':
        if (!visibleColumns.productname) return null;
        return (
          <td key={colkey} className="px-6 py-4 text-sm text-gray-100 overflow-hidden" style={{ width: columnWidths.productname }}>
            <div className="flex items-center">
              <span className="truncate max-w-[250px]" title={product.product_name || '-'}>{product.product_name || '-'}</span>
              {product.sns_active && (
                <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>
              )}
            </div>
          </td>
        );

      case 'targetprice':
        if (!visibleColumns.targetprice) return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.targetprice }}>
            {(activeTab === 'main_file' || activeTab === 'order_confirmed') ? (
              <div className="px-2 py-1 text-sm font-medium text-emerald-300">
                {product.usd_price ? (product.usd_price * dollarRate).toFixed(2) : '-'}
              </div>
            ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
          </td>
        );

      // case 'targetquantity':
      //   if (!visibleColumns.target_quantity) return null;
      //   return (
      //     <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.targetquantity }}>
      //       {(activeTab === 'main_file' || activeTab === 'order_confirmed') ? (
      //         <div className="px-2 py-1 text-sm font-medium text-emerald-300">{product.target_quantity ?? '-'}</div>
      //       ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
      //     </td>
      //   );

      case 'admintargetprice':
        if (!visibleColumns.admintargetprice) return null;
        if (['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-purple-900/10 overflow-hidden" style={{ width: columnWidths.admintargetprice }}>
            {activeTab === 'order_confirmed' ? (
              <div className="px-2 py-1 text-sm font-medium text-purple-300">{product.admin_target_price ?? '-'}</div>
            ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
          </td>
        );

      case 'funnelquantity':
        if (!visibleColumns.funnelquantity) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden relative" style={{ width: columnWidths.funnelquantity }}>
            {product.validation_funnel ? (
              <button
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                  setOpenFunnelId(openFunnelId === product.id ? null : product.id);
                }}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer hover:ring-2 hover:ring-orange-400 transition-all ${FUNNEL_STYLES[product.validation_funnel.trim()] ?? 'bg-slate-600 text-white'}`}
                title="Click to change funnel"
              >
                {product.validation_funnel}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                  setOpenFunnelId(openFunnelId === product.id ? null : product.id);
                }}
                className="text-xs text-gray-300 hover:text-orange-500 cursor-pointer"
                title="Click to set funnel"
              >-</button>
            )}
            {openFunnelId === product.id && dropdownPos && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { setOpenFunnelId(null); setDropdownPos(null); }} />
                <div
                  className="fixed z-40 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-2 min-w-[100px] animate-in fade-in zoom-in-95 duration-150"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                  <p className="text-[10px] text-gray-500 px-2 py-1 font-semibold uppercase tracking-wider">Change Funnel</p>
                  {['RS', 'DP'].map((f) => (
                    <button
                      key={f}
                      onClick={() => handleFunnelChange(product.id, f)}
                      className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${product.validation_funnel === f ? 'bg-orange-500/10 text-orange-400' : 'text-gray-100 hover:bg-[#111111]'}`}
                    >
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-md font-bold text-xs ${FUNNEL_STYLES[f] ?? 'bg-slate-600 text-white'}`}>{f}</span>
                      <span>{f === 'RS' ? 'Restock' : 'Dropshipping'}</span>
                      {product.validation_funnel === f && (
                        <svg className="w-4 h-4 ml-auto text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </td>
        );

      case 'funnelseller':
        if (!visibleColumns.funnelseller) return null;
        return (
          <td key={colkey} className="px-6 py-4" style={{ width: columnWidths.funnelseller, minWidth: 180 }}>
            {(product.seller_tag || product.validation_seller_tag) ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {(product.seller_tag || product.validation_seller_tag)!.split(',').map((tag: string) => {
                  const cleanTag = tag.trim();
                  return <span key={cleanTag} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'}`}>{cleanTag}</span>;
                })}
              </div>
            ) : <span className="text-xs text-gray-300">-</span>}
          </td>
        );

      case 'inrpurchaselink':
        if (!visibleColumns.inrpurchaselink) return null;
        if (activeTab === 'order_confirmed') return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.inrpurchaselink }}>
            {product.inr_purchase_link ? (
              <a href={ensureURL(product.inr_purchase_link)} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline text-xs truncate block">View</a>
            ) : <span className="text-xs text-gray-300">-</span>}
          </td>
        );

      case 'origin':
        if (!visibleColumns.origin) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.origin }}>
            <div className="flex flex-wrap gap-0.5">
              {product.origin_india && <span className="px-1.5 py-0.5 bg-orange-500 text-white border border-orange-600 rounded text-[10px] font-medium leading-none">IN</span>}
              {product.origin_china && <span className="px-1.5 py-0.5 bg-rose-500 text-white border border-rose-600 rounded text-[10px] font-medium leading-none">CN</span>}
              {product.origin_us && <span className="px-1.5 py-0.5 bg-sky-500 text-white border border-sky-600 rounded text-[10px] font-medium leading-none">US</span>}
              {!product.origin_india && !product.origin_china && !product.origin_us && <span className="text-xs text-gray-300">-</span>}
            </div>
          </td>
        );

      case 'buyingprice':
        if (!visibleColumns.buyingprice) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.buyingprice }}>
            <input
              type="number"
              defaultValue={product.buying_price ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'buyingprice', parseFloat(e.target.value))}
              className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Price..."
            />
          </td>
        );

      case 'buyingquantity':
        if (!visibleColumns.buyingquantity) return null;

        // Extract seller tags for this product
        const qtySellerTags = (product.seller_tag || product.validation_seller_tag)
          ? (product.seller_tag || product.validation_seller_tag)
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
          : [];

        // ── Single / no seller tag → original single input ──
        if (qtySellerTags.length <= 1) {
          return (
            <td key={colkey} className="px-6 py-4 overflow-hidden"
              style={{ width: columnWidths.buyingquantity, minWidth: 200 }}>
              <input
                type="number"
                defaultValue={product.buying_quantity ?? ''}
                onBlur={(e) =>
                  handleCellEdit(product.id, 'buyingquantity', parseInt(e.target.value))
                }
                className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="Qty"
              />
            </td>
          );
        }

        // ── Multiple seller tags → per-seller controlled inputs ──
        const perSellerQty: Record<string, number> =
          (product.buying_quantities as Record<string, number>) ?? {};

        const qtyTagColors = SELLER_STYLES;

        return (
          <td key={colkey} className="px-4 py-3 overflow-hidden"
            style={{ width: columnWidths.buyingquantity, minWidth: 250 }}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {qtySellerTags.map((tag: string) => (
                <div key={tag} className="flex items-center gap-1">
                  <span
                    className={`w-6 h-5 flex items-center justify-center rounded text-[10px] font-bold flex-shrink-0 border ${qtyTagColors[tag] ?? 'bg-[#1a1a1a] text-white border-white/[0.1]'}`}
                  >
                    {tag}
                  </span>
                  <input
                    type="number"
                    value={(product.buying_quantities as any)?.[tag] !== undefined && (product.buying_quantities as any)?.[tag] !== null ? String((product.buying_quantities as any)[tag]) : ''}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      setProducts((prev) =>
                        prev.map((p) => {
                          if (p.id !== product.id) return p;
                          const updated = { ...(p.buying_quantities as Record<string, number>) ?? {} };
                          if (newVal === '') {
                            delete updated[tag];
                          } else {
                            updated[tag] = parseInt(newVal) || 0;
                          }
                          return { ...p, buying_quantities: updated };
                        })
                      );
                    }}
                    onBlur={(e) =>
                      handlePerSellerQtyEdit(
                        product.id,
                        tag,
                        parseInt(e.target.value),
                        product
                      )
                    }
                    className="w-20 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="Qty"
                  />
                </div>
              ))}
              <div className="col-span-2 border-t border-white/[0.1] pt-1 mt-0.5 flex items-center gap-1">
                <span className="text-[10px] text-gray-300 font-medium">Total:</span>
                <span className="text-[11px] text-white font-bold">
                  {Object.values((product.buying_quantities as Record<string, number>) ?? {}).reduce((s, v) => s + (Number(v) || 0), 0) || '—'}
                </span>
              </div>
            </div>
          </td>
        );

      case 'sellerlink':
        if (!visibleColumns.sellerlink) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.sellerlink }}>
            <div className="w-full overflow-hidden">
              {editingSellerLinkId === product.id ? (
                <div className="flex items-center gap-1 max-w-full">
                  <input
                    type="text"
                    value={editingSellerLinkValue}
                    onChange={(e) => setEditingSellerLinkValue(e.target.value)}
                    className="min-w-0 flex-1 px-2 py-1 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                    placeholder="Paste seller link..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCellEdit(product.id, 'seller_link', editingSellerLinkValue.trim() || null);
                        setEditingSellerLinkId(null);
                      } else if (e.key === 'Escape') {
                        setEditingSellerLinkId(null);
                      }
                    }}
                  />
                  <button
                    onClick={() => { handleCellEdit(product.id, 'seller_link', editingSellerLinkValue.trim() || null); setEditingSellerLinkId(null); }}
                    className="text-emerald-500 hover:text-emerald-400 flex-shrink-0" title="Save (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => setEditingSellerLinkId(null)} className="text-rose-500 hover:text-rose-400 flex-shrink-0" title="Cancel (Esc)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : product.seller_link ? (
                <div className="flex items-center gap-2 justify-center">
                  <a href={ensureURL(product.seller_link)} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline text-xs font-medium">View Link</a>
                  <button onClick={() => { setEditingSellerLinkId(product.id); setEditingSellerLinkValue(product.seller_link ?? ''); }} className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit Seller Link">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingSellerLinkId(product.id); setEditingSellerLinkValue(''); }} className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1 justify-center w-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Link
                </button>
              )}
            </div>
          </td>
        );

      case 'sellerphno':
        if (!visibleColumns.sellerphno) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.sellerphno }}>
            <input
              type="text"
              defaultValue={product.seller_phone ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'sellerphone', e.target.value)}
              className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Phone..."
            />
          </td>
        );

      case 'paymentmethod':
        if (!visibleColumns.paymentmethod) return null;
        return (
          <td key={colkey} className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.paymentmethod }}>
            <input
              type="text"
              defaultValue={product.payment_method ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'paymentmethod', e.target.value)}
              className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Method..."
            />
          </td>
        );

      case 'address':
        if (!visibleColumns.address) return null;
        if (activeTab !== 'order_confirmed') return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.address }}>
            <select
              value={product.address ?? ''}
              onChange={(e) => handleCellEdit(product.id, 'address', e.target.value || null)}
              style={{ backgroundColor: '#1a1a1a', color: '#fff' }}
              className="w-full px-2 py-1.5 border border-emerald-500/50 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark] cursor-pointer"
            >
              <option value="" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>-</option>
              <option value="A" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>A</option>
              <option value="B" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>B</option>
            </select>
          </td>
        );

      case 'trackingdetails':
        if (!visibleColumns.trackingdetails) return null;
        if (['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.trackingdetails }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="text"
                defaultValue={product.tracking_details ?? ''}
                onBlur={(e) => handleCellEdit(product.id, 'trackingdetails', e.target.value)}
                className="w-full px-2 py-1.5 bg-[#111111] border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Tracking"
              />
            ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
          </td>
        );

      case 'deliverydate':
        if (!visibleColumns.deliverydate) return null;
        if (['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.deliverydate }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="date"
                defaultValue={product.delivery_date ?? ''}
                min="2020-01-01"
                max="2099-12-31"
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val && val.split('-')[0].length !== 4) { e.target.value = product.delivery_date ?? ''; return; }
                  handleCellEdit(product.id, 'deliverydate', val);
                }}
                className="w-full px-2 py-1.5 bg-[#111111] border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
              />
            ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
          </td>
        );

      case 'orderdate':
        if (!visibleColumns.orderdate) return null;
        if (['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-6 py-4 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.orderdate }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="date"
                defaultValue={product.order_date ?? ''}
                min="2020-01-01"
                max="2099-12-31"
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val && val.split('-')[0].length !== 4) { e.target.value = product.order_date ?? ''; return; }
                  handleCellEdit(product.id, 'orderdate', val);
                }}
                className="w-full px-2 py-1.5 bg-[#111111] border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
              />
            ) : <span className="text-xs text-gray-300 italic">After confirmation</span>}
          </td>
        );

      case 'moveto':
        if (!visibleColumns.moveto) return null;
        return (
          <Fragment key={colkey}>
          {/* S&S cells injected before moveto */}
          {activeTab === 'order_confirmed' && (
            <>
              <td className="px-3 py-2">
                <select
                  value={snsSelections[product.id]?.period || ''}
                  onChange={(e) => setSnsSelections(prev => ({
                    ...prev,
                    [product.id]: { ...prev[product.id], period: e.target.value, quantity: prev[product.id]?.quantity || 1 }
                  }))}
                  style={{ backgroundColor: '#1f2937', color: '#fff' }}
                  className="text-xs border border-gray-600 rounded px-2 py-1.5 cursor-pointer appearance-auto [color-scheme:dark]"
                >
                  <option value="" style={{ backgroundColor: '#1f2937', color: '#fff' }}>No S&S</option>
                  {Object.entries(SNS_PERIOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value} style={{ backgroundColor: '#1f2937', color: '#fff' }}>{label}</option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                {snsSelections[product.id]?.period ? (
                  <input
                    type="number"
                    min={1}
                    value={snsSelections[product.id]?.quantity || 1}
                    onChange={(e) => setSnsSelections(prev => ({
                      ...prev,
                      [product.id]: { ...prev[product.id], quantity: parseInt(e.target.value) || 1 }
                    }))}
                    style={{ backgroundColor: '#1f2937', color: '#fff' }}
                    className="text-xs border border-gray-600 rounded px-2 py-1 w-16"
                  />
                ) : <span className="text-gray-500 text-xs">—</span>}
              </td>
            </>
          )}
          <td className="px-6 py-4 overflow-hidden" style={{ width: columnWidths.moveto }}>
            <div className="flex gap-1 justify-center">
              <button
                type="button"
                onClick={() => { if (activeTab === 'order_confirmed') handleMoveToTracking(product); else handleSendToAdmin(product); }}
                className="w-8 h-8 bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center flex-shrink-0"
                title="Done"
              >D</button>
              {activeTab !== 'price_wait' && (
                <button
                  type="button"
                  onClick={() => handlePriceWait(product)}
                  className="w-8 h-8 bg-yellow-500 text-black border border-yellow-600 rounded-md hover:bg-yellow-400 flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold"
                  title="Price Wait"
                >PW</button>
              )}
              {activeTab !== 'not_found' && (
                <button
                  type="button"
                  onClick={() => handleNotFound(product)}
                  className="w-8 h-8 bg-red-500 text-white border border-red-600 rounded-md hover:bg-red-600 flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold"
                  title="Not Found"
                >NF</button>
              )}
            </div>
          </td>
          </Fragment>
        );

      default:
        return null;
    }
  };


  const fetchProducts = async () => {
    try {
      setLoading(true)

      // 1. Fetch all purchases (Batch 1)
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('india_purchases')
        .select('*') // Select all columns
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      if (!purchasesData || purchasesData.length === 0) {
        setProducts([])
        return
      }

      // 2. Extract all ASINs for bulk querying
      const allAsins = purchasesData.map((p) => p.asin)

      // 3. Fetch validation data in batches (URLs too long with 500+ ASINs)
      const BATCH_SIZE = 200;
      const validationDataArray: any[] = [];
      for (let i = 0; i < allAsins.length; i += BATCH_SIZE) {
        const batch = allAsins.slice(i, i + BATCH_SIZE);
        const { data, error: valError } = await supabase
          .from('india_validation_main_file')
          .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase, profit, total_cost, total_revenue, sku')
          .in('asin', batch);
        if (valError) console.error('Validation fetch error:', valError);
        if (data) validationDataArray.push(...data);
      }

      // 4. Create a Map for instant lookup (O(1) complexity)
      const validationMap = new Map(
        (validationDataArray || []).map((v) => [v.asin, v])
      )

      // 5. Merge data in memory
      const enrichedData = purchasesData.map((product) => {
        const validationData = validationMap.get(product.asin)

        return {
          ...product,
          product_name: product.product_name ?? null,
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          origin_us: product.origin_us ?? false,

          // Validation Fields
          validation_funnel: validationData?.funnel ?? null,
          validation_seller_tag: validationData?.seller_tag ?? null,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase_from_validation: validationData?.inr_purchase ?? null,
          total_cost: validationData?.total_cost ?? null,        // <--- Added
          total_revenue: validationData?.total_revenue ?? null,

          // Ensure these are passed for other calculations
          profit: validationData?.profit ?? null,
          sku: product.sku ?? validationData?.sku ?? null,
          buying_quantities: product.buying_quantities ?? {},
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      // ✅ FIX: Always keep admin_confirmed rows so they show in Order Confirmed tab
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByKey = new Map();
        const confirmedRows: typeof enrichedData = [];

        enrichedData.forEach((product: any) => {
          // Always keep confirmed rows — they must show in the Confirmed tab
          if (product.admin_confirmed === true) {
            confirmedRows.push(product);
            return;
          }

          const key = `${product.asin}|${product.seller_tag || ''}`;
          const existing = latestByKey.get(key);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByKey.set(key, product);
          }
        });

        // Merge: latest non-confirmed + all confirmed (dedup by id)
        const mergedMap = new Map<string, any>();
        for (const p of latestByKey.values()) mergedMap.set(p.id, p);
        for (const p of confirmedRows) mergedMap.set(p.id, p);
        processedData = Array.from(mergedMap.values());
      }

      setProducts(processedData);
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch copies from india_purchase_copies
  const fetchCopies = async () => {
    try {
      const { data, error } = await supabase
        .from('india_purchase_copies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCopies(data || []);
    } catch (err) {
      console.error('Error fetching copies:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'copy') {
      fetchCopies();
    }
  }, [activeTab]);

  const handleDeleteCopy = async (copyItem: any) => {
    try {
      await supabase.from('india_purchase_copies').delete().eq('id', copyItem.id);
      setCopies(prev => prev.filter(c => c.id !== copyItem.id));
      showToast('Copy deleted', 'success');
    } catch {
      showToast('Failed to delete copy', 'error');
    }
  };

  const handleSendCopyToPurchases = async (copyItem: any, selectedTag?: string) => {
    try {
      const tags = (copyItem.seller_tag || '').split(',').map((t: string) => t.trim()).filter(Boolean);

      // If multi-tag and no tag selected yet, show modal
      if (tags.length > 1 && !selectedTag) {
        setCopySellerModal({ copy: copyItem, tags });
        return;
      }

      const tag = selectedTag || tags[0] || '';

      // Check if this ASIN+tag already exists in purchases
      const { data: existing } = await supabase
        .from('india_purchases')
        .select('id')
        .eq('asin', copyItem.asin)
        .eq('seller_tag', tag)
        .is('move_to', null)
        .or('sent_to_admin.is.null,sent_to_admin.eq.false')
        .maybeSingle();

      if (existing) {
        showToast(`${copyItem.asin} with ${tag} already exists in purchases`, 'info');
        return;
      }

      const { error } = await supabase
        .from('india_purchases')
        .insert({
          asin: copyItem.asin,
          product_name: copyItem.product_name,
          brand: copyItem.brand,
          seller_tag: tag,
          funnel: copyItem.funnel,
          product_link: copyItem.india_link || null,
          inr_purchase_link: null,
          origin: 'India',
          origin_india: true,
          origin_china: false,
          origin_us: false,
          buying_price: 0,
          buying_quantity: 0,
          buying_quantities: { [tag]: 0 },
          remark: copyItem.remark || null,
          sku: copyItem.sku || null,
        });

      if (error) throw error;

      setCopySellerModal(null);
      showToast(`${copyItem.asin} (${tag}) sent to Purchase Main File`, 'success');
      await refreshProductsSilently();

      logActivity({
        action: 'copy_to_purchases',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_purchases',
        asin: copyItem.asin,
        details: { from: 'copies', to: 'purchases', seller_tag: tag }
      });
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  };

  // S&S functions
  const fetchSns = async () => {
    const { data, error } = await supabase
      .from('india_purchase_sns')
      .select('*')
      .order('sns_next_due', { ascending: true });
    if (!error && data) setSnsData(data);
  };

  useEffect(() => {
    if (activeTab === 'sns') {
      fetchSns();
    }
  }, [activeTab]);

  useEffect(() => {
    // Check for due S&S items on mount
    const checkSnsDue = async () => {
      const { data: dueItems } = await supabase
        .from('india_purchase_sns')
        .select('*')
        .lte('sns_next_due', new Date().toISOString());

      if (dueItems && dueItems.length > 0) {
        for (const item of dueItems) {
          // Fetch max journey_number for this ASIN to increment
          const { data: maxJourney } = await supabase
            .from('india_asin_history')
            .select('journey_number')
            .eq('asin', item.asin)
            .order('journey_number', { ascending: false })
            .limit(1);
          const nextJourneyNumber = (maxJourney?.[0]?.journey_number || 1) + 1;
          const newJourneyId = crypto.randomUUID();

          await supabase.from('india_purchases').insert({
            asin: item.asin,
            product_name: item.product_name,
            brand: item.brand,
            seller_tag: item.seller_tag,
            funnel: item.funnel,
            sku: item.sku,
            remark: item.remark,
            sns_active: true,
            sns_period: item.sns_period,
            sns_quantity: item.sns_quantity,
            buying_quantity: item.sns_quantity,
            buying_quantities: item.buying_quantities || { [item.seller_tag]: item.sns_quantity },
            buying_price: item.buying_price || null,
            admin_confirmed: true,
            admin_confirmed_at: new Date().toISOString(),
            journey_id: newJourneyId,
            journey_number: nextJourneyNumber,
          });

          const nextDue = calculateNextDue(item.sns_period);
          await supabase.from('india_purchase_sns')
            .update({ sns_next_due: nextDue.toISOString(), updated_at: new Date().toISOString() })
            .eq('id', item.id);
        }
        fetchProducts();
      }
      fetchSns(); // Always fetch S&S count on mount
      fetchCopies(); // Always fetch copies count on mount
    };
    checkSnsDue();
  }, []);

  const handleEditSns = async (snsItem: any, newPeriod: string, newQuantity: number, customDueDate?: string) => {
    try {
      const nextDue = customDueDate ? new Date(customDueDate) : calculateNextDue(newPeriod);
      await supabase.from('india_purchase_sns')
        .update({
          sns_period: newPeriod,
          sns_quantity: newQuantity,
          sns_next_due: nextDue.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', snsItem.id);
      showToast('S&S updated', 'success');
      setSnsEditingId(null);
      fetchSns();
    } catch {
      showToast('Failed to update S&S', 'error');
    }
  };

  const handleRemoveSns = async (snsItem: any) => {
    try {
      await supabase.from('india_purchase_sns').delete().eq('id', snsItem.id);
      showToast('S&S subscription removed', 'success');
      fetchSns();
    } catch {
      showToast('Failed to remove S&S', 'error');
    }
  };

  const handleSplitOrder = async (product: PassFileProduct, quantities: Record<string, number>) => {
    try {
      const entries = Object.entries(quantities).filter(([_, qty]) => qty > 0);
      if (entries.length < 2) {
        showToast('Need at least 2 splits with quantity > 0', 'error');
        return;
      }
      const isSingleTag = !(product.seller_tag || '').includes(',');
      const baseTag = (product.seller_tag || 'GR').split(',')[0].trim();
      const { data: freshProduct } = await supabase
        .from('india_purchases')
        .select('*')
        .eq('id', product.id)
        .single();
      if (!freshProduct) {
        showToast('Product not found. Please refresh.', 'error');
        return;
      }
      const splitFromId = crypto.randomUUID();
      const inserts = entries.map(([key, qty]) => {
        const tag = isSingleTag ? baseTag : key;
        const { id, created_at, ...rest } = freshProduct;
        return {
          ...rest,
          seller_tag: tag,
          buying_quantities: { [tag]: qty },
          buying_quantity: qty,
          split_id: crypto.randomUUID(),
          split_from_id: splitFromId,
        };
      });
      await supabase.from('india_purchases').delete().eq('id', product.id);
      const { error: insertError } = await supabase.from('india_purchases').insert(inserts);
      if (insertError) throw new Error(`Split insert failed: ${insertError.message}`);
      setSplitModalProduct(null);
      showToast(`Order split into ${entries.length} rows`, 'success');
      fetchProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to split order', 'error');
    }
  };

  // ✅ Silent refresh - updates data WITHOUT loading screen (OPTIMIZED)
  const refreshProductsSilently = async () => {
    try {
      // Fetch purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('india_purchases')
        .select('*')
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      // Fetch validation data in batches (URLs too long with 500+ ASINs)
      const allAsins = purchasesData.map((p: any) => p.asin)
      const validationDataArray: any[] = [];
      for (let i = 0; i < allAsins.length; i += 200) {
        const batch = allAsins.slice(i, i + 200);
        const { data } = await supabase
          .from('india_validation_main_file')
          .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku')
          .in('asin', batch);
        if (data) validationDataArray.push(...data);
      }

      // Create lookup map for fast access
      const validationMap = new Map(
        (validationDataArray || []).map((v: any) => [v.asin, v])
      )

      // Enrich data
      const enrichedData = purchasesData.map((product: any) => {
        const validationData = validationMap.get(product.asin)

        return {
          ...product,
          product_name: product.product_name ?? null,
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          origin_us: product.origin_us ?? false,
          validation_funnel: validationData?.funnel ?? null,
          validation_seller_tag: validationData?.seller_tag ?? null,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase_from_validation: validationData?.inr_purchase ?? null,
          profit: validationData?.profit ?? null,
          sku: product.sku ?? validationData?.sku ?? null,
          buying_quantities: product.buying_quantities ?? {},
          total_cost: validationData?.total_cost ?? null,        // <--- Added
          total_revenue: validationData?.total_revenue ?? null,
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      // ✅ FIX: Always keep admin_confirmed rows so they show in Order Confirmed tab
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByKey = new Map();
        const confirmedRows: typeof enrichedData = [];

        enrichedData.forEach((product: any) => {
          // Always keep confirmed rows — they must show in the Confirmed tab
          if (product.admin_confirmed === true) {
            confirmedRows.push(product);
            return;
          }

          const key = `${product.asin}|${product.seller_tag || ''}`;
          const existing = latestByKey.get(key);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByKey.set(key, product);
          }
        });

        // Merge: latest non-confirmed + all confirmed (dedup by id)
        const mergedMap = new Map<string, any>();
        for (const p of latestByKey.values()) mergedMap.set(p.id, p);
        for (const p of confirmedRows) mergedMap.set(p.id, p);
        processedData = Array.from(mergedMap.values());
      }

      setProducts(processedData);
    } catch (error) {
      console.error('Error refreshing products:', error)
    }
  }

  // ✅ Ctrl+Z keyboard shortcut for Roll Back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault()
        handleRollBack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [movementHistory, activeTab])

  // ✅ FIXED: Proper async handling in useEffect
  useEffect(() => {
    fetchProducts();
    fetchConstants();
    const channel = supabase
      .channel('purchases-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'india_purchases' }, () => {
        refreshProductsSilently()
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [showAllJourneys]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRemark) { setSelectedRemark(null); setEditingRemarkText(''); }
        if (openFunnelId) { setOpenFunnelId(null); setDropdownPos(null); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRemark, openFunnelId]);

  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    checkbox: 36,
    asin: 100,
    history: 45,
    remark: 55,
    productlink: 55,
    productname: 100,
    targetprice: 75,
    // targetquantity: 55,
    admintargetprice: 80,
    funnelquantity: 45,
    funnelseller: 200,
    inrpurchaselink: 55,
    origin: 60,
    buyingprice: 75,
    buyingquantity: 200,
    sellerlink: 120,
    sellerphno: 140,
    paymentmethod: 140,
    address: 80,
    trackingdetails: 180,
    deliverydate: 140,
    orderdate: 140,
    moveto: 120,
  });

  const [resizing, setResizing] = useState<{ column: string, startX: number, startWidth: number } | null>(null);

  // Handle sending to admin validation
  const handleSendToAdmin = async (product: PassFileProduct) => {
    try {
      // ─────────────────────────────────────────────
      // 🆕 STEP 0: SPLIT SELLER TAGS BY QUANTITY
      // ─────────────────────────────────────────────
      const allSellerTags: string[] = (product.seller_tag || product.validation_seller_tag)
        ? (product.seller_tag || product.validation_seller_tag)!.split(',').map((t: string) => t.trim().toUpperCase()).filter(Boolean)
        : [];
      const buyingQuantities = (product.buying_quantities || {}) as Record<string, number>;

      let tagsToMove: string[] = [];
      let tagsToKeep: string[] = [];

      if (allSellerTags.length <= 1) {
        // Single tag or no tag → always move (original behavior)
        tagsToMove = allSellerTags.length > 0 ? [...allSellerTags] : [];
      } else {
        // Multiple seller tags → check each tag's quantity
        for (const tag of allSellerTags) {
          const qty = buyingQuantities[tag];
          if (qty !== undefined && qty !== null && qty > 0) {
            tagsToMove.push(tag);
          } else {
            tagsToKeep.push(tag);
          }
        }

        // Edge case: ALL tags have zero qty → block
        if (tagsToMove.length === 0) {
          showToast('No seller tags have quantity > 0. Please enter quantities first.', 'error');
          return;
        }
      }


      // SAVE TO HISTORY FIRST!
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), {
          product,
          fromStatus: product.move_to ?? null,
          toStatus: 'sent_to_admin',
          wasAdminConfirmed: product.admin_confirmed === true,
          originalSellerTag: product.seller_tag,
          originalBuyingQuantities: product.buying_quantities,
        }],
      }));

      // 🆕 Fetch profit matching BOTH asin AND journey_id
      let validationData = null;

      if (product.journey_id) {
        const { data } = await supabase
          .from('india_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price, remark')
          .eq('asin', product.asin)
          .eq('current_journey_id', product.journey_id)
          .maybeSingle();
        validationData = data;
      }

      if (!validationData) {
        const { data } = await supabase
          .from('india_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price, remark')
          .eq('asin', product.asin)
          .order('journey_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        validationData = data;
      }

      // Build origin text
      const originParts: string[] = [];
      if (product.origin_india) originParts.push('India');
      if (product.origin_china) originParts.push('China');
      if (product.origin_us) originParts.push('US');
      const originText = originParts.length > 0 ? originParts.join(', ') : 'India';

      // 🆕 Build buying_quantities for ONLY the tags being moved
      const movedQties: Record<string, number> = {};
      for (const tag of tagsToMove) {
        movedQties[tag] = buyingQuantities[tag] || 0;
      }
      const movedTotalQty = Object.values(movedQties).reduce((sum, v) => sum + (Number(v) || 0), 0);

      // Insert one admin validation row per seller tag
      const skippedTags: string[] = [];
      for (const tag of tagsToMove) {
        // Check if this specific tag is already in admin
        let existingAdminQuery = supabase
          .from('india_admin_validation')
          .select('id')
          .eq('asin', product.asin)
          .eq('admin_status', 'pending')
          .eq('seller_tag', tag);
        if (product.journey_id) {
          existingAdminQuery = existingAdminQuery.eq('journey_id', product.journey_id);
        }
        const { data: existingAdmin } = await existingAdminQuery.maybeSingle();

        if (existingAdmin) {
          skippedTags.push(tag);
          continue;
        }

        const tagQty = buyingQuantities[tag] || 0;
        const { error: insertError } = await supabase
          .from('india_admin_validation')
          .insert({
            asin: product.asin,
            product_name: product.product_name,
            product_link: product.india_link || product.product_link,
            target_price: validationData?.inr_purchase || null,
            target_price_validation: validationData?.inr_purchase || null,
            target_price_link_validation: product.inr_purchase_link || null,
            funnel: product.validation_funnel ? Number(product.validation_funnel) : null,
            seller_tag: tag,
            buying_price: product.buying_price ?? null,
            buying_quantity: tagQty,
            buying_quantities: { [tag]: tagQty },
            seller_link: null,
            seller_phone: product.seller_phone || '',
            payment_method: product.payment_method || '',
            origin_india: product.origin_india ?? false,
            origin_china: product.origin_china ?? false,
            origin_us: product.origin_us ?? false,
            origin: originText,
            inr_purchase_link: product.inr_purchase_link || null,
            profit: validationData?.profit || 0,
            total_cost: validationData?.total_cost || 0,
            total_revenue: validationData?.total_revenue || 0,
            product_weight: validationData?.product_weight ?? null,
            usd_price: validationData?.usd_price ?? null,
            inr_purchase: validationData?.inr_purchase ?? null,
            remark: validationData?.remark ?? null,
            sku: product.sku || null,
            journey_id: product.journey_id || null,
            journey_number: product.journey_number || 1,
            admin_status: 'pending',
            admin_target_price: null,
            admin_target_quantity: null,
            status: 'pending',
          });
        if (insertError) throw insertError;
      }

      // If ALL tags were skipped (already in admin), abort
      if (skippedTags.length === tagsToMove.length) {
        showToast(`All tags already in Admin Validation: ${skippedTags.join(', ')}`, 'info');
        return;
      }
      // Filter out skipped tags from tagsToMove
      const actuallyMoved = tagsToMove.filter(t => !skippedTags.includes(t));
      if (skippedTags.length > 0) {
        // Move skipped tags to tagsToKeep so they stay in purchases
        tagsToKeep.push(...skippedTags);
      }

      // Save copy for future validation skip
      try {
        await supabase.from('india_purchase_copies').upsert({
          asin: product.asin,
          product_name: product.product_name,
          brand: (product as any).brand,
          seller_tag: product.seller_tag || (product as any).validation_seller_tag,
          funnel: product.funnel,
          india_link: product.product_link,
          amz_link: (product as any).amz_link,
          remark: (product as any).remark,
          sku: (product as any).sku,
          category: (product as any).category,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'asin' });
      } catch (copyErr) {
        console.error('Failed to save copy:', copyErr);
      }

      // ─────────────────────────────────────────────
      // Split original row into individual per-tag rows
      // Each tag gets its own purchase row
      // ─────────────────────────────────────────────
      if (allSellerTags.length <= 1) {
        // Single tag → simple update, no splitting needed
        const { error: updateError } = await supabase
          .from('india_purchases')
          .update({
            sent_to_admin: true,
            sent_to_admin_at: new Date().toISOString(),
          })
          .eq('id', product.id);
        if (updateError) throw updateError;

        showToast('Sent to Admin Validation', 'success');
        setProducts(prev => prev.map(p =>
          p.id === product.id ? { ...p, sent_to_admin: true, sent_to_admin_at: new Date().toISOString() } : p
        ));
      } else {
        // Multi-tag — keep remaining tags merged in original row

        // Fetch fresh data
        const { data: freshProduct } = await supabase
          .from('india_purchases')
          .select('*')
          .eq('id', product.id)
          .single();

        if (!freshProduct) throw new Error('Product not found');
        const { id: _id, created_at: _ca, ...restFields } = freshProduct;

        if (tagsToKeep.length > 0) {
          // PARTIAL MOVE: Update original row — remove moved tags, keep remaining merged
          const keptQties: Record<string, number> = {};
          for (const tag of tagsToKeep) {
            keptQties[tag] = buyingQuantities[tag] || 0;
          }
          const keptTotal = Object.values(keptQties).reduce((s, v) => s + (Number(v) || 0), 0);

          const { error: updateError } = await supabase
            .from('india_purchases')
            .update({
              seller_tag: tagsToKeep.join(', '),
              buying_quantities: keptQties,
              buying_quantity: keptTotal,
            })
            .eq('id', product.id);
          if (updateError) throw updateError;
        } else {
          // ALL tags moved — mark original as sent_to_admin
          const { error: updateError } = await supabase
            .from('india_purchases')
            .update({
              sent_to_admin: true,
              sent_to_admin_at: new Date().toISOString(),
            })
            .eq('id', product.id);
          if (updateError) throw updateError;
        }

        // Create individual purchase rows for each tag going to admin
        for (const tag of actuallyMoved) {
          await supabase.from('india_purchases').insert({
            ...restFields,
            seller_tag: tag,
            buying_quantities: { [tag]: buyingQuantities[tag] || 0 },
            buying_quantity: buyingQuantities[tag] || 0,
            sent_to_admin: true,
            sent_to_admin_at: new Date().toISOString(),
            admin_confirmed: false,
            admin_confirmed_at: null,
          });
        }

        // Optimistic UI
        if (tagsToKeep.length > 0) {
          const keptQties2: Record<string, number> = {};
          for (const tag of tagsToKeep) {
            keptQties2[tag] = buyingQuantities[tag] || 0;
          }
          const keptTotal2 = Object.values(keptQties2).reduce((s, v) => s + (Number(v) || 0), 0);

          setProducts(prev => prev.map(p =>
            p.id === product.id
              ? {
                  ...p,
                  seller_tag: tagsToKeep.join(', '),
                  buying_quantities: keptQties2 as Record<string, number>,
                  buying_quantity: keptTotal2,
                }
              : p
          ));
          showToast(
            `Sent ${actuallyMoved.join(', ')} to Admin. ${tagsToKeep.join(', ')} kept in purchases.`,
            'success'
          );
        } else {
          setProducts(prev => prev.map(p =>
            p.id === product.id
              ? { ...p, sent_to_admin: true, sent_to_admin_at: new Date().toISOString() }
              : p
          ));
          showToast('Sent to Admin Validation', 'success');
        }
      }

      // Log activity
      logActivity({
        action: 'submit',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_admin_validation',
        asin: product.asin,
        details: {
          from: activeTab,
          to: 'admin_validation',
          funnel: product.validation_funnel,
          tags_moved: tagsToMove,
          tags_remaining: tagsToKeep,
        },
      });

      await refreshProductsSilently();
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Fetch History for Sidebar
  const fetchHistory = async (asin: string) => {
    setSelectedHistoryAsin(asin)
    setHistoryLoading(true)
    try {
      const { data, error } = await supabase
        .from('india_asin_history')
        .select('*')
        .eq('asin', asin)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      setHistoryData(data || [])
    } catch (err) {
      console.error(err)
      showToast('Failed to load history', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Handle Price Wait
  const handlePriceWait = async (product: PassFileProduct) => {
    try {
      // ✅ SAVE TO HISTORY FIRST!
      // SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), {
          product,
          fromStatus: product.move_to,
          toStatus: 'price_wait',
          wasAdminConfirmed: product.admin_confirmed === true,
        }],
      }))

      setProducts(prev => prev.filter(p => p.id !== product.id));

      const { error } = await supabase
        .from('india_purchases')  // ✅ Underscore
        .update({ move_to: 'pricewait', admin_confirmed: false })   // ✅ Clear admin_confirmed so it leaves the confirmed tab
        .eq('id', product.id)

      if (error) throw error

      showToast('Moved to Price Wait', 'success');
      // ✅ ADD THIS:
      logActivity({
        action: 'move',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_purchases',
        asin: product.asin,
        details: { from: activeTab, to: 'pricewait' }
      });
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
      showToast(`Error: ${error.message}`, 'error')
    }
  }

  // Handle Not Found
  const handleNotFound = async (product: PassFileProduct) => {
    try {
      // ✅ SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), {
          product,
          fromStatus: product.move_to ?? null,
          toStatus: 'not_found',
          wasAdminConfirmed: product.admin_confirmed === true,
        }],
      }))

      setProducts(prev => prev.filter(p => p.id !== product.id));

      const { error } = await supabase
        .from('india_purchases')  // ✅ Underscore
        .update({ move_to: 'notfound', admin_confirmed: false })  // ✅ Underscore
        .eq('id', product.id)

      if (error) throw error

      showToast('Marked as Not Found', 'success');
      // ✅ ADD THIS:
      logActivity({
        action: 'reject',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_purchases',
        asin: product.asin,
        details: { from: activeTab, to: 'notfound' }
      });
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
      showToast(`Error: ${error.message}`, 'error')
    }
  }

  // Move selected products back to Validation
  const handleMoveToValidation = async () => {
    if (selectedIds.size === 0) {
      showToast('Select at least one product', 'error');
      return;
    }

    const selectedProducts = filteredProducts.filter(p => selectedIds.has(p.id));
    if (!confirm(`Move ${selectedProducts.length} product(s) back to Validation?`)) return;

    try {
      // Check for orphaned tracking entries before proceeding
      const orphanedAsins: string[] = [];
      for (const product of selectedProducts) {
        const { data: trackingEntries } = await supabase
          .from('india_inbound_tracking')
          .select('id')
          .eq('asin', product.asin)
          .limit(1);
        if (trackingEntries && trackingEntries.length > 0) {
          orphanedAsins.push(product.asin);
        }
      }
      if (orphanedAsins.length > 0) {
        showToast(`Cannot move: ${orphanedAsins.join(', ')} still has entries in Inbound Tracking. Remove tracking entries first.`, 'error');
        return;
      }

      for (const product of selectedProducts) {
        // 1. Reset sent_to_purchases in validation
        let validationQuery = supabase
          .from('india_validation_main_file')
          .update({ sent_to_purchases: false, sent_to_purchases_at: null })
          .eq('asin', product.asin);

        if (product.journey_id) {
          validationQuery = validationQuery.eq('current_journey_id', product.journey_id);
        }

        const { error: valError } = await validationQuery;
        if (valError) {
          console.error('Validation reset error:', valError);
          // Fallback: try without journey_id
          await supabase
            .from('india_validation_main_file')
            .update({ sent_to_purchases: false, sent_to_purchases_at: null })
            .eq('asin', product.asin);
        }

        // 2. Delete from purchases
        const { error: delError } = await supabase
          .from('india_purchases')
          .delete()
          .eq('id', product.id);

        if (delError) throw delError;

        // Delete copy when sending back to validation
        try {
          await supabase.from('india_purchase_copies').delete().eq('asin', product.asin);
        } catch {}

        // 3. Log activity
        logActivity({
          action: 'move_to_validation',
          marketplace: 'india',
          page: 'purchases',
          table_name: 'india_purchases',
          asin: product.asin,
          details: { from: 'purchases', to: 'validation' }
        });
      }

      showToast(`Moved ${selectedProducts.length} product(s) back to Validation`, 'success');
      setSelectedIds(new Set());
      await refreshProductsSilently();
    } catch (error: any) {
      showToast(`Error: ${error.message}`, 'error');
    }
  };

  // Roll Back last movement
  const handleRollBack = async () => {
    const tabHistory = movementHistory[activeTab]

    if (!tabHistory || tabHistory.length === 0) {
      showToast('No recent movement to roll back', 'info')
      return
    }

    const lastMovement = tabHistory[tabHistory.length - 1]

    try {
      const { product, fromStatus, toStatus, wasAdminConfirmed, originalSellerTag, originalBuyingQuantities } = lastMovement
      const updateData: any = {}

      if (toStatus === 'sent_to_admin') {
        // 1. Delete admin validation entries
        let adminDeleteQuery = supabase
          .from('india_admin_validation')
          .delete()
          .eq('asin', product.asin);
        if (product.journey_id) {
          adminDeleteQuery = adminDeleteQuery.eq('journey_id', product.journey_id);
        }
        await adminDeleteQuery;

        // 2. Delete the individual purchase rows created for moved tags
        await supabase
          .from('india_purchases')
          .delete()
          .eq('asin', product.asin)
          .eq('sent_to_admin', true)
          .neq('id', product.id);

        // 3. Restore original row — add back moved tags
        const wasMultiTag = originalSellerTag && originalSellerTag.includes(',');

        if (wasMultiTag) {
          const totalQty = originalBuyingQuantities
            ? Object.values(originalBuyingQuantities).reduce((sum, v) => sum + (Number(v) || 0), 0)
            : product.buying_quantity || 0;

          await supabase
            .from('india_purchases')
            .update({
              seller_tag: originalSellerTag,
              buying_quantities: originalBuyingQuantities || {},
              buying_quantity: totalQty,
              sent_to_admin: false,
              sent_to_admin_at: null,
              admin_confirmed: false,
              admin_confirmed_at: null,
            })
            .eq('id', product.id);
        } else {
          await supabase
            .from('india_purchases')
            .update({
              sent_to_admin: false,
              sent_to_admin_at: null,
              admin_confirmed: false,
              admin_confirmed_at: null,
            })
            .eq('id', product.id);
        }

        // Skip generic update, handle everything here
        setMovementHistory(prev => {
          const newHistory = { ...prev };
          const arr = [...(newHistory[activeTab] || [])];
          arr.pop();
          newHistory[activeTab] = arr;
          return newHistory;
        });
        showToast(`Rolled back ${product.product_name}`, 'success');
        logActivity({
          action: 'rollback',
          marketplace: 'india',
          page: 'purchases',
          table_name: 'india_purchases',
          asin: product.asin,
          details: { from: toStatus, to: fromStatus }
        });
        await refreshProductsSilently();
        return; // Early return
      } else if (toStatus === 'tracking') {
        // Rollback from tracking → delete from tracking tables, restore in purchases
        const rawSellerTag = product.seller_tag || '';
        const sellerTags = rawSellerTag.split(',').map((t: string) => t.trim().toUpperCase()).filter(Boolean);
        const sellerTagMapping: Record<string, number> = {
          'GR': 1, 'RR': 2, 'UB': 3, 'VV': 4, 'DE': 5, 'CV': 6, 'MV': 7, 'KL': 8
        };

        // Delete from each tracking table
        // ✅ FIX: Delete from correct table (india_inbound_tracking)
        let trackingDeleteQuery = supabase
          .from('india_inbound_tracking')
          .delete()
          .eq('asin', product.asin)
          .eq('seller_tag', product.seller_tag);
        if (product.journey_id) {
          trackingDeleteQuery = trackingDeleteQuery.eq('journey_id', product.journey_id);
        }
        const { error: trackingDeleteError } = await trackingDeleteQuery;

        if (trackingDeleteError) {
          console.error('Tracking delete error:', trackingDeleteError);
        }

        // Re-insert into purchases
        const { error: reinsertError } = await supabase
          .from('india_purchases')
          .upsert({
            id: product.id,
            asin: product.asin,
            journey_id: product.journey_id,
            journey_number: product.journey_number,
            product_name: product.product_name,
            product_link: product.product_link,
            brand: (product as any).brand,
            target_price: product.target_price,
            admin_target_price: (product as any).admin_target_price,
            funnel: product.funnel,
            seller_tag: originalSellerTag || product.seller_tag,
            funnel_seller: (product as any).funnel_seller,
            buying_price: product.buying_price,
            buying_quantity: product.buying_quantity,
            buying_quantities: originalBuyingQuantities || product.buying_quantities,
            seller_link: product.seller_link,
            seller_phone: product.seller_phone,
            payment_method: product.payment_method,
            origin: (product as any).origin,
            origin_india: (product as any).origin_india,
            origin_china: (product as any).origin_china,
            origin_us: (product as any).origin_us,
            tracking_details: (product as any).tracking_details,
            delivery_date: (product as any).delivery_date,
            order_date: (product as any).order_date,
            remark: (product as any).remark,
            profit: (product as any).profit,
            product_weight: (product as any).product_weight,
            usd_price: (product as any).usd_price,
            inr_purchase: (product as any).inr_purchase,
            inr_purchase_link: (product as any).inr_purchase_link,
            sku: (product as any).sku,
            address: (product as any).address,
            admin_target_quantity: (product as any).admin_target_quantity,
            target_price_validation: (product as any).target_price_validation,
            target_price_link_validation: (product as any).target_price_link_validation,
            pending_quantity: (product as any).pending_quantity,
            sns_active: (product as any).sns_active || false,
            sns_period: (product as any).sns_period || null,
            sns_quantity: (product as any).sns_quantity || null,
            admin_confirmed: true,
            status: 'confirmed',
          }, { onConflict: 'id' });

        if (reinsertError) throw reinsertError;

        // Skip the normal update below — we already handled everything
        setMovementHistory(prev => {
          const newHistory = { ...prev };
          const arr = [...(newHistory[activeTab] || [])];
          arr.pop();
          newHistory[activeTab] = arr;
          return newHistory;
        });
        showToast(`Rolled back ${product.product_name} from tracking`, 'success');
        logActivity({
          action: 'rollback',
          marketplace: 'india',
          page: 'purchases',
          table_name: 'india_tracking',
          asin: product.asin,
          details: { from: 'tracking', to: 'order_confirmed' }
        });
        setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
        await refreshProductsSilently();
        return; // ← Early return to skip the generic update below

      } else if (toStatus === 'price_wait' || toStatus === 'not_found') {
        updateData['move_to'] = fromStatus
        if (wasAdminConfirmed) {
          updateData['admin_confirmed'] = true
        }
      }

      const { error: updateError } = await supabase
        .from('india_purchases')
        .update(updateData)
        .eq('id', product.id)

      if (updateError) throw updateError

      // Clear history — pop last entry
      setMovementHistory(prev => {
        const newHistory = { ...prev }
        const arr = [...(newHistory[activeTab] || [])];
        arr.pop();
        newHistory[activeTab] = arr;
        return newHistory
      })

      showToast(`Rolled back ${product.product_name}`, 'success');
      // ✅ ADD THIS:
      logActivity({
        action: 'rollback',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_purchases',
        asin: product.asin,
        details: { from: toStatus, to: fromStatus }
      });
      setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
      await refreshProductsSilently()
    } catch (error) {
      console.error('Error rolling back:', error)
      showToast('Rollback failed', 'error')
    }
  }
  const handleMoveToTracking = async (product: PassFileProduct) => {
    if (!product.admin_confirmed) {
      showToast('Only confirmed items can be moved', 'info');
      return;
    }

    // --- S&S detection ---
    const snsSelection = snsSelections[product.id];
    const isSnS = snsSelection && snsSelection.period && snsSelection.period !== '';

    try {
      setProducts(prev => prev.filter(p => p.id !== product.id));


      // STEP 1: FETCH FRESH DATA (Returns snake_case column names from database)
      const { data: freshProduct, error: fetchError } = await supabase
        .from('india_purchases')
        .select('*')
        .eq('id', product.id)
        .single();


      if (fetchError || !freshProduct) {
        throw new Error('Could not fetch latest data. Please refresh and try again.');
      }




      // STEP 2: Extract ALL unique seller tags
      let sellerTags: string[] = [];
      const rawSellerTag = freshProduct.seller_tag || product.seller_tag || product.validation_seller_tag;


      if (rawSellerTag) {
        sellerTags = rawSellerTag
          .split(',')
          .map((tag: string) => tag.trim().toUpperCase())
          .filter((tag: string) => tag.length > 0);
        sellerTags = [...new Set(sellerTags)]; // Remove duplicates
      }


      // Fallback to GR if no tags
      if (sellerTags.length === 0) {
        sellerTags = ['GR'];
      }




      // ─────────────────────────────────────────────
      // 🆕 STEP 2.5: SPLIT TAGS BY QUANTITY
      // Tags with qty > 0 → move to tracking
      // Tags with qty = 0 or missing → stay in purchases
      // ─────────────────────────────────────────────
      const buyingQuantities = (freshProduct.buying_quantities || {}) as Record<string, number>;

      let tagsToMove: string[] = [];
      let tagsToKeep: string[] = [];

      if (sellerTags.length <= 1) {
        // Single seller tag → always move (original behavior)
        tagsToMove = [...sellerTags];
      } else {
        // Multiple seller tags → check each tag's quantity
        for (const tag of sellerTags) {
          const qty = buyingQuantities[tag];
          if (qty !== undefined && qty !== null && qty > 0) {
            tagsToMove.push(tag);
          } else {
            tagsToKeep.push(tag);
          }
        }

        // Edge case: ALL tags have zero qty → block
        if (tagsToMove.length === 0) {
          showToast('No seller tags have quantity > 0. Please enter quantities first.', 'error');
          return;
        }
      }


      // STEP 2.9: Check for existing entries to prevent duplicates
      const { data: existingEntries } = await supabase
        .from('india_inbound_tracking')
        .select('seller_tag')
        .eq('asin', freshProduct.asin)
        .eq('journey_id', freshProduct.journey_id)
        .in('seller_tag', tagsToMove);

      const existingTags = new Set((existingEntries || []).map((e: any) => e.seller_tag?.trim().toUpperCase()));
      tagsToMove = tagsToMove.filter(tag => !existingTags.has(tag));

      if (tagsToMove.length === 0) {
        showToast('These items are already in tracking', 'info');
        return;
      }

      // Map seller tag to seller ID
      const sellerTagMapping: Record<string, number> = {
        'GR': 1, // Golden Aura
        'RR': 2, // Rudra Retail
        'UB': 3, // UBeauty
        'VV': 4, // Velvet Vista
        'DE': 5, // Dropy Ecom ✅ NEW
        'CV': 6, // Costech Ventures ✅ NEW
        'MV': 7, // Maverick
        'KL': 8  // Kalash
      };


      // STEP 3: INSERT into tracking tables — 🆕 ONLY for tags with qty > 0
      const insertPromises = tagsToMove.map(async (tag) => {



        // ✅ ALL column names use snake_case to match database schema
        return supabase
          .from('india_inbound_tracking')
          .insert({
            // 1. CORE IDENTITY
            asin: freshProduct.asin,
            journey_id: freshProduct.journey_id,
            journey_number: freshProduct.journey_number || 1,


            // 2. PRODUCT INFORMATION
            product_link: freshProduct.product_link,
            product_name: freshProduct.product_name,
            brand: freshProduct.brand,


            // 3. PRICING FIELDS
            target_price: freshProduct.target_price,
            admin_target_price: freshProduct.admin_target_price,
            admin_target_quantity: freshProduct.admin_target_quantity,
            target_price_validation: freshProduct.target_price_validation,
            target_price_link_validation: freshProduct.target_price_link_validation,


            // 4. FUNNEL & SELLER
            funnel: freshProduct.funnel,
            seller_tag: tag, // specific tag for this insert
            funnel_quantity: freshProduct.funnel_quantity || 1,
            funnel_seller: freshProduct.funnel_seller,


            // 5. PURCHASE LINKS
            inr_purchase_link: freshProduct.inr_purchase_link,


            // 6. ORIGIN
            origin: freshProduct.origin,
            origin_india: freshProduct.origin_india ?? false,
            origin_china: freshProduct.origin_china ?? false,
            origin_us: freshProduct.origin_us ?? false,


            // 7. BUYING DETAILS (USER EDITABLE)
            buying_price: freshProduct.buying_price,
            buying_quantity: freshProduct.buying_quantities?.[tag] ?? freshProduct.buying_quantity,
            seller_link: freshProduct.seller_link,
            seller_phone: freshProduct.seller_phone,
            payment_method: freshProduct.payment_method,


            // 8. TRACKING & DELIVERY (USER EDITABLE)
            tracking_details: freshProduct.tracking_details,
            delivery_date: freshProduct.delivery_date,
            order_date: freshProduct.order_date,
            remark: freshProduct.remark,


            // 9. FINANCIAL DATA
            profit: freshProduct.profit,
            product_weight: freshProduct.product_weight,
            usd_price: freshProduct.usd_price,
            inr_purchase: freshProduct.inr_purchase,
            sku: freshProduct.sku || null,
            address: freshProduct.address || null,


            // 10. STATUS FIELDS
            admin_status: 'confirmed',
            status: 'tracking',
            moved_at: new Date().toISOString(),
            pending_quantity: freshProduct.buying_quantities?.[tag] ?? freshProduct.buying_quantity,
            sns_active: isSnS || freshProduct.sns_active || false,
          });
      });


      // Wait for all insertions to complete
      const results = await Promise.all(insertPromises);


      // Check for errors
      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        console.error('❌ Insert errors:', errors);
        errors.forEach((err, index) => {
          console.error(`Error ${index + 1}:`, JSON.stringify(err.error, null, 2));
        });
        throw new Error(`Failed to insert into ${errors.length} table(s)`);
      }



      // --- S&S: save to india_purchase_sns if S&S selected ---
      if (isSnS) {
        const nextDue = calculateNextDue(snsSelection.period);
        try {
          await supabase.from('india_purchase_sns').upsert({
            asin: product.asin,
            product_name: product.product_name,
            brand: (product as any).brand,
            seller_tag: tagsToMove.join(','),
            funnel: product.funnel,
            sku: product.sku || freshProduct?.sku,
            remark: product.remark,
            sns_period: snsSelection.period,
            sns_quantity: snsSelection.quantity,
            sns_next_due: nextDue.toISOString(),
            buying_price: product.buying_price || freshProduct?.buying_price,
            buying_quantities: freshProduct?.buying_quantities || product.buying_quantities,
          }, { onConflict: 'asin,seller_tag' });

          await supabase.from('india_purchases')
            .update({
              sns_active: true,
              sns_period: snsSelection.period,
              sns_quantity: snsSelection.quantity,
              sns_start_date: new Date().toISOString(),
              sns_next_due: nextDue.toISOString(),
            })
            .eq('id', product.id);
        } catch (snsErr) {
          console.error('Failed to save S&S:', snsErr);
        }
      }

      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] || []), {
          product: { ...product, ...freshProduct },
          fromStatus: 'order_confirmed',
          toStatus: 'tracking',
          wasAdminConfirmed: true,
          originalSellerTag: product.seller_tag,
          originalBuyingQuantities: product.buying_quantities,
        }],
      }));

      // ─────────────────────────────────────────────
      // 🆕 STEP 4: CONDITIONAL — DELETE or UPDATE
      // ─────────────────────────────────────────────
      if (tagsToKeep.length === 0) {
        // ✅ ALL tags had qty > 0 → DELETE from purchases (original behavior)
        const { error: deleteError } = await supabase
          .from('india_purchases')
          .delete()
          .eq('id', product.id);


        if (deleteError) {
          console.error('❌ Delete error:', deleteError);
          throw deleteError;
        }


        showToast(`Moved to ${tagsToMove.length} tracking table(s): ${tagsToMove.join(', ')}`, 'success');
      } else {
        // 🆕 PARTIAL MOVE — keep zero-qty tags in Confirmed tab
        const remainingQties: Record<string, number> = {};
        for (const tag of tagsToKeep) {
          remainingQties[tag] = buyingQuantities[tag] || 0;
        }

        const { error: updateError } = await supabase
          .from('india_purchases')
          .update({
            seller_tag: tagsToKeep.join(', '),
            buying_quantities: remainingQties,
            buying_quantity: 0,
          })
          .eq('id', product.id);

        if (updateError) {
          console.error('❌ Update error:', updateError);
          throw updateError;
        }


        showToast(
          `Moved ${tagsToMove.join(', ')} to tracking. ${tagsToKeep.join(', ')} kept in purchases (qty=0).`,
          'success'
        );
      }


      // ✅ Log activity
      logActivity({
        action: 'submit',
        marketplace: 'india',
        page: 'purchases',
        table_name: 'india_tracking',
        asin: product.asin,
        details: {
          from: 'orderconfirmed',
          to: 'tracking',
          seller_tags_moved: tagsToMove,
          seller_tags_remaining: tagsToKeep,
        }
      });
      await refreshProductsSilently();
    } catch (error: any) {
      setProducts(prev => [...prev.filter(p => p.id !== product.id), product]);
      console.error('❌ Move error:', error);
      showToast(`Failed to move: ${error.message}`, 'error');
    }
  };

  // Handle column resize
  const handleMouseDown = (column: string, e: React.MouseEvent) => {
    setResizing({
      column,
      startX: e.clientX,
      startWidth: columnWidths[column],
    });
  };

  // Handle column resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizing) {
        const diff = e.clientX - resizing.startX;
        const newWidth = Math.max(50, resizing.startWidth + diff);
        setColumnWidths(prev => ({
          ...prev,
          [resizing.column]: newWidth,
        }));
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, columnWidths]);

  // ─── STEP 1: Full filtered list ───
  const allFilteredProducts = products.filter((p) => {
    const matchesSearch = !searchQuery ||
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.funnel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Quick funnel filter
    if (funnelFilter !== 'ALL') {
      if (p.validation_funnel !== funnelFilter) return false;
    }
    // Seller tag filter
    if (sellerTagFilter !== 'ALL') {
      if (!(p.seller_tag || p.validation_seller_tag)?.toUpperCase().includes(sellerTagFilter)) return false;
    }

    switch (activeTab) {
      case 'main_file':
        return !p.sent_to_admin && !p.move_to;
      case 'price_wait':
        return p.move_to === 'pricewait';
      case 'order_confirmed':
        return p.admin_confirmed === true;
      case 'china':
        return p.origin_china && !p.sent_to_admin && !p.move_to;
      case 'us':
        return p.origin_us && !p.sent_to_admin && !p.move_to;
      case 'india':
        return p.origin_india && !p.sent_to_admin && !p.move_to;
      case 'pending':
        return p.status === 'pending' && !p.sent_to_admin && !p.move_to;
      case 'not_found':
        return p.move_to === 'notfound';
      default:
        return true;
    }
  }); // ← filter ends here

  // ─── Filtered copies ───
  const filteredCopies = (() => {
    let result = copies;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) =>
        c.asin?.toLowerCase().includes(q) ||
        c.product_name?.toLowerCase().includes(q) ||
        c.brand?.toLowerCase().includes(q) ||
        c.sku?.toLowerCase().includes(q)
      );
    }
    if (funnelFilter !== 'ALL') {
      result = result.filter((c: any) => c.funnel === funnelFilter);
    }
    if (sellerTagFilter !== 'ALL') {
      result = result.filter((c: any) => c.seller_tag?.toUpperCase().includes(sellerTagFilter));
    }
    return result;
  })();

  // ─── Filtered S&S ───
  const filteredSns = (() => {
    let result = snsData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s: any) =>
        s.asin?.toLowerCase().includes(q) ||
        s.product_name?.toLowerCase().includes(q) ||
        s.brand?.toLowerCase().includes(q) ||
        s.sku?.toLowerCase().includes(q)
      );
    }
    if (funnelFilter !== 'ALL') {
      result = result.filter((s: any) => s.funnel === funnelFilter);
    }
    if (sellerTagFilter !== 'ALL') {
      result = result.filter((s: any) => s.seller_tag?.toUpperCase().includes(sellerTagFilter));
    }
    return result;
  })();

  // ─── STEP 2: Pagination (OUTSIDE the filter, after it) ───
  const totalPages = Math.ceil(allFilteredProducts.length / rowsPerPage) || 1;
  const filteredProducts = allFilteredProducts.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // ─── STEP 3: Reset page on filter change ───
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, funnelFilter, sellerTagFilter, showAllJourneys]);


  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleCellEdit = async (id: string, field: string, value: any) => {
    const fieldMap: Record<string, string> = {
      sku: 'sku',
      buyingprice: 'buying_price',
      buyingquantity: 'buying_quantity',
      sellerlink: 'seller_link',
      sellerphone: 'seller_phone',
      paymentmethod: 'payment_method',
      trackingdetails: 'tracking_details',
      deliverydate: 'delivery_date',
      orderdate: 'order_date',
      funnel: 'funnel',
      address: 'address',
    };
    const dbField = fieldMap[field] || field;

    // Send null instead of empty string for date columns
    const dateFields = ['deliverydate', 'orderdate'];
    const finalValue = dateFields.includes(field) && (value === '' || value == null) ? null : value;

    try {
      const updatePayload: Record<string, any> = { [dbField]: finalValue };

      // Sync buying_quantities JSON when buying_quantity is edited (single-tag rows)
      if (field === 'buyingquantity') {
        const product = products.find(p => p.id === id);
        if (product) {
          const tags = (product.seller_tag || product.validation_seller_tag || '')
            .split(',').map((t: string) => t.trim()).filter(Boolean);
          if (tags.length <= 1 && tags[0]) {
            updatePayload.buying_quantities = { [tags[0]]: finalValue || 0 };
          }
        }
      }

      const { error } = await supabase
        .from('india_purchases')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw error;
      await refreshProductsSilently();
    } catch (error: any) {
      console.error(`Error updating ${dbField}:`, error.message);
    }
  };

  // ── Per-Seller Buying Quantity Edit ──
  const handlePerSellerQtyEdit = async (
    id: string,
    sellerTag: string,
    qty: number,
    product: PassFileProduct
  ) => {
    try {
      const existing: Record<string, number> =
        (product.buying_quantities as Record<string, number>) ?? {};
      const updated = { ...existing, [sellerTag]: isNaN(qty) ? 0 : qty };

      // Sum all per-seller quantities for backward compat
      const total = Object.values(updated)
        .reduce((sum, v) => sum + (Number(v) || 0), 0);

      const { error } = await supabase
        .from('india_purchases')
        .update({
          buying_quantities: updated,
          buying_quantity: total,
        })
        .eq('id', id);

      if (error) throw error;

      // Optimistic local state update
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, buying_quantities: updated, buying_quantity: total }
            : p
        )
      );
    } catch (error: any) {
      console.error('Error updating per-seller quantity:', error.message);
      showToast('Failed to update quantity', 'error');
    }
  };

  // ─── Keyboard navigation between cells ───
  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      const allInputs = Array.from(
        (e.currentTarget.closest('tr') as HTMLElement)?.querySelectorAll('input') ?? []
      ) as HTMLInputElement[];
      const idx = allInputs.indexOf(e.currentTarget);
      if (idx < allInputs.length - 1) allInputs[idx + 1].focus();
    }
    if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault();
      const allInputs = Array.from(
        (e.currentTarget.closest('tr') as HTMLElement)?.querySelectorAll('input') ?? []
      ) as HTMLInputElement[];
      const idx = allInputs.indexOf(e.currentTarget);
      if (idx > 0) allInputs[idx - 1].focus();
    }
  };

  const handleFunnelChange = async (id: string, newFunnel: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const oldFunnel = product.validation_funnel;  // ← FIX 1: was validation_funnel

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, validation_funnel: newFunnel } : p  // ← FIX 2: was validation_funnel
      )
    );

    setOpenFunnelId(null);
    setDropdownPos(null);

    try {
      // 1. Update funnel in indiapurchases
      const { error: purchaseError } = await supabase
        .from('india_purchases')
        .update({ funnel: newFunnel })
        .eq('id', id);

      if (purchaseError) throw purchaseError;

      // 2. Also sync to indiavalidationmainfile
      if (product.asin) {
        const { error: valError } = await supabase
          .from('india_validation_main_file')
          .update({ funnel: newFunnel })
          .eq('asin', product.asin);

        if (valError) console.error('Validation sync error (non-fatal)', valError);
      }

      showToast(`Funnel changed to ${newFunnel}`, 'success');
    } catch (error: any) {
      // Rollback on failure
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, validation_funnel: oldFunnel } : p  // ← FIX 3: was validation_funnel
        )
      );
      showToast(`Funnel update failed: ${error.message}`, 'error');
    }
  };

  const downloadCSV = (mode: 'selected' | 'page' | 'all') => {
    let dataToDownload: PassFileProduct[];
    let label: string;

    if (mode === 'selected') {
      dataToDownload = filteredProducts.filter((p) => selectedIds.has(p.id));
      label = `${dataToDownload.length} selected`;
    } else if (mode === 'page') {
      dataToDownload = filteredProducts;
      label = `page`;
    } else {
      dataToDownload = allFilteredProducts;
      label = `all-${dataToDownload.length}`;
    }

    if (dataToDownload.length === 0) {
      showToast('No data to download', 'info');
      return;
    }

    const csvHeaders = [
      'ASIN', 'SKU', 'Product Name', 'Product Link', 'Funnel', 'Seller Tag',
      'Origin', 'Buying Price', 'Target Quantity', 'Admin Target Price',
      'INR Purchase Link', 'Actual Buying Price', 'Buying Quantity',
      'Seller Link', 'Seller Phone', 'Payment Method',
      'Tracking Details', 'Delivery Date', 'Order Date',
      'USD Price', 'INR Purchase', 'Product Weight', 'Profit',
      'Remark', 'Status', 'Admin Confirmed'
    ];

    const csvRows = dataToDownload.map((p) => [
      p.asin,
      p.sku ?? '',
      p.product_name ?? '',
      p.india_link || p.product_link || '',
      p.validation_funnel ?? '',
      p.validation_seller_tag ?? '',
      [p.origin_india ? 'India' : '', p.origin_china ? 'China' : '', p.origin_us ? 'US' : ''].filter(Boolean).join(', '),
      p.buying_price ?? '',
      p.target_quantity ?? '',
      p.admin_target_price ?? '',
      p.inr_purchase_link ?? '',
      p.buying_price ?? '',
      p.buying_quantity ?? '',
      p.seller_link ?? '',
      p.seller_phone ?? '',
      p.payment_method ?? '',
      p.tracking_details ?? '',
      p.delivery_date ?? '',
      p.order_date ?? '',
      p.usd_price ?? '',
      p.inr_purchase ?? '',
      p.product_weight ?? '',
      p.profit ?? '',
      p.remark ?? '',
      p.status ?? '',
      p.admin_confirmed ? 'Yes' : 'No',
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map((row) =>
        row.map((val) => {
          const str = String(val ?? '');
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setIsDownloadDropdownOpen(false);
  };


  const downloadExcel = (mode: 'selected' | 'page' | 'all') => {
    let dataToDownload: PassFileProduct[];

    if (mode === 'selected') {
      dataToDownload = filteredProducts.filter((p) => selectedIds.has(p.id));
    } else if (mode === 'page') {
      dataToDownload = filteredProducts;
    } else {
      dataToDownload = allFilteredProducts;
    }

    if (dataToDownload.length === 0) {
      showToast('No data to download', 'info');
      return;
    }

    const sheetData = dataToDownload.map((p) => ({
      'ASIN': p.asin,
      'SKU': p.sku ?? '',
      'Product Name': p.product_name ?? '',
      'Funnel': p.validation_funnel ?? '',
      'Seller Tag': p.validation_seller_tag ?? '',
      'Origin': [p.origin_india ? 'India' : '', p.origin_china ? 'China' : '', p.origin_us ? 'US' : ''].filter(Boolean).join(', '),
      'Buying Price': p.buying_price ?? '',
      'Admin Target Price': p.admin_target_price ?? '',
      'Buying Quantity': p.buying_quantity ?? '',
      'Seller Link': p.seller_link ?? '',
      'Seller Phone': p.seller_phone ?? '',
      'Payment Method': p.payment_method ?? '',
      'USD Price': p.usd_price ?? '',
      'INR Purchase': p.inr_purchase ?? '',
      'Product Weight': p.product_weight ?? '',
      'Profit': p.profit ?? '',
      'Remark': p.remark ?? '',
      'Status': p.status ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab);
    XLSX.writeFile(wb, `purchases_${activeTab}_${mode}_${new Date().toISOString().split('T')[0]}.xlsx`);

    setIsDownloadDropdownOpen(false);
  };

  const tabs = [
    { key: 'mainfile', label: 'Main File', count: products.filter(p => !p.sent_to_admin && !p.move_to).length },
    { key: 'orderconfirmed', label: 'Order Confirmed', count: products.filter(p => p.admin_confirmed === true).length },
    { key: 'india', label: 'India', count: products.filter(p => p.origin_india).length },
    { key: 'china', label: 'China', count: products.filter(p => p.origin_china).length },
    { key: 'pending', label: 'Pending', count: products.filter(p => p.status === 'pending').length },
    { key: 'pricewait', label: 'Price Wait', count: products.filter(p => p.move_to === 'pricewait').length },
    { key: 'notfound', label: 'Not Found', count: products.filter(p => p.move_to === 'notfound').length },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#111111] p-3 sm:p-4 lg:p-6 text-gray-100 font-sans selection:bg-orange-400/30">

      {/* Header Section */}
      <div className="flex-none mb-3 sm:mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-white">Purchases</h1>
            <p className="text-gray-400 mt-1 text-xs sm:text-sm">Manage purchase orders and track confirmations</p>
          </div>
          <div className="text-xs font-mono text-gray-300 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.1]">
            TOTAL: <span className="text-white font-bold">{products.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs - Midnight Theme Pills */}
      <div className="flex-none flex gap-1.5 sm:gap-2 mb-3 sm:mb-6 p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-full sm:w-fit overflow-x-auto scrollbar-none">
        {/* 1. Main File */}
        <button
          onClick={() => setActiveTab('main_file')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'main_file'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-blue-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Main File ({products.filter(p => !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'main_file' && <div className="absolute inset-0 opacity-10 bg-blue-500" />}
        </button>

        {/* 2. Order Confirmed */}
        <button
          onClick={() => setActiveTab('order_confirmed')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'order_confirmed'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-emerald-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Confirmed ({products.filter(p => p.admin_confirmed === true).length})</span>
          {activeTab === 'order_confirmed' && <div className="absolute inset-0 opacity-10 bg-emerald-500" />}
        </button>

        {/* Copy Tab */}
        <button
          onClick={() => setActiveTab('copy')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'copy'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-blue-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Copies ({copies.length})</span>
          {activeTab === 'copy' && <div className="absolute inset-0 opacity-10 bg-blue-500" />}
        </button>

        {/* S&S Tab */}
        <button
          onClick={() => setActiveTab('sns')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'sns'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-teal-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">S&S ({snsData.length})</span>
          {activeTab === 'sns' && <div className="absolute inset-0 opacity-10 bg-teal-500" />}
        </button>

        {/* 3. India */}
        <button
          onClick={() => setActiveTab('india')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'india'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-orange-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">India ({products.filter(p => p.origin_india && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'india' && <div className="absolute inset-0 opacity-10 bg-orange-500" />}
        </button>

        {/* 4. China */}
        <button
          onClick={() => setActiveTab('china')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'china'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-rose-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">China ({products.filter(p => p.origin_china && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'china' && <div className="absolute inset-0 opacity-10 bg-rose-500" />}
        </button>

        {/* 5. US */}
        <button
          onClick={() => setActiveTab('us')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'us'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-sky-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">US ({products.filter(p => p.origin_us && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'us' && <div className="absolute inset-0 opacity-10 bg-sky-500" />}
        </button>

        {/* 6. Pending */}
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'pending'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-purple-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Pending ({products.filter(p => p.status === 'pending' && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'pending' && <div className="absolute inset-0 opacity-10 bg-purple-500" />}
        </button>

        {/* 7. Price Wait */}
        <button
          onClick={() => setActiveTab('price_wait')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'price_wait'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-amber-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Price Wait ({products.filter(p => p.move_to === 'pricewait').length})</span>
          {activeTab === 'price_wait' && <div className="absolute inset-0 opacity-10 bg-amber-500" />}
        </button>

        {/* 8. Not Found */}
        <button
          onClick={() => setActiveTab('not_found')}
          className={`px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'not_found'
            ? 'text-white bg-[#111111] shadow-[0_0_15px_-5px_currentColor] border border-white/[0.1] text-gray-400'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#1a1a1a]/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Not Found ({products.filter(p => p.move_to === 'notfound').length})</span>
          {activeTab === 'not_found' && <div className="absolute inset-0 opacity-10 bg-slate-500" />}
        </button>
      </div>

      {/* Search & Controls */}
      <div className="flex-none mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-md group">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ASIN, Product Name, SKU, or Funnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600 transition-all shadow-sm text-sm"
          />
        </div>

        {/* Buttons Group */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Funnel Quick Filters */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl p-1 border border-white/[0.1]">
            <button
              onClick={() => setFunnelFilter(funnelFilter === 'RS' ? 'ALL' : 'RS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'RS'
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                }`}
            >
              RS
            </button>
            <button
              onClick={() => setFunnelFilter(funnelFilter === 'DP' ? 'ALL' : 'DP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'DP'
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                }`}
            >
              DP
            </button>
          </div>

          {/* Seller Tag Filter */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl p-1 border border-white/[0.1]">
            <button
              onClick={() => setSellerTagFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sellerTagFilter === 'ALL'
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                }`}
            >
              All
            </button>
            {['GR', 'RR', 'UB', 'VV', 'DE', 'CV', 'MV', 'KL'].map((tag) => {
              const tagColors: Record<string, string> = {
                GR: 'from-yellow-400 to-yellow-600 text-black',
                RR: 'from-slate-400 to-slate-600 text-white',
                UB: 'from-pink-400 to-pink-600 text-white',
                VV: 'from-purple-400 to-purple-600 text-white',
                DE: 'from-cyan-400 to-cyan-600 text-black',
                CV: 'from-teal-400 to-teal-600 text-white',
                MV: 'from-orange-500 to-orange-700 text-white',
                KL: 'from-lime-400 to-lime-600 text-black',
              };
              return (
                <button
                  key={tag}
                  onClick={() => setSellerTagFilter(sellerTagFilter === tag ? 'ALL' : tag)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sellerTagFilter === tag
                    ? `bg-gradient-to-br ${tagColors[tag]} shadow-lg`
                    : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                    }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Download Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDownloadDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDownloadDropdownOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-2 z-20 w-64 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs text-gray-300 px-3 py-1.5 font-semibold uppercase tracking-wider">CSV</p>

                  {/* Download Selected */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => downloadCSV('selected')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Download Selected</span>
                      <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                    </button>
                  )}

                  {/* Download Page */}
                  <button
                    onClick={() => downloadCSV('page')}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download Page</span>
                    <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                  </button>

                  {/* Download All */}
                  <button
                    onClick={() => downloadCSV('all')}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download All</span>
                    <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{products.length}</span>
                  </button>

                  <div className="border-t border-white/[0.1] my-1.5" />
                  <p className="text-xs text-gray-300 px-3 py-1.5 font-semibold uppercase tracking-wider">Excel</p>

                  {/* Excel Selected */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => downloadExcel('selected')}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Download Selected</span>
                      <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                    </button>
                  )}

                  {/* Excel Page */}
                  <button
                    onClick={() => downloadExcel('page')}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download Page</span>
                    <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                  </button>

                  {/* Excel All */}
                  <button
                    onClick={() => downloadExcel('all')}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-100 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download All</span>
                    <span className="text-xs text-gray-300 bg-[#111111] px-2 py-0.5 rounded-full">{products.length}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleRollBack}
            disabled={!movementHistory[activeTab]?.length}
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-orange-600 text-white rounded-xl hover:bg-white/[0.05]/100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs sm:text-sm font-medium shadow-lg shadow-orange-900/20 transition-all border border-orange-500/50"
            title="Roll Back last action from this tab (Ctrl+Z)"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="hidden sm:inline">Roll Back</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={handleMoveToValidation}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-500 flex items-center gap-2 text-xs sm:text-sm font-medium shadow-lg shadow-violet-900/20 transition-all border border-violet-500/50"
              title="Move selected products back to Validation"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              <span className="hidden sm:inline">Move to Validation</span>
              <span className="text-xs bg-violet-500/50 px-1.5 py-0.5 rounded-full">{selectedIds.size}</span>
            </button>
          )}

          {activeTab === 'order_confirmed' && (
            <button
              onClick={() => {
                const selectedProducts = filteredProducts.filter(p => selectedIds.has(p.id));
                if (selectedProducts.length === 0) {
                  showToast('Select a product to split', 'info');
                  return;
                }
                if (selectedProducts.length > 1) {
                  showToast('Please select only 1 product to split', 'info');
                  return;
                }
                const product = selectedProducts[0];
                const tags = (product.seller_tag || '').split(',').map(t => t.trim()).filter(Boolean);
                const buyingQty = (product.buying_quantities || {}) as Record<string, number>;
                if (tags.length <= 1) {
                  const tag = tags[0] || 'GR';
                  const totalQty = buyingQty[tag] || 0;
                  setSplitQuantities({ [`${tag}_1`]: Math.ceil(totalQty / 2), [`${tag}_2`]: Math.floor(totalQty / 2) });
                } else {
                  const initial: Record<string, number> = {};
                  tags.forEach(tag => { initial[tag] = buyingQty[tag] || 0; });
                  setSplitQuantities(initial);
                }
                setSplitModalProduct(product);
              }}
              disabled={selectedIds.size === 0}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl flex items-center gap-2 text-xs sm:text-sm font-medium transition-all border shadow-lg ${
                selectedIds.size > 0
                  ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500/50 shadow-purple-900/20'
                  : 'bg-[#111111] text-gray-500 cursor-not-allowed border-white/[0.1]'
              }`}
            >
              <span className="hidden sm:inline">Split Order</span>
              {selectedIds.size > 0 && <span className="text-xs bg-purple-500/50 px-1.5 py-0.5 rounded-full">{selectedIds.size}</span>}
            </button>
          )}

          {/* 🆕 Journey Toggle Button */}
          <button
            onClick={() => setShowAllJourneys(!showAllJourneys)}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-all border shadow-lg ${showAllJourneys
              ? 'bg-orange-500 text-white hover:bg-orange-400 border-orange-500/50 shadow-orange-500/10'
              : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
              }`}
            title={`Currently showing ${showAllJourneys ? 'ALL journey cycles' : 'latest journey only'}`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">{showAllJourneys ? 'Show Latest Only' : 'Show All Journeys'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] hover:text-white border border-white/[0.1] flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Hide Columns</span>
            </button>

            {isColumnMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-4 z-20 w-64 animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="font-semibold text-gray-100 mb-3 text-sm">Toggle Columns</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                    {Object.keys(visibleColumns).map((col) => {
                      const columnDisplayNames: { [key: string]: string } = {
                        'checkbox': 'Checkbox',
                        'asin': 'ASIN',
                        'productlink': 'Product Link',
                        'productname': 'Product Name',
                        'targetprice': 'Validation Target Price',
                        // 'targetquantity': 'Target Quantity',
                        'admintargetprice': 'Admin Target Price',
                        'funnelquantity': 'Funnel',
                        'funnelseller': 'Seller Tag',
                        'inrpurchaselink': 'INR Purchase Link',
                        'origin': 'Origin',
                        'buyingprice': 'Actual Buying Price',
                        'buyingquantity': 'Buying Quantity',
                        'sellerlink': 'Seller Link',
                        'sellerphno': 'Seller Ph No.',
                        'paymentmethod': 'Payment Method',
                        'address': 'Address',
                        'trackingdetails': 'Tracking Details',
                        'deliverydate': 'Delivery Date',
                        'orderdate': 'Order Date',
                        'moveto': 'Move To',
                        remark: 'Remark',
                      };
                      return (
                        <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-[#111111] p-2 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                            className="w-4 h-4 text-orange-500 rounded border-white/[0.1] bg-[#111111] focus:ring-orange-500/50"
                          />
                          <span className="text-sm text-gray-300">{columnDisplayNames[col] || col}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/[0.1] flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded hover:bg-orange-400 hover:text-white text-xs font-medium transition-colors"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-[#111111] text-gray-400 rounded hover:bg-[#1a1a1a] text-xs font-medium transition-colors border border-white/[0.1]"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* S&S Tab — separate table */}
      {activeTab === 'sns' ? (
        <div className="bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-white/[0.1]">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
            <table className="w-full table-auto">
              <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">ASIN</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Seller Tag</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">S&S Period</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">S&S Qty</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Next Due</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredSns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-300">
                      <span className="text-lg font-semibold text-gray-400">No S&S subscriptions yet</span>
                    </td>
                  </tr>
                ) : filteredSns.map((item: any) => (
                  <tr key={item.id} className="hover:bg-white/[0.05] transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-orange-400">{item.asin}</td>
                    <td className="px-6 py-3 text-sm text-gray-100 truncate max-w-xs">{item.product_name || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-300">{item.brand || '-'}</td>
                    <td className="px-6 py-3 text-sm">
                      {item.seller_tag ? (
                        <div className="flex flex-wrap gap-1">
                          {item.seller_tag.split(',').map((tag: string) => {
                            const clean = tag.trim();
                            return <span key={clean} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${SELLER_STYLES[clean] || 'bg-[#1a1a1a] text-white'}`}>{clean}</span>;
                          })}
                        </div>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {snsEditingId === item.id ? (
                        <select
                          defaultValue={item.sns_period}
                          id={`sns-period-${item.id}`}
                          className="bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1 [color-scheme:dark] cursor-pointer"
                        >
                          {Object.entries(SNS_PERIOD_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 bg-teal-900/50 text-teal-300 text-xs rounded font-medium">{SNS_PERIOD_LABELS[item.sns_period] || item.sns_period}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {snsEditingId === item.id ? (
                        <input type="number" min={1} defaultValue={item.sns_quantity} id={`sns-qty-${item.id}`}
                          className="bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1 w-16" />
                      ) : (
                        <span className="text-white font-medium">{item.sns_quantity}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">
                      {snsEditingId === item.id ? (
                        <input
                          type="date"
                          defaultValue={item.sns_next_due ? new Date(item.sns_next_due).toISOString().split('T')[0] : ''}
                          id={`sns-due-${item.id}`}
                          className="bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1 [color-scheme:dark]"
                        />
                      ) : (
                        item.sns_next_due ? new Date(item.sns_next_due).toLocaleDateString() : '-'
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {snsEditingId === item.id ? (
                          <>
                            <button
                              onClick={() => {
                                const periodEl = document.getElementById(`sns-period-${item.id}`) as HTMLSelectElement;
                                const qtyEl = document.getElementById(`sns-qty-${item.id}`) as HTMLInputElement;
                                const dueEl = document.getElementById(`sns-due-${item.id}`) as HTMLInputElement;
                                handleEditSns(item, periodEl.value, parseInt(qtyEl.value) || 1, dueEl?.value || undefined);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-semibold transition-colors"
                            >Save</button>
                            <button onClick={() => setSnsEditingId(null)}
                              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded font-semibold transition-colors"
                            >Cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setSnsEditingId(item.id)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-semibold transition-colors"
                            >Edit</button>
                            <button onClick={() => handleRemoveSns(item)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-semibold transition-colors"
                            >Remove</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* S&S Footer */}
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 text-sm text-gray-300">
            Showing <span className="font-bold text-white">{filteredSns.length}</span> of <span className="font-bold text-white">{snsData.length}</span> subscriptions
          </div>
        </div>
      ) : activeTab === 'copy' ? (
        <div className="bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-white/[0.1]">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
            <table className="w-full table-auto">
              <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10 shadow-md">
                <tr>
                  <th className="px-6 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCopyIds.size === filteredCopies.length && filteredCopies.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCopyIds(new Set(filteredCopies.map((c: any) => c.id)));
                        else setSelectedCopyIds(new Set());
                      }}
                      className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">ASIN</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Product Link</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Funnel</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Seller Tag</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Remark</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredCopies.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-16 text-center text-gray-300">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <span className="text-lg font-semibold text-gray-400">No copies found</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCopies.map((c: any) => (
                  <tr key={c.id} className="hover:bg-white/[0.05] transition-colors">
                    <td className="px-6 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCopyIds.has(c.id)}
                        onChange={(e) => {
                          const next = new Set(selectedCopyIds);
                          if (e.target.checked) next.add(c.id);
                          else next.delete(c.id);
                          setSelectedCopyIds(next);
                        }}
                        className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3 text-sm font-mono text-orange-400">{c.asin}</td>
                    <td className="px-6 py-3 text-xs text-gray-300">{c.sku || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-100 truncate max-w-xs">{c.product_name || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-300">{c.brand || '-'}</td>
                    <td className="px-6 py-3 text-sm">
                      {c.india_link ? (
                        <a href={c.india_link.startsWith('http') ? c.india_link : `https://${c.india_link}`} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline text-xs font-medium">View</a>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.funnel ? (
                        <span className={`w-8 h-8 inline-flex items-center justify-center rounded-lg font-bold text-xs ${c.funnel === 'RS' ? 'bg-emerald-600 text-white' : c.funnel === 'DP' ? 'bg-amber-500 text-black' : 'bg-slate-600 text-white'}`}>{c.funnel}</span>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.seller_tag ? (
                        <div className="flex flex-wrap gap-1">
                          {c.seller_tag.split(',').map((tag: string) => {
                            const clean = tag.trim();
                            return <span key={clean} className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs ${SELLER_STYLES[clean] || 'bg-[#1a1a1a] text-white'}`}>{clean}</span>;
                          })}
                        </div>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.remark ? (
                        <span className="text-xs text-gray-300 truncate max-w-[100px] block" title={c.remark}>{c.remark}</span>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSendCopyToPurchases(c)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          title="Send to Purchase Main File"
                        >
                          Send
                        </button>
                        <button
                          onClick={() => handleDeleteCopy(c)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Footer */}
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 text-sm text-gray-300">
            Showing <span className="font-bold text-white">{filteredCopies.length}</span> of <span className="font-bold text-white">{copies.length}</span> copies
            {selectedCopyIds.size > 0 && (
              <span className="ml-3 text-orange-500 font-semibold">({selectedCopyIds.size} selected)</span>
            )}
          </div>
        </div>
      ) : (
      /* Table Container */
      <div className="bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-white/[0.1]">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          <table className="w-full table-auto max-w-full">
            <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10 shadow-md">
              <tr>
                {/* Checkbox - always first, NOT draggable */}
                {visibleColumns.checkbox && (
                  <th className="px-6 py-4 text-center bg-[#111111] relative" style={{ width: columnWidths.checkbox }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                    />
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400" onMouseDown={(e) => handleMouseDown('checkbox', e)} />
                  </th>
                )}
                {/* Draggable columns */}
                {columnOrder.map((colkey) => {
                  // Tab-conditional columns
                  if (colkey === 'admintargetprice' && (!visibleColumns.admintargetprice || ['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'trackingdetails' && (!visibleColumns.trackingdetails || ['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'deliverydate' && (!visibleColumns.deliverydate || ['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'orderdate' && (!visibleColumns.orderdate || ['main_file', 'pending', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'address' && (!visibleColumns.address || activeTab !== 'order_confirmed')) return null;
                  if (colkey === 'inrpurchaselink' && activeTab === 'order_confirmed') return null;

                  // visibleColumns check for standard toggle columns
                  const visKey = colkey as keyof typeof visibleColumns;
                  if (visibleColumns[visKey] !== undefined && !visibleColumns[visKey]) return null;

                  // Skip columns not in visibleColumns AND not special (sku, history have no toggle)
                  const specialCols = ['sku', 'history'];
                  if (!specialCols.includes(colkey) && visibleColumns[visKey] === undefined) return null;

                  const labels: Record<string, string> = {
                    asin: 'ASIN', sku: 'SKU', history: 'HISTORY', remark: 'REMARK',
                    productlink: 'PRODUCT LINK', productname: 'PRODUCT NAME',
                    targetprice: 'Buying Price', targetquantity: 'Target Quantity',
                    admintargetprice: 'Admin Target Price',
                    funnelquantity: 'Funnel', funnelseller: 'Seller Tag',
                    inrpurchaselink: 'INR Purchase Link', origin: 'Origin',
                    buyingprice: 'Actual Buying Price', buyingquantity: 'Buying Quantity',
                    sellerlink: 'Seller Link', sellerphno: 'Seller Ph No.',
                    paymentmethod: 'Payment Method', address: 'Address', trackingdetails: 'Tracking Details',
                    deliverydate: 'Delivery Date', orderdate: 'Order Date', moveto: 'MOVE TO',
                  };

                  const emeraldCols = ['targetprice', 'targetquantity', 'trackingdetails', 'deliverydate', 'orderdate'];
                  const purpleCols = ['admintargetprice'];
                  const textColor = emeraldCols.includes(colkey) ? 'text-emerald-400' : purpleCols.includes(colkey) ? 'text-purple-400' : 'text-gray-400';
                  const bgColor = emeraldCols.includes(colkey) ? 'bg-emerald-900/10' : purpleCols.includes(colkey) ? 'bg-purple-900/10' : 'bg-[#111111]';
                  const w = colkey === 'sku' ? 150 : (columnWidths[colkey] ?? 100);

                  return (
                    <Fragment key={colkey}>
                      {/* Inject S&S headers before moveto column */}
                      {colkey === 'moveto' && activeTab === 'order_confirmed' && (
                        <>
                          <th className="px-3 py-3 text-left text-xs font-bold text-teal-400 uppercase tracking-wider">S&S Period</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-teal-400 uppercase tracking-wider">S&S Qty</th>
                        </>
                      )}
                      <th
                        draggable
                        onDragStart={() => handleColumnDragStart(colkey)}
                        onDragOver={(e) => handleColumnDragOver(e, colkey)}
                        onDrop={handleColumnDrop}
                        className={`px-4 py-3 text-left text-xs font-bold ${textColor} uppercase tracking-wider relative group ${bgColor} cursor-grab active:cursor-grabbing select-none`}
                        style={{ minWidth: w, width: w }}
                      >
                        {labels[colkey] || colkey}
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                          onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(colkey, e); }}
                        />
                      </th>
                    </Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.06] overflow-visible">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={99} className="px-4 py-16 text-center text-gray-300">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <span className="text-lg font-semibold text-gray-400">No products available in {activeTab.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={`hover:bg-[#111111]/60 transition-colors border-b border-white/[0.1] group ${activeTab === 'order_confirmed' && product.sns_active ? 'border-l-4 border-l-teal-500 bg-teal-900/10' : ''}`}>
                    {/* Checkbox */}
                    {visibleColumns.checkbox && (
                      <td className="px-6 py-4 text-center" style={{ width: columnWidths.checkbox }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                        />
                      </td>
                    )}
                    {/* Draggable columns - in user-chosen order (S&S cells injected before moveto inside renderPurchaseCell) */}
                    {columnOrder.map((colkey) => renderPurchaseCell(colkey, product))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Footer Stats + Pagination */}
        <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            {/* Left: Showing info */}
            <div className="text-xs sm:text-sm text-gray-300">
              Showing{' '}
              <span className="font-bold text-white">
                {allFilteredProducts.length === 0
                  ? 0 : (currentPage - 1) * rowsPerPage + 1}
              </span>
              –
              <span className="font-bold text-white">
                {Math.min(currentPage * rowsPerPage, allFilteredProducts.length)}
              </span>{' '}
              of <span className="font-bold text-white">
                {allFilteredProducts.length}
              </span> products
              {selectedIds.size > 0 && (
                <span className="ml-2 text-orange-500 font-semibold">
                  ({selectedIds.size} selected)
                </span>
              )}
            </div>

            {/* Right: Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-gray-400 hover:text-white hover:bg-[#111111]">
                  ««
                </button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-gray-400 hover:text-white hover:bg-[#111111]">
                  ‹ Prev
                </button>

                {/* Page Numbers (max 5 visible) */}
                {(() => {
                  const pages: number[] = [];
                  const maxVisible = 5;
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let end = Math.min(totalPages, start + maxVisible - 1);
                  if (end - start + 1 < maxVisible)
                    start = Math.max(1, end - maxVisible + 1);
                  for (let i = start; i <= end; i++) pages.push(i);

                  return (<>
                    {start > 1 && (<>
                      <button onClick={() => setCurrentPage(1)}
                        className="w-8 h-8 text-xs rounded-lg text-gray-400
                  hover:text-white hover:bg-[#111111]">1</button>
                      {start > 2 && <span className="text-gray-300 px-1">…</span>}
                    </>)}
                    {pages.map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg
                  transition-all ${currentPage === page
                            ? 'bg-orange-500 text-white shadow-lg shadow-indigo-900/30'
                            : 'text-gray-400 hover:text-white hover:bg-[#111111]'
                          }`}>{page}</button>
                    ))}
                    {end < totalPages && (<>
                      {end < totalPages - 1 &&
                        <span className="text-gray-300 px-1">…</span>}
                      <button onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 text-xs rounded-lg text-gray-400
                  hover:text-white hover:bg-[#111111]">{totalPages}</button>
                    </>)}
                  </>);
                })()}

                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-gray-400 hover:text-white hover:bg-[#111111]">
                  Next ›
                </button>
                <button onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-gray-400 hover:text-white hover:bg-[#111111]">
                  »»
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
      )}
      {/* ✅ HISTORY SIDEBAR SLIDE-OVER */}
      <AnimatePresence>
        {selectedHistoryAsin && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryAsin(null)}
              className="absolute inset-0 bg-[#111111]/60 z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-[#111111] border-l border-white/[0.1] shadow-2xl z-50 p-4 sm:p-6 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Journey History</h2>
                  <p className="text-sm text-gray-300 font-mono mt-1">{selectedHistoryAsin}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryAsin(null)}
                  className="p-2 hover:bg-[#111111] rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin w-8 h-8 text-orange-500" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No history found for this item.</p>
                  </div>
                ) : (
                  historyData.map((snapshot, idx) => (
                    <div key={snapshot.id} className="relative pl-6 border-l-2 border-orange-500/30 last:border-0 pb-6">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#111111] border-2 border-orange-500" />

                      {/* Card */}
                      <div className="bg-[#1a1a1a]/50 rounded-xl p-4 border border-white/[0.1] hover:border-orange-500/30 transition-colors">
                        {/* Journey Info */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">
                            Journey #{snapshot.journeynumber}
                          </span>
                          <span className="text-xs text-gray-300">
                            {new Date(snapshot.createdat).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>

                        {/* Stage Name */}
                        <h3 className="text-sm font-semibold text-white mb-3 capitalize">
                          {snapshot.stage.replace(/_/g, ' → ')}
                        </h3>

                        {/* Snapshot Details */}
                        <div className="space-y-1.5 text-xs">
                          {snapshot.profit !== null && snapshot.profit !== undefined && (
                            <div className="flex justify-between items-center py-1 border-b border-white/[0.1]">
                              <span className="text-gray-400">Profit:</span>
                              <span className={snapshot.profit > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                ₹{snapshot.profit.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {snapshot.totalcost && (
                            <div className="flex justify-between items-center py-1 border-b border-white/[0.1]">
                              <span className="text-gray-400">Total Cost:</span>
                              <span className="text-gray-100">₹{snapshot.totalcost.toFixed(2)}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.productweight && (
                            <div className="flex justify-between items-center py-1 border-b border-white/[0.1]">
                              <span className="text-gray-400">Weight:</span>
                              <span className="text-gray-100">{snapshot.snapshotdata.productweight}g</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.usdprice && (
                            <div className="flex justify-between items-center py-1 border-b border-white/[0.1]">
                              <span className="text-gray-400">USD Price:</span>
                              <span className="text-gray-100">${snapshot.snapshotdata.usdprice}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.inrpurchase && (
                            <div className="flex justify-between items-center py-1">
                              <span className="text-gray-400">INR Purchase:</span>
                              <span className="text-gray-100">₹{snapshot.snapshotdata.inrpurchase}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
        {selectedRemark && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 p-4"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111111] rounded-2xl shadow-2xl max-w-3xl w-full mx-4 border border-white/[0.1] overflow-hidden pointer-events-auto"
              >
                {/* ========== HEADER ========== */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-850 border-b border-white/[0.1]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Remark Details</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Product validation notes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); }}
                    className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors group"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                  </button>
                </div>

                {/* ========== BODY (Editable Content) ========== */}
                <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
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
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {editingRemarkText.length} characters
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {editingRemarkText.split('\n').length} lines
                      </span>
                    </div>
                  </div>
                </div>

                {/* ========== FOOTER ========== */}
                <div className="px-6 py-4 bg-[#1a1a1a]/50 border-t border-white/[0.1] flex items-center justify-between">
                  <div className="text-xs text-gray-300">
                    Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded text-gray-500">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        (() => { try { navigator.clipboard?.writeText(editingRemarkText); } catch { const t = document.createElement('textarea'); t.value = editingRemarkText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } })();
                      }}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-slate-600 text-gray-100 rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                    {editingRemarkText !== (selectedRemark?.remark || '') && (
                      <button
                        onClick={async () => {
                          if (!selectedRemark) return;
                          await handleCellEdit(selectedRemark.id, 'remark', editingRemarkText.trim() || null);
                          setSelectedRemark(null);
                          setEditingRemarkText('');
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); }}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-orange-500/10"
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

      {/* Split Order Modal */}
      {splitModalProduct && (() => {
        const isSingleTagSplit = !(splitModalProduct.seller_tag || '').includes(',');
        const baseTag = (splitModalProduct.seller_tag || 'GR').split(',')[0].trim();
        const buyingQty = (splitModalProduct.buying_quantities || {}) as Record<string, number>;
        const totalOriginal = isSingleTagSplit
          ? (buyingQty[baseTag] || 0)
          : Object.values(buyingQty).reduce((a, b) => a + (b || 0), 0);
        const totalSplit = Object.values(splitQuantities).reduce((a, b) => a + (b || 0), 0);
        const remaining = totalOriginal - totalSplit;

        return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSplitModalProduct(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[460px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="mb-5">
              <h3 className="text-white text-lg font-semibold">Split Order</h3>
              <p className="text-gray-400 text-sm mt-1">{splitModalProduct.asin} — {splitModalProduct.product_name}</p>
            </div>

            <div className="flex gap-3 mb-5">
              <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">Total quantity</p>
                <p className="text-white text-xl font-semibold">{totalOriginal}</p>
              </div>
              <div className="flex-1 bg-gray-800 rounded-xl p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">Allocated</p>
                <p className="text-teal-400 text-xl font-semibold">{totalSplit}</p>
              </div>
              <div className={`flex-1 rounded-xl p-3 text-center ${remaining === 0 ? 'bg-green-900/30' : remaining < 0 ? 'bg-red-900/30' : 'bg-gray-800'}`}>
                <p className="text-gray-400 text-xs mb-1">Remaining</p>
                <p className={`text-xl font-semibold ${remaining === 0 ? 'text-green-400' : remaining < 0 ? 'text-red-400' : 'text-amber-400'}`}>{remaining}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {Object.entries(splitQuantities).map(([key, qty], index) => (
                <div key={key} className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-3">
                  <span className="text-white text-sm font-medium w-16">
                    {isSingleTagSplit ? `Split ${index + 1}` : key}
                  </span>
                  <div className="flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={qty === 0 && document.activeElement?.getAttribute('data-split-key') === key ? '' : qty.toString()}
                      onFocus={(e) => {
                        e.target.setAttribute('data-split-key', key);
                        if (qty === 0) e.target.value = '';
                      }}
                      onBlur={(e) => {
                        e.target.removeAttribute('data-split-key');
                        if (e.target.value === '') {
                          setSplitQuantities(prev => ({ ...prev, [key]: 0 }));
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSplitQuantities(prev => ({ ...prev, [key]: val === '' ? 0 : parseInt(val, 10) }));
                      }}
                      className="w-full bg-gray-700 text-white border border-gray-600 focus:border-teal-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-center"
                    />
                  </div>
                  {isSingleTagSplit && Object.keys(splitQuantities).length > 2 && (
                    <button
                      onClick={() => setSplitQuantities(prev => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-1 hover:bg-red-900/20 rounded transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isSingleTagSplit && (
              <button
                onClick={() => {
                  const tag = baseTag;
                  const nextIndex = Object.keys(splitQuantities).length + 1;
                  setSplitQuantities(prev => ({ ...prev, [`${tag}_${nextIndex}`]: 0 }));
                }}
                className="w-full py-2 mb-5 border border-dashed border-gray-600 hover:border-teal-500 rounded-lg text-sm text-gray-400 hover:text-teal-400 transition-colors"
              >
                + Add another split
              </button>
            )}

            {remaining < 0 && (
              <p className="text-red-400 text-xs mb-4 text-center">Split quantities exceed total by {Math.abs(remaining)}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSplitModalProduct(null)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >Cancel</button>
              <button
                onClick={() => handleSplitOrder(splitModalProduct, splitQuantities)}
                disabled={totalSplit === 0 || remaining < 0}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  totalSplit > 0 && remaining >= 0
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >Confirm Split</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Copy Seller Tag Selection Modal */}
      {copySellerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setCopySellerModal(null)}>
          <div className="bg-[#111111] border border-white/[0.1] rounded-2xl p-6 w-[400px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white text-lg font-semibold mb-2">Select Seller Tag</h3>
            <p className="text-gray-400 text-sm mb-4">ASIN {copySellerModal.copy.asin} has multiple seller tags. Choose which one to send to purchases.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              {copySellerModal.tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleSendCopyToPurchases(copySellerModal.copy, tag)}
                  className={`px-4 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 border ${SELLER_STYLES[tag] || 'bg-[#1a1a1a] text-white border-white/[0.1]'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setCopySellerModal(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium flex items-center gap-2 min-w-[280px] ${toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-red-900/90 border-red-500/40 text-red-100'
                  : 'bg-[#1a1a1a] border-white/[0.1]/40 text-white'
                }`}
            >
              <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
