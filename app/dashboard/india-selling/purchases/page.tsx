'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useRef } from 'react';
import { History, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx';

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


type TabType = 'main_file' | 'price_wait' | 'order_confirmed' | 'china' | 'india' | 'us' | 'pending' | 'not_found' | 'reject';

const FUNNEL_STYLES: Record<string, string> = {
  'RS': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  'DP': 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30',
  'HD': 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30',
  'LD': 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg border border-blue-600/30',
};

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('main_file');
  const [products, setProducts] = useState<PassFileProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [movementHistory, setMovementHistory] = useState<Record<string, {
    product: PassFileProduct
    fromStatus: string | null
    toStatus: string
  } | null>>({})
  const [showAllJourneys, setShowAllJourneys] = useState(false);

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Remark Modal State
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
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
    'paymentmethod', 'trackingdetails', 'deliverydate', 'orderdate', 'moveto',
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
          <td key={colkey} className="px-3 py-2 font-mono text-sm text-slate-300" style={{ width: columnWidths.asin }}>
            <div className="truncate">{product.asin}</div>
          </td>
        );

      case 'sku':
        return (
          <td key={colkey} className="px-3 py-3 text-sm overflow-hidden" style={{ maxWidth: 150, width: 150 }}>
            <div className="w-full overflow-hidden">
              {editingSkuId === product.id ? (
                <div className="flex items-center gap-1 max-w-full">
                  <input
                    type="text"
                    value={editingSkuValue}
                    onChange={(e) => setEditingSkuValue(e.target.value)}
                    className="min-w-0 flex-1 px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-xs text-white focus:ring-1 focus:ring-indigo-500"
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
                  <span className="text-slate-200 text-xs break-all leading-tight" title={product.sku}>{product.sku}</span>
                  <button onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(product.sku!); }} className="text-slate-500 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit SKU">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(''); }} className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  + Add SKU
                </button>
              )}
            </div>
          </td>
        );

      case 'history':
        return (
          <td key={colkey} className="px-3 py-2 text-center" style={{ width: columnWidths.history }}>
            <button onClick={() => fetchHistory(product.asin)} className="p-2 rounded-full hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-colors" title="View Journey History">
              <History className="w-4 h-4" />
            </button>
          </td>
        );

      case 'remark':
        if (!visibleColumns.remark) return null;
        return (
          <td key={colkey} className="px-3 py-2 text-center" style={{ width: columnWidths.remark }}>
            {product.remark ? (
              <button onClick={() => setSelectedRemark(product.remark)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">View</button>
            ) : <span className="text-slate-600">-</span>}
          </td>
        );

      case 'productlink':
        if (!visibleColumns.productlink) return null;
        return (
          <td key={colkey} className="px-3 py-2 text-center overflow-hidden" style={{ width: columnWidths.productlink }}>
            {(product.india_link || product.product_link) ? (
              <a href={ensureURL(product.india_link || product.product_link)} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline text-xs font-medium">View</a>
            ) : <span className="text-xs text-slate-600">-</span>}
          </td>
        );

      case 'productname':
        if (!visibleColumns.productname) return null;
        return (
          <td key={colkey} className="px-3 py-2 text-sm text-slate-200 overflow-hidden" style={{ width: columnWidths.productname }}>
            <div className="truncate" title={product.product_name || '-'}>{product.product_name || '-'}</div>
          </td>
        );

      case 'targetprice':
        if (!visibleColumns.targetprice) return null;
        return (
          <td key={colkey} className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.targetprice }}>
            {(activeTab === 'main_file' || activeTab === 'order_confirmed') ? (
              <div className="px-2 py-1 text-sm font-medium text-emerald-300">
                {product.usd_price ? (product.usd_price * dollarRate).toFixed(2) : '-'}
              </div>
            ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
          </td>
        );

      // case 'targetquantity':
      //   if (!visibleColumns.target_quantity) return null;
      //   return (
      //     <td key={colkey} className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.targetquantity }}>
      //       {(activeTab === 'main_file' || activeTab === 'order_confirmed') ? (
      //         <div className="px-2 py-1 text-sm font-medium text-emerald-300">{product.target_quantity ?? '-'}</div>
      //       ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
      //     </td>
      //   );

      case 'admintargetprice':
        if (!visibleColumns.admintargetprice) return null;
        if (['mainfile', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-3 py-2 bg-purple-900/10 overflow-hidden" style={{ width: columnWidths.admintargetprice }}>
            {activeTab === 'order_confirmed' ? (
              <div className="px-2 py-1 text-sm font-medium text-purple-300">{product.admin_target_price ?? '-'}</div>
            ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
          </td>
        );

      case 'funnelquantity':
        if (!visibleColumns.funnelquantity) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden relative" style={{ width: columnWidths.funnelquantity }}>
            {product.validation_funnel ? (
              <button
                onClick={(e) => {
                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                  setDropdownPos({ top: rect.bottom + 4, left: rect.left });
                  setOpenFunnelId(openFunnelId === product.id ? null : product.id);
                }}
                className={`w-8 h-8 inline-flex items-center justify-center rounded-lg font-bold text-xs cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all ${FUNNEL_STYLES[product.validation_funnel.trim()] ?? 'bg-slate-600 text-white'}`}
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
                className="text-xs text-slate-500 hover:text-indigo-400 cursor-pointer"
                title="Click to set funnel"
              >-</button>
            )}
            {openFunnelId === product.id && dropdownPos && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { setOpenFunnelId(null); setDropdownPos(null); }} />
                <div
                  className="fixed z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 min-w-[100px] animate-in fade-in zoom-in-95 duration-150"
                  style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                  <p className="text-[10px] text-slate-500 px-2 py-1 font-semibold uppercase tracking-wider">Change Funnel</p>
                  {['RS', 'DP'].map((f) => (
                    <button
                      key={f}
                      onClick={() => handleFunnelChange(product.id, f)}
                      className={`w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2 ${product.validation_funnel === f ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-200 hover:bg-slate-800'}`}
                    >
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-md font-bold text-xs ${FUNNEL_STYLES[f] ?? 'bg-slate-600 text-white'}`}>{f}</span>
                      <span>{f === 'RS' ? 'Restock' : 'Dropshipping'}</span>
                      {product.validation_funnel === f && (
                        <svg className="w-4 h-4 ml-auto text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.funnelseller }}>
            {product.validation_seller_tag ? (
              <div className="flex flex-wrap items-center gap-0.5">
                {product.validation_seller_tag.split(',').map((tag: string) => {
                  const cleanTag = tag.trim();
                  let badgeColor = 'bg-slate-700 text-white';
                  if (cleanTag === 'GR') badgeColor = 'bg-yellow-500 text-black border border-yellow-600';
                  else if (cleanTag === 'RR') badgeColor = 'bg-slate-500 text-white border border-slate-600';
                  else if (cleanTag === 'UB') badgeColor = 'bg-pink-500 text-white border border-pink-600';
                  else if (cleanTag === 'VV') badgeColor = 'bg-purple-500 text-white border border-purple-600';
                  return <span key={cleanTag} className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold ${badgeColor}`}>{cleanTag}</span>;
                })}
              </div>
            ) : <span className="text-xs text-slate-600">-</span>}
          </td>
        );

      case 'inrpurchaselink':
        if (!visibleColumns.inrpurchaselink) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.inrpurchaselink }}>
            {product.inr_purchase_link ? (
              <a href={ensureURL(product.inr_purchase_link)} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline text-xs truncate block">View</a>
            ) : <span className="text-xs text-slate-600">-</span>}
          </td>
        );

      case 'origin':
        if (!visibleColumns.origin) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.origin }}>
            <div className="flex flex-wrap gap-0.5">
              {product.origin_india && <span className="px-1.5 py-0.5 bg-orange-500 text-white border border-orange-600 rounded text-[10px] font-medium leading-none">IN</span>}
              {product.origin_china && <span className="px-1.5 py-0.5 bg-rose-500 text-white border border-rose-600 rounded text-[10px] font-medium leading-none">CN</span>}
              {product.origin_us && <span className="px-1.5 py-0.5 bg-sky-500 text-white border border-sky-600 rounded text-[10px] font-medium leading-none">US</span>}
              {!product.origin_india && !product.origin_china && !product.origin_us && <span className="text-xs text-slate-600">-</span>}
            </div>
          </td>
        );

      case 'buyingprice':
        if (!visibleColumns.buyingprice) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.buyingprice }}>
            <input
              type="number"
              defaultValue={product.buying_price ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'buyingprice', parseFloat(e.target.value))}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Price"
            />
          </td>
        );

      case 'buyingquantity':
        if (!visibleColumns.buyingquantity) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.buyingquantity }}>
            <input
              type="number"
              defaultValue={product.buying_quantity ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'buyingquantity', parseInt(e.target.value))}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Qty"
            />
          </td>
        );

      case 'sellerlink':
        if (!visibleColumns.sellerlink) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.sellerlink }}>
            <input
              type="text"
              defaultValue={product.seller_link ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'sellerlink', e.target.value)}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Link"
            />
          </td>
        );

      case 'sellerphno':
        if (!visibleColumns.sellerphno) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.sellerphno }}>
            <input
              type="text"
              defaultValue={product.seller_phone ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'sellerphone', e.target.value)}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Phone"
            />
          </td>
        );

      case 'paymentmethod':
        if (!visibleColumns.paymentmethod) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.paymentmethod }}>
            <input
              type="text"
              defaultValue={product.payment_method ?? ''}
              onBlur={(e) => handleCellEdit(product.id, 'paymentmethod', e.target.value)}
              className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Method"
            />
          </td>
        );

      case 'trackingdetails':
        if (!visibleColumns.trackingdetails) return null;
        if (['mainfile', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.trackingdetails }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="text"
                defaultValue={product.tracking_details ?? ''}
                onBlur={(e) => handleCellEdit(product.id, 'trackingdetails', e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Tracking"
              />
            ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
          </td>
        );

      case 'deliverydate':
        if (!visibleColumns.deliverydate) return null;
        if (['mainfile', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.deliverydate }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="date"
                defaultValue={product.delivery_date ?? ''}
                onBlur={(e) => handleCellEdit(product.id, 'deliverydate', e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
          </td>
        );

      case 'orderdate':
        if (!visibleColumns.orderdate) return null;
        if (['mainfile', 'india', 'china', 'us'].includes(activeTab)) return null;
        return (
          <td key={colkey} className="px-3 py-2 bg-emerald-900/10 overflow-hidden" style={{ width: columnWidths.orderdate }}>
            {activeTab === 'order_confirmed' ? (
              <input
                type="date"
                defaultValue={product.order_date ?? ''}
                onBlur={(e) => handleCellEdit(product.id, 'orderdate', e.target.value)}
                className="w-full px-2 py-1 bg-slate-950 border border-emerald-500/50 rounded text-xs text-emerald-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            ) : <span className="text-xs text-slate-500 italic">After confirmation</span>}
          </td>
        );

      case 'moveto':
        if (!visibleColumns.moveto) return null;
        return (
          <td key={colkey} className="px-3 py-2 overflow-hidden" style={{ width: columnWidths.moveto }}>
            <div className="flex gap-1 justify-center">
              <button
                type="button"
                onClick={() => { if (activeTab === 'order_confirmed') handleMoveToTracking(product); else handleSendToAdmin(product); }}
                className="w-8 h-8 bg-blue-600 text-white text-xs font-bold rounded flex items-center justify-center flex-shrink-0"
                title="Done"
              >D</button>
              <button
                type="button"
                onClick={() => handlePriceWait(product)}
                className="w-8 h-8 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500 hover:text-black flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold"
                title="Price Wait"
              >PW</button>
              <button
                type="button"
                onClick={() => handleNotFound(product)}
                className="w-8 h-8 bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500 hover:text-white flex items-center justify-center flex-shrink-0 transition-colors text-xs font-bold"
                title="Not Found"
              >NF</button>
            </div>
          </td>
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

      // 3. Fetch ALL validation data in ONE query (Batch 2)
      // This replaces the loop that was causing the lag
      const { data: validationDataArray, error: valError } = await supabase
        .from('india_validation_main_file')
        .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase, profit, total_cost, total_revenue, sku')
        .in('asin', allAsins)

      if (valError) console.error('Validation fetch error:', valError)

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
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        enrichedData.forEach((product: any) => {
          const existing = latestByAsin.get(product.asin);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByAsin.set(product.asin, product);
          }
        });
        processedData = Array.from(latestByAsin.values());
      }

      setProducts(processedData);
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ Silent refresh - updates data WITHOUT loading screen (OPTIMIZED)
  const refreshProductsSilently = async () => {
    try {
      // Fetch purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('india_purchases')
        .select('*')
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      // Fetch ALL validation data in ONE query (much faster)
      const allAsins = purchasesData.map((p: any) => p.asin)
      const { data: validationDataArray } = await supabase
        .from('india_validation_main_file')
        .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku')
        .in('asin', allAsins)

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
          total_cost: validationData?.total_cost ?? null,        // <--- Added
          total_revenue: validationData?.total_revenue ?? null,
        }
      })

      // 🆕 FILTER: Show only latest journey per ASIN (unless toggle is ON)
      let processedData = enrichedData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        enrichedData.forEach((product: any) => {
          const existing = latestByAsin.get(product.asin);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByAsin.set(product.asin, product);
          }
        });
        processedData = Array.from(latestByAsin.values());
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
        if (selectedRemark) setSelectedRemark(null);
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
    funnelseller: 55,
    inrpurchaselink: 55,
    origin: 60,
    buyingprice: 75,
    buyingquantity: 80,
    sellerlink: 75,
    sellerphno: 85,
    paymentmethod: 85,
    trackingdetails: 100,
    deliverydate: 100,
    orderdate: 100,
    moveto: 120,
  });

  const [resizing, setResizing] = useState<{ column: string, startX: number, startWidth: number } | null>(null);

  // Handle sending to admin validation
  const handleSendToAdmin = async (product: PassFileProduct) => {
    try {
      // SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.move_to,
          toStatus: 'sent_to_admin',
        },
      }))

      // 🆕 Fetch profit matching BOTH asin AND journey_id
      let validationData = null;

      if (product.journey_id) {
        // Try to match by journey_id first (most accurate)
        const { data } = await supabase
          .from('india_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price,remark')
          .eq('asin', product.asin)
          .eq('current_journey_id', product.journey_id)
          .maybeSingle();
        validationData = data;
      }

      // Fallback: If no journey match, get latest by asin
      if (!validationData) {
        const { data } = await supabase
          .from('india_validation_main_file')
          .select('profit, total_cost, total_revenue, inr_purchase, product_weight, usd_price,remark')
          .eq('asin', product.asin)
          .order('journey_number', { ascending: false })
          .limit(1)
          .maybeSingle();
        validationData = data;
      }

      // Build origin text based on checkboxes for trigger
      const originParts = []
      if (product.origin_india) originParts.push('India')
      if (product.origin_china) originParts.push('China')
      if (product.origin_us) originParts.push('US');

      const originText = originParts.length > 0 ? originParts.join(', ') : 'India'

      // Insert into admin validation - ONLY fields that exist in schema
      const { error: insertError } = await supabase
        .from('india_admin_validation')
        .insert({
          // Core product info
          asin: product.asin,
          product_name: product.product_name,
          product_link: product.india_link || product.product_link,

          // Target pricing from validation
          target_price: validationData?.inr_purchase || null,
          // target_quantity: 1,
          target_price_validation: validationData?.inr_purchase || null,
          target_price_link_validation: product.inr_purchase_link || null,

          // Funnel & Seller
          funnel: product.validation_funnel ? Number(product.validation_funnel) : null,
          seller_tag: product.validation_seller_tag || null,

          // Buying info (manual entry fields - set to null initially)
          buying_price: null,
          buying_quantity: null,
          seller_link: null,
          seller_phone: '',
          payment_method: '',

          // Origin fields
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          origin_us: product.origin_us ?? false,
          origin: originText,  // Text field for trigger

          // INR Purchase Link
          inr_purchase_link: product.inr_purchase_link || null,

          // Calculation fields from validation
          profit: validationData?.profit || 0,
          total_cost: validationData?.total_cost || 0,
          total_revenue: validationData?.total_revenue || 0,
          product_weight: validationData?.product_weight ?? null,
          usd_price: validationData?.usd_price ?? null,
          inr_purchase: validationData?.inr_purchase ?? null,
          remark: validationData?.remark ?? null,
          sku: product.sku || null,

          // Admin fields
          admin_status: 'pending',
          admin_target_price: null,  // Admin will fill this
          admin_target_quantity: null,  // Admin will fill this

          // Status
          status: 'pending',
        })

      if (insertError) throw insertError

      // Update india_purchases
      const { error: updateError } = await supabase
        .from('india_purchases')
        .update({
          sent_to_admin: true,
          sent_to_admin_at: new Date().toISOString(),
        })
        .eq('id', product.id)

      if (updateError) throw updateError

      alert('Sent to Admin Validation successfully!')
      // Optimistic: immediately hide from all tabs
      setProducts(prev => prev.map(p =>
        p.id === product.id ? { ...p, sent_to_admin: true, sent_to_admin_at: new Date().toISOString() } : p
      ));
      await refreshProductsSilently()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

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
      alert('Failed to load history')
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
        [activeTab]: {
          product,
          fromStatus: product.move_to,
          toStatus: 'price_wait',
        },
      }))

      const { error } = await supabase
        .from('india_purchases')  // ✅ Underscore
        .update({ move_to: 'pricewait' })  // ✅ Underscore
        .eq('id', product.id)

      if (error) throw error

      alert('Moved to Price Wait successfully!')
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // Handle Not Found
  const handleNotFound = async (product: PassFileProduct) => {
    try {
      // ✅ SAVE TO HISTORY FIRST!
      // ✅ SAVE TO CURRENT TAB HISTORY
      setMovementHistory(prev => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.move_to ?? null,
          toStatus: 'not_found',
        },
      }))

      const { error } = await supabase
        .from('india_purchases')  // ✅ Underscore
        .update({ move_to: 'notfound' })  // ✅ Underscore
        .eq('id', product.id)

      if (error) throw error

      alert('Marked as Not Found successfully!')
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  // Roll Back last movement
  const handleRollBack = async () => {
    const lastMovement = movementHistory[activeTab]

    if (!lastMovement) {
      alert('No recent movement to roll back from this tab')
      return
    }

    // ✅ REMOVED setLoading(true) - no loading screen
    try {
      const { product, fromStatus, toStatus } = lastMovement
      const updateData: any = {}

      if (toStatus === 'sent_to_admin') {
        updateData['sent_to_admin'] = false
        updateData['sent_to_admin_at'] = null

        const { error: deleteError } = await supabase
          .from('india_admin_validation')
          .delete()
          .eq('asin', product.asin)

        if (deleteError) {
          console.error('Error deleting from admin validation:', deleteError)
        }
      } else if (toStatus === 'price_wait' || toStatus === 'not_found') {
        updateData['move_to'] = fromStatus
      }

      const { error: updateError } = await supabase
        .from('india_purchases')
        .update(updateData)
        .eq('asin', product.asin)

      if (updateError) throw updateError

      // ✅ Clear history
      setMovementHistory(prev => {
        const newHistory = { ...prev }
        delete newHistory[activeTab]
        return newHistory
      })

      alert(`Rolled back ${product.product_name}`)
      await refreshProductsSilently() // ✅ Updates without loading screen
    } catch (error) {
      console.error('Error rolling back:', error)
      alert('Rollback failed')
    }
    // ✅ NO finally block - no setLoading(false)
  }
  const handleMoveToTracking = async (product: PassFileProduct) => {
    if (!product.admin_confirmed) {
      alert('Only Order Confirmed items can be moved');
      return;
    }

    try {
      console.log('🚀 Moving to tracking:', product.asin);

      // STEP 1: FETCH FRESH DATA (Returns snake_case column names from database)
      const { data: freshProduct, error: fetchError } = await supabase
        .from('india_purchases')
        .select('*')
        .eq('id', product.id)
        .single();

      if (fetchError || !freshProduct) {
        throw new Error('Could not fetch latest data. Please refresh and try again.');
      }

      console.log('📦 Fresh data fetched:', freshProduct);

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

      console.log('🏷️ Seller tags to process:', sellerTags);

      // Map seller tag to seller ID
      const sellerTagMapping: Record<string, number> = {
        'GR': 1, // Golden Aura
        'RR': 2, // Rudra Retail
        'UB': 3, // UBeauty
        'VV': 4, // Velvet Vista
        'DE': 5, // Dropy Ecom ✅ NEW
        'CV': 6  // Costech Ventures ✅ NEW
      };

      // STEP 3: INSERT into MULTIPLE tracking tables (one per unique seller tag)
      const insertPromises = sellerTags.map(async (tag) => {
        const sellerId = sellerTagMapping[tag] || 1;
        const trackingTableName = `india_tracking_seller_${sellerId}`;

        console.log(`📊 Inserting into: ${trackingTableName} (Seller: ${tag})`);

        // ✅ ALL column names use snake_case to match database schema
        return supabase
          .from(trackingTableName)
          .insert({
            // 1. CORE IDENTITY
            asin: freshProduct.asin,
            journey_id: freshProduct.journey_id,           // ✅ Fixed
            journey_number: freshProduct.journey_number || 1, // ✅ Fixed

            // 2. PRODUCT INFORMATION
            product_link: freshProduct.product_link,       // ✅ Fixed
            product_name: freshProduct.product_name,       // ✅ Fixed
            brand: freshProduct.brand,

            // 3. PRICING FIELDS
            target_price: freshProduct.target_price,       // ✅ Fixed
            // target_quantity: freshProduct.target_quantity || 1, // ✅ Fixed
            admin_target_price: freshProduct.admin_target_price, // ✅ Fixed
            admin_target_quantity: freshProduct.admin_target_quantity, // ✅ Fixed
            target_price_validation: freshProduct.target_price_validation, // ✅ Fixed
            target_price_link_validation: freshProduct.target_price_link_validation, // ✅ Fixed

            // 4. FUNNEL & SELLER
            funnel: freshProduct.funnel,
            seller_tag: tag, // specific tag for this insert
            funnel_quantity: freshProduct.funnel_quantity || 1, // ✅ Fixed
            funnel_seller: freshProduct.funnel_seller,     // ✅ Fixed

            // 5. PURCHASE LINKS
            inr_purchase_link: freshProduct.inr_purchase_link, // ✅ Fixed

            // 6. ORIGIN
            origin: freshProduct.origin,
            origin_india: freshProduct.origin_india ?? false, // ✅ Fixed
            origin_china: freshProduct.origin_china ?? false, // ✅ Fixed
            origin_us: freshProduct.origin_us ?? false,

            // 7. BUYING DETAILS (USER EDITABLE)
            buying_price: freshProduct.buying_price,       // ✅ Fixed
            buying_quantity: freshProduct.buying_quantity, // ✅ Fixed
            seller_link: freshProduct.seller_link,         // ✅ Fixed
            seller_phone: freshProduct.seller_phone,       // ✅ Fixed
            payment_method: freshProduct.payment_method,   // ✅ Fixed

            // 8. TRACKING & DELIVERY (USER EDITABLE)
            tracking_details: freshProduct.tracking_details, // ✅ Fixed
            delivery_date: freshProduct.delivery_date,     // ✅ Fixed
            order_date: freshProduct.order_date,
            remark: freshProduct.remark,

            // 9. FINANCIAL DATA
            profit: freshProduct.profit,
            product_weight: freshProduct.product_weight,   // ✅ Fixed
            usd_price: freshProduct.usd_price,             // ✅ Fixed
            inr_purchase: freshProduct.inr_purchase,      // ✅ Fixed
            sku: freshProduct.sku || null,

            // 10. STATUS FIELDS
            admin_status: 'confirmed',                     // ✅ Fixed
            status: 'tracking',
            moved_at: new Date().toISOString(),            // ✅ Fixed
          });
      });

      // Wait for all insertions to complete
      const results = await Promise.all(insertPromises);

      // Check for errors
      const errors = results.filter((result) => result.error);
      if (errors.length > 0) {
        console.error('❌ Insert errors:', errors);
        errors.forEach((err, index) => {
          console.error(`Error ${index + 1}:`, {
            code: err.error?.code,
            message: err.error?.message,
            details: err.error?.details,
            hint: err.error?.hint,
          });
        });
        throw new Error(`Failed to insert into ${errors.length} table(s)`);
      }

      console.log(`✅ Successfully inserted into ${sellerTags.length} tracking tables: ${sellerTags.join(', ')}`);

      // STEP 4: DELETE from purchases (only after ALL inserts succeed)
      const { error: deleteError } = await supabase
        .from('india_purchases')
        .delete()
        .eq('id', product.id);

      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
        throw deleteError;
      }

      console.log('✅ Delete successful');
      alert(`✅ Moved to ${sellerTags.length} tracking table(s): ${sellerTags.join(', ')}`);
      await refreshProductsSilently();
    } catch (error: any) {
      console.error('❌ Move error:', error);
      alert(`Failed to move: ${error.message}`);
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
      if (!p.validation_seller_tag?.toUpperCase().includes(sellerTagFilter)) return false;
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
    // Map internal field names → actual DB column names (snake_case)
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
    };
    const dbField = fieldMap[field] || field;

    try {
      const { error } = await supabase
        .from('india_purchases')
        .update({ [dbField]: value })
        .eq('id', id);
      if (error) throw error;
      await refreshProductsSilently();
    } catch (error: any) {
      alert(`Error updating: ${error.message}`);
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

      alert(`Funnel changed to ${newFunnel}`);
    } catch (error: any) {
      // Rollback on failure
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, validation_funnel: oldFunnel } : p  // ← FIX 3: was validation_funnel
        )
      );
      alert(`Failed to update funnel: ${error.message}`);
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
      alert('No data to download');
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
      alert('No data to download');
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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 p-6 text-slate-200 font-sans selection:bg-indigo-500/30">

      {/* Header Section */}
      <div className="flex-none mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Purchases</h1>
            <p className="text-slate-400 mt-1">Manage purchase orders and track confirmations</p>
          </div>
          <div className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            TOTAL: <span className="text-white font-bold">{products.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs - Midnight Theme Pills */}
      <div className="flex-none flex gap-2 mb-6 flex-wrap p-1.5 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit backdrop-blur-sm overflow-x-auto">
        {/* 1. Main File */}
        <button
          onClick={() => setActiveTab('main_file')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'main_file'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-blue-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Main File ({products.filter(p => !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'main_file' && <div className="absolute inset-0 opacity-10 bg-blue-500" />}
        </button>

        {/* 2. Order Confirmed */}
        <button
          onClick={() => setActiveTab('order_confirmed')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'order_confirmed'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-emerald-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Confirmed ({products.filter(p => p.admin_confirmed === true).length})</span>
          {activeTab === 'order_confirmed' && <div className="absolute inset-0 opacity-10 bg-emerald-500" />}
        </button>

        {/* 3. India */}
        <button
          onClick={() => setActiveTab('india')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'india'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-orange-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">India ({products.filter(p => p.origin_india && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'india' && <div className="absolute inset-0 opacity-10 bg-orange-500" />}
        </button>

        {/* 4. China */}
        <button
          onClick={() => setActiveTab('china')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'china'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-rose-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">China ({products.filter(p => p.origin_china && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'china' && <div className="absolute inset-0 opacity-10 bg-rose-500" />}
        </button>

        {/* 5. US */}
        <button
          onClick={() => setActiveTab('us')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'us'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-sky-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">US ({products.filter(p => p.origin_us && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'us' && <div className="absolute inset-0 opacity-10 bg-sky-500" />}
        </button>

        {/* 6. Pending */}
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'pending'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-purple-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Pending ({products.filter(p => p.status === 'pending' && !p.sent_to_admin && !p.move_to).length})</span>
          {activeTab === 'pending' && <div className="absolute inset-0 opacity-10 bg-purple-500" />}
        </button>

        {/* 7. Price Wait */}
        <button
          onClick={() => setActiveTab('price_wait')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'price_wait'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-amber-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Price Wait ({products.filter(p => p.move_to === 'pricewait').length})</span>
          {activeTab === 'price_wait' && <div className="absolute inset-0 opacity-10 bg-amber-500" />}
        </button>

        {/* 8. Not Found */}
        <button
          onClick={() => setActiveTab('not_found')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === 'not_found'
            ? 'text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 text-slate-400'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
            }`}
        >
          <span className="relative z-10">Not Found ({products.filter(p => p.move_to === 'notfound').length})</span>
          {activeTab === 'not_found' && <div className="absolute inset-0 opacity-10 bg-slate-500" />}
        </button>
      </div>

      {/* Search & Controls */}
      <div className="flex-none mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-md group">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by ASIN, Product Name, SKU, or Funnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-200 placeholder-slate-600 transition-all shadow-sm text-sm"
          />
        </div>

        {/* Buttons Group */}
        <div className="flex items-center gap-3">
          {/* Funnel Quick Filters */}
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setFunnelFilter(funnelFilter === 'RS' ? 'ALL' : 'RS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'RS'
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              RS
            </button>
            <button
              onClick={() => setFunnelFilter(funnelFilter === 'DP' ? 'ALL' : 'DP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === 'DP'
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              DP
            </button>
          </div>

          {/* Seller Tag Filter */}
          <div className="flex items-center gap-1 bg-slate-900/50 rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setSellerTagFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sellerTagFilter === 'ALL'
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
            >
              All
            </button>
            {['GR', 'RR', 'UB', 'VV', 'DE', 'CV'].map((tag) => {
              const tagColors: Record<string, string> = {
                GR: 'from-yellow-400 to-yellow-600 text-black',
                RR: 'from-slate-400 to-slate-600 text-white',
                UB: 'from-pink-400 to-pink-600 text-white',
                VV: 'from-purple-400 to-purple-600 text-white',
                DE: 'from-cyan-400 to-cyan-600 text-black',
                CV: 'from-teal-400 to-teal-600 text-white',
              };
              return (
                <button
                  key={tag}
                  onClick={() => setSellerTagFilter(sellerTagFilter === tag ? 'ALL' : tag)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sellerTagFilter === tag
                    ? `bg-gradient-to-br ${tagColors[tag]} shadow-lg`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDownloadDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDownloadDropdownOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-20 w-64 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs text-slate-500 px-3 py-1.5 font-semibold uppercase tracking-wider">CSV</p>

                  {/* Download Selected */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => downloadCSV('selected')}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Download Selected</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                    </button>
                  )}

                  {/* Download Page */}
                  <button
                    onClick={() => downloadCSV('page')}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download Page</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                  </button>

                  {/* Download All */}
                  <button
                    onClick={() => downloadCSV('all')}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download All</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{products.length}</span>
                  </button>

                  <div className="border-t border-slate-700 my-1.5" />
                  <p className="text-xs text-slate-500 px-3 py-1.5 font-semibold uppercase tracking-wider">Excel</p>

                  {/* Excel Selected */}
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => downloadExcel('selected')}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <span>Download Selected</span>
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                    </button>
                  )}

                  {/* Excel Page */}
                  <button
                    onClick={() => downloadExcel('page')}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-blue-600/20 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download Page</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredProducts.length}</span>
                  </button>

                  {/* Excel All */}
                  <button
                    onClick={() => downloadExcel('all')}
                    className="w-full px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-purple-600/20 hover:text-purple-300 rounded-lg transition-colors flex items-center justify-between"
                  >
                    <span>Download All</span>
                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{products.length}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleRollBack}
            disabled={!movementHistory[activeTab]}
            className="px-4 py-2.5 bg-orange-600 text-white rounded-xl hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-lg shadow-orange-900/20 transition-all border border-orange-500/50"
            title="Roll Back last action from this tab (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Roll Back
          </button>

          {/* 🆕 Journey Toggle Button */}
          <button
            onClick={() => setShowAllJourneys(!showAllJourneys)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border shadow-lg ${showAllJourneys
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500/50 shadow-indigo-900/20'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
              }`}
            title={`Currently showing ${showAllJourneys ? 'ALL journey cycles' : 'latest journey only'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {showAllJourneys ? 'Show Latest Only' : 'Show All Journeys'}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
              className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 hover:text-white border border-slate-700 flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Hide Columns
            </button>

            {isColumnMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsColumnMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-64 animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="font-semibold text-slate-200 mb-3 text-sm">Toggle Columns</h3>
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
                        'trackingdetails': 'Tracking Details',
                        'deliverydate': 'Delivery Date',
                        'orderdate': 'Order Date',
                        'moveto': 'Move To',
                        remark: 'Remark',
                      };
                      return (
                        <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-2 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={visibleColumns[col as keyof typeof visibleColumns]}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, [col]: e.target.checked })}
                            className="w-4 h-4 text-indigo-500 rounded border-slate-600 bg-slate-800 focus:ring-indigo-500/50"
                          />
                          <span className="text-sm text-slate-300">{columnDisplayNames[col] || col}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded hover:bg-indigo-500 hover:text-white text-xs font-medium transition-colors"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'checkbox' || key === 'asin' }), {} as typeof visibleColumns))}
                      className="flex-1 px-3 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 text-xs font-medium transition-colors border border-slate-700"
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

      {/* Table Container */}
      <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-slate-800">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
          <table className="w-full divide-y divide-slate-800 table-fixed" style={{ minWidth: '1600px' }}>
            <thead className="bg-slate-950 sticky top-0 z-10 shadow-md">
              <tr>
                {/* Checkbox - always first, NOT draggable */}
                {visibleColumns.checkbox && (
                  <th className="px-4 py-3 text-center bg-slate-950 relative" style={{ width: columnWidths.checkbox }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                    />
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500" onMouseDown={(e) => handleMouseDown('checkbox', e)} />
                  </th>
                )}
                {/* Draggable columns */}
                {columnOrder.map((colkey) => {
                  // Tab-conditional columns
                  if (colkey === 'admintargetprice' && (!visibleColumns.admintargetprice || ['mainfile', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'trackingdetails' && (!visibleColumns.trackingdetails || ['mainfile', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'deliverydate' && (!visibleColumns.deliverydate || ['mainfile', 'india', 'china', 'us'].includes(activeTab))) return null;
                  if (colkey === 'orderdate' && (!visibleColumns.orderdate || ['mainfile', 'india', 'china', 'us'].includes(activeTab))) return null;

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
                    paymentmethod: 'Payment Method', trackingdetails: 'Tracking Details',
                    deliverydate: 'Delivery Date', orderdate: 'Order Date', moveto: 'MOVE TO',
                  };

                  const emeraldCols = ['targetprice', 'targetquantity', 'trackingdetails', 'deliverydate', 'orderdate'];
                  const purpleCols = ['admintargetprice'];
                  const textColor = emeraldCols.includes(colkey) ? 'text-emerald-400' : purpleCols.includes(colkey) ? 'text-purple-400' : 'text-slate-400';
                  const bgColor = emeraldCols.includes(colkey) ? 'bg-emerald-900/10' : purpleCols.includes(colkey) ? 'bg-purple-900/10' : 'bg-slate-950';
                  const w = colkey === 'sku' ? 150 : (columnWidths[colkey] ?? 100);

                  return (
                    <th
                      key={colkey}
                      draggable
                      onDragStart={() => handleColumnDragStart(colkey)}
                      onDragOver={(e) => handleColumnDragOver(e, colkey)}
                      onDrop={handleColumnDrop}
                      className={`px-3 py-3 text-center text-xs font-bold ${textColor} uppercase relative group ${bgColor} cursor-grab active:cursor-grabbing select-none`}
                      style={{ width: w }}
                    >
                      {labels[colkey] || colkey}
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(colkey, e); }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={99} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <span className="text-lg font-semibold text-slate-400">No products available in {activeTab.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-800/60 transition-colors border-b border-slate-800 group">
                    {/* Checkbox */}
                    {visibleColumns.checkbox && (
                      <td className="px-4 py-2 text-center" style={{ width: columnWidths.checkbox }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                        />
                      </td>
                    )}
                    {/* Draggable columns - in user-chosen order */}
                    {columnOrder.map((colkey) => renderPurchaseCell(colkey, product))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Footer Stats + Pagination */}
        <div className="flex-none border-t border-slate-800 bg-slate-900 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Showing info */}
            <div className="text-sm text-slate-400">
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
                <span className="ml-2 text-indigo-400 font-semibold">
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
            text-slate-400 hover:text-white hover:bg-slate-800">
                  ««
                </button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-slate-400 hover:text-white hover:bg-slate-800">
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
                        className="w-8 h-8 text-xs rounded-lg text-slate-400
                  hover:text-white hover:bg-slate-800">1</button>
                      {start > 2 && <span className="text-slate-600 px-1">…</span>}
                    </>)}
                    {pages.map(page => (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg
                  transition-all ${currentPage === page
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}>{page}</button>
                    ))}
                    {end < totalPages && (<>
                      {end < totalPages - 1 &&
                        <span className="text-slate-600 px-1">…</span>}
                      <button onClick={() => setCurrentPage(totalPages)}
                        className="w-8 h-8 text-xs rounded-lg text-slate-400
                  hover:text-white hover:bg-slate-800">{totalPages}</button>
                    </>)}
                  </>);
                })()}

                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-slate-400 hover:text-white hover:bg-slate-800">
                  Next ›
                </button>
                <button onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg
            transition-all disabled:opacity-30 disabled:cursor-not-allowed
            text-slate-400 hover:text-white hover:bg-slate-800">
                  »»
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-6 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Journey History</h2>
                  <p className="text-sm text-slate-400 font-mono mt-1">{selectedHistoryAsin}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryAsin(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin w-8 h-8 text-indigo-500" />
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center text-slate-500 py-10">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No history found for this item.</p>
                  </div>
                ) : (
                  historyData.map((snapshot, idx) => (
                    <div key={snapshot.id} className="relative pl-6 border-l-2 border-indigo-500/30 last:border-0 pb-6">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500" />

                      {/* Card */}
                      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                        {/* Journey Info */}
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Journey #{snapshot.journeynumber}
                          </span>
                          <span className="text-xs text-slate-500">
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
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Profit:</span>
                              <span className={snapshot.profit > 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                ₹{snapshot.profit.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {snapshot.totalcost && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Total Cost:</span>
                              <span className="text-slate-200">₹{snapshot.totalcost.toFixed(2)}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.productweight && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">Weight:</span>
                              <span className="text-slate-200">{snapshot.snapshotdata.productweight}g</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.usdprice && (
                            <div className="flex justify-between items-center py-1 border-b border-slate-700/50">
                              <span className="text-slate-400">USD Price:</span>
                              <span className="text-slate-200">${snapshot.snapshotdata.usdprice}</span>
                            </div>
                          )}
                          {snapshot.snapshotdata?.inrpurchase && (
                            <div className="flex justify-between items-center py-1">
                              <span className="text-slate-400">INR Purchase:</span>
                              <span className="text-slate-200">₹{snapshot.snapshotdata.inrpurchase}</span>
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
              onClick={() => setSelectedRemark(null)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                className="bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 border border-slate-700 overflow-hidden pointer-events-auto"
              >
                {/* ========== HEADER ========== */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-850 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Remark Details</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Product validation notes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRemark(null)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors group"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </button>
                </div>

                {/* ========== BODY (Scrollable Content) ========== */}
                <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    {/* Remark Label */}
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-700/50">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Validation Remark</span>
                    </div>

                    {/* Remark Content */}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedRemark}
                      </p>
                    </div>

                    {/* Metadata Footer (Optional - shows character count) */}
                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {selectedRemark.length} characters
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        {selectedRemark.split('\n').length} lines
                      </span>
                    </div>
                  </div>

                  {/* Info Box (Optional - can be removed if not needed) */}
                  <div className="mt-4 flex items-start gap-3 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-200">
                      <p className="font-semibold mb-1">About Remarks</p>
                      <p className="text-blue-300/80">This remark was added during the validation process to provide context or flags for this product.</p>
                    </div>
                  </div>
                </div>

                {/* ========== FOOTER (Action Buttons) ========== */}
                <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Press <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRemark);
                        // Optional: Add toast notification here
                      }}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                    <button
                      onClick={() => setSelectedRemark(null)}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20"
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
    </div>
  );
}
