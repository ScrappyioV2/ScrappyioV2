'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useRef } from 'react'
import Toast from '@/components/Toast';
import { History, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'


type AdminProduct = {
  id: string;
  asin: string;
  product_name: string | null;
  product_link: string | null;
  origin_india: boolean | null;
  origin_china: boolean | null;
  origin_us: boolean | null;
  target_price: number | null;
  // target_quantity: number | null;
  buying_price: number | null;
  buying_quantity: number | null;
  funnel: number | string | null;
  seller_tag: string | null;
  seller_link: string | null;
  seller_phone: string | null;
  payment_method: string | null;
  status: string | null;
  admin_status: string | null;
  admin_notes: string | null;
  created_at: string;
  profit?: number | null;
  total_cost?: number | null;
  total_revenue?: number | null;
  product_weight: number | null
  usd_price: number | null
  inr_purchase: number | null
  inr_purchase_link: string | null
  admin_target_price: number | null;
  journey_id?: string | null;
  journey_number?: number | null;
  remark: string | null;
  sku?: string | null;
};

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

type TabType = 'overview' | 'india' | 'china' | 'us' | 'pending' | 'confirm' | 'reject';

type CalculationConstants = {
  dollar_rate: number;
  bank_conversion_rate: number;
  shipping_charge_per_kg: number;
  commission_rate: number;
  packing_cost: number;
}

const getDefaultConstants = (): CalculationConstants => ({
  dollar_rate: 90,
  bank_conversion_rate: 2,
  shipping_charge_per_kg: 950,
  commission_rate: 25,
  packing_cost: 25,
})

// ✅ Seller Mapping Helper
const getSellerNameFromTag = (tag: string | null) => {
  if (!tag) return null;
  switch (tag.toUpperCase()) {
    case "GR": return "Golden Aura";
    case "RR": return "Rudra Retail";
    case "UB": return "Ubeauty";
    case "VV": return "Velvet Vista";
    case "DE": return "Dropy Ecom";      // ✅ ADD THIS
    case "CV": return "Costech Ventures"; // ✅ ADD THIS
    default: return null;
  }
};

export default function AdminValidationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  // Filter states (persisted)
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [originFilter, setOriginFilter] = useState<'ALL' | 'India' | 'China' | 'US'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaAdminOriginFilter') as 'ALL' | 'India' | 'China' | 'US') || 'ALL';
  });

  const [funnelFilter, setFunnelFilter] = useState<'ALL' | 'RS' | 'DP'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaAdminFunnelFilter') as 'ALL' | 'RS' | 'DP') || 'ALL';
  });

  const [remarkFilter, setRemarkFilter] = useState<'ALL' | 'hasRemark' | 'noRemark'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaAdminRemarkFilter') as 'ALL' | 'hasRemark' | 'noRemark') || 'ALL';
  });

  const [adminStatusFilter, setAdminStatusFilter] = useState<'ALL' | 'pending' | 'confirmed' | 'rejected'>(() => {
    if (typeof window === 'undefined') return 'ALL';
    return (localStorage.getItem('indiaAdminStatusFilter') as 'ALL' | 'pending' | 'confirmed' | 'rejected') || 'ALL';
  });

  useEffect(() => {
    localStorage.setItem('indiaAdminOriginFilter', originFilter);
  }, [originFilter]);

  useEffect(() => {
    localStorage.setItem('indiaAdminFunnelFilter', funnelFilter);
  }, [funnelFilter]);

  useEffect(() => {
    localStorage.setItem('indiaAdminStatusFilter', adminStatusFilter);
  }, [adminStatusFilter]);
  useEffect(() => { localStorage.setItem('indiaAdminRemarkFilter', remarkFilter) }, [remarkFilter]);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState<string>('');
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [editingSkuValue, setEditingSkuValue] = useState<string>('');
  const [adminConstants, setAdminConstants] = useState<CalculationConstants>(getDefaultConstants());

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);

  const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false);
  const [isSavingConstants, setIsSavingConstants] = useState(false);
  const [modalInputs, setModalInputs] = useState({
    dollarrate: '',
    bankfee: '',
    shipping: '',
    commission: '',
    packingcost: '',
  });
  const [calculatingIds, setCalculatingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);
  // ✅ CORRECT TYPE: Allow undefined for clearing history
  const [movementHistory, setMovementHistory] = useState<Record<string, {
    product: AdminProduct;
    fromStatus: string | null;
    toStatus: string | null;
  } | undefined>>({});

  // 🆕 NEW: Toggle to show all journey cycles or just latest
  const [showAllJourneys, setShowAllJourneys] = useState(false);

  // Fetch products from india_admin_validation table
  const fetchProducts = async (showLoader: boolean = false) => {
    try {
      if (showLoader) setLoading(true);

      // 1. Fetch base data from indiaadminvalidation
      const { data: adminData, error: adminError } = await supabase
        .from('india_admin_validation')
        .select('*')
        .order('created_at', { ascending: false });

      if (adminError) throw adminError;
      if (!adminData || adminData.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      // 🆕 FILTER: Group by ASIN and keep only latest journey (unless showAll is enabled)
      let processedData = adminData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        adminData.forEach(product => {
          const existing = latestByAsin.get(product.asin);
          const currentJourney = product.journey_number || 1;
          const existingJourney = existing?.journey_number || 1;

          if (!existing || currentJourney > existingJourney) {
            latestByAsin.set(product.asin, product);
          }
        });
        processedData = Array.from(latestByAsin.values());
      }

      // 2️⃣ Get all ASINs
      const asins = adminData.map(p => p.asin)

      // 3️⃣ Batch fetch from BOTH tables
      const [purchaseResult, validationResult] = await Promise.all([
        supabase.from('india_purchases')
          .select('asin, journey_id, journey_number, buying_price, buying_quantity, seller_link, seller_phone, payment_method, target_price, product_weight, usd_price, inr_purchase, funnel, seller_tag')
          .in('asin', asins),

        supabase.from('india_validation_main_file')
          .select('asin, current_journey_id, journey_number, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku')
          .in('asin', asins)
      ]);


      // 4️⃣ Create lookup maps
      const purchaseMap = new Map();
      const purchaseFallbackMap = new Map(); // Fallback for legacy data without journey_id

      purchaseResult.data?.forEach(p => {
        if (p.journey_id) {
          purchaseMap.set(`${p.asin}|${p.journey_id}`, p);
        }
        // Keep latest as fallback
        if (!purchaseFallbackMap.has(p.asin)) {
          purchaseFallbackMap.set(p.asin, p);
        }
      });

      const validationMap = new Map();
      const validationFallbackMap = new Map();

      validationResult.data?.forEach(v => {
        if (v.current_journey_id) {
          validationMap.set(`${v.asin}|${v.current_journey_id}`, v);
        }
        if (!validationFallbackMap.has(v.asin)) {
          validationFallbackMap.set(v.asin, v);
        }
      });

      // 5. Enrich data
      const enrichedData: AdminProduct[] = processedData.map(product => {
        // 🆕 Use composite key for precise matching
        const compositeKey = product.journey_id
          ? `${product.asin}|${product.journey_id}`
          : null;

        const purchase = compositeKey
          ? (purchaseMap.get(compositeKey) || purchaseFallbackMap.get(product.asin))
          : purchaseFallbackMap.get(product.asin);

        const validation = compositeKey
          ? (validationMap.get(compositeKey) || validationFallbackMap.get(product.asin))
          : validationFallbackMap.get(product.asin);

        // ✅ For CONFIRMED products, use their own data (don't override)
        const isConfirmed = product.admin_status === 'confirmed';

        return {
          id: product.id,
          asin: product.asin,
          journey_id: product.journey_id || null,
          journey_number: product.journey_number || 1,

          // ✅ FIXED: Use snake_case to match interface
          product_name: product.product_name,
          product_link: product.product_link,
          origin_india: product.origin_india === true ||
            (typeof product.origin === 'string' && product.origin.includes('India')),
          origin_china: product.origin_china === true ||
            (typeof product.origin === 'string' && product.origin.includes('China')),
          origin_us: product.origin_us === true ||
            (typeof product.origin === 'string' && product.origin.includes('US')),

          // Pricing fields - respect confirmed status
          target_price: isConfirmed
            ? product.target_price
            : (product.target_price ?? purchase?.target_price ?? null),

          // target_quantity: isConfirmed
          //   ? product.target_quantity
          //   : (product.target_quantity ?? purchase?.target_quantity ?? null),

          admin_target_price: product.admin_target_price,

          // FROM PURCHASE TEAM
          buying_price: isConfirmed
            ? product.buying_price
            : (purchase?.buying_price ?? product.buying_price ?? null),

          buying_quantity: isConfirmed
            ? product.buying_quantity
            : (purchase?.buying_quantity ?? product.buying_quantity ?? null),

          seller_link: isConfirmed
            ? product.seller_link
            : (purchase?.seller_link ?? product.seller_link ?? null),

          seller_phone: isConfirmed
            ? product.seller_phone
            : (purchase?.seller_phone ?? product.seller_phone ?? null),

          payment_method: isConfirmed
            ? product.payment_method
            : (purchase?.payment_method ?? product.payment_method ?? null),

          // IDENTITY FIELDS - Always prioritize freshest
          funnel: purchase?.funnel ?? validation?.funnel ?? product.funnel ?? null,
          seller_tag: purchase?.seller_tag ?? validation?.sellertag ?? product.seller_tag ?? null,

          // PRICING FIELDS
          product_weight: isConfirmed
            ? product.product_weight
            : (purchase?.product_weight ?? validation?.productweight ?? product.product_weight ?? null),

          usd_price: isConfirmed
            ? product.usd_price
            : (purchase?.usd_price ?? validation?.usdprice ?? product.usd_price ?? null),

          inr_purchase: isConfirmed
            ? product.inr_purchase
            : (purchase?.inr_purchase ?? validation?.inrpurchase ?? product.inr_purchase ?? null),

          // FROM ADMIN VALIDATION TABLE
          status: product.status,
          admin_status: product.admin_status,
          admin_notes: product.admin_notes,
          created_at: product.created_at,
          profit: product.profit,
          total_cost: product.total_cost,
          total_revenue: product.total_revenue,
          inr_purchase_link: product.inr_purchase_link,
          remark: product.remark ?? null,
          sku: product.sku ?? null,
        };
      });

      const usProducts = enrichedData.filter(p => p.origin_us === true);
      console.log('Products with originus=true:', usProducts.length, usProducts.map(p => p.asin));
      console.log('Sample product origins:', enrichedData.slice(0, 3).map(p => ({
        asin: p.asin,
        originindia: p.origin_india,
        originchina: p.origin_china,
        originus: p.origin_us,
      })));

      setProducts(enrichedData)
    } catch (error: any) {
      console.error('❌ Error in fetchProducts:', error)
      setToast({ message: 'Error loading data', type: 'error' })
    } finally {
      if (showLoader) setLoading(false)
    }
  }

  useEffect(() => {
    // ✅ FIRST LOAD → show loader
    fetchProducts(true);

    // ✅ REALTIME → silent refresh (NO loader)
    const channel = supabase
      .channel('admin_validation_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_admin_validation' },
        () => fetchProducts(false)
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [showAllJourneys]);

  // ✅ ADD: Ctrl+Z keyboard shortcut for Roll Back
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

  useEffect(() => {
    fetchAdminConstants();
  }, []);

  // Column widths state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_validation_column_widths');
      return saved ? JSON.parse(saved) : {
        asin: 120,
        sku: 100,
        product_name: 120,
        product_link: 100,
        target_price: 100,
        // target_qty: 80,
        admin_target_price: 120,
        funnel_seller: 100,
        funnel_qty: 80,
        buying_price: 100,
        buying_qty: 80,
        profit: 160,
        product_weight: 120,
        usd_price: 100,
        inr_purchase: 120,
        inr_purchase_link: 180,
        seller_link: 100,
        seller_phone: 120,
        payment_method: 120,
      };
    }
    return {
      asin: 120,
      sku: 120,
      history: 180,
      product_name: 200,
      product_link: 100,
      target_price: 100,
      // target_qty: 80,
      admin_target_price: 120,
      funnel_seller: 100,
      funnel_qty: 80,
      buying_price: 100,
      buying_qty: 80,
      profit: 160,
      product_weight: 120,
      usd_price: 100,
      inr_purchase: 120,
      inr_purchase_link: 180,
      seller_link: 100,
      seller_phone: 120,
      payment_method: 120
    };
  });

  const fetchAdminConstants = async () => {
    try {
      const { data, error } = await supabase
        .from('india_admin_validation_constants')
        .select('*')
        .limit(1)
        .single();

      // DEBUG — check browser console to verify
      console.log('📊 RAW DB Constants:', data);
      console.log('📊 DB Error:', error);

      if (!error && data) {
        // Helper: if value was stored as decimal (0.25), convert to percentage (25)
        const normalizePercent = (val: any, fallback: number): number => {
          let num = Number(val);
          if (!num || isNaN(num)) return fallback;
          while (num > 0 && num < 1) {
            num = num * 100;
          }
          return Math.round(num * 100) / 100;
        };

        const parsed: CalculationConstants = {
          dollar_rate: Number(data.dollarrate) || 90,
          bank_conversion_rate: normalizePercent(data.bankconversionrate, 2),
          shipping_charge_per_kg: Number(data.shippingchargeperkg) || 950,
          commission_rate: normalizePercent(data.commissionrate, 25),
          packing_cost: Number(data.packingcost) || 25,
        };

        console.log('📊 PARSED Constants:', parsed);
        setAdminConstants(parsed);
      }
    } catch (err) {
      console.error('Error fetching admin constants:', err);
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
      alert('Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }


  const saveAdminConstants = async () => {
    setIsSavingConstants(true);
    try {
      // Parse string inputs → numbers
      const newConstants: CalculationConstants = {
        ...adminConstants,
        dollar_rate: parseFloat(modalInputs.dollarrate) || adminConstants.dollar_rate,
        bank_conversion_rate: parseFloat(modalInputs.bankfee) || adminConstants.bank_conversion_rate,
        shipping_charge_per_kg: parseFloat(modalInputs.shipping) || adminConstants.shipping_charge_per_kg,
        commission_rate: parseFloat(modalInputs.commission) || adminConstants.commission_rate,
        packing_cost: parseFloat(modalInputs.packingcost) || adminConstants.packing_cost,
      };

      // Update local state immediately
      setAdminConstants(newConstants);

      const { data: existingData } = await supabase
        .from('india_admin_validation_constants')
        .select('id')
        .limit(1)
        .single();

      const payload = {
        dollar_rate: newConstants.dollar_rate,
        bank_conversion_rate: newConstants.bank_conversion_rate,
        shipping_charge_per_kg: newConstants.shipping_charge_per_kg,
        commission_rate: newConstants.commission_rate,
        packing_cost: newConstants.packing_cost,
      };

      console.log('📊 SAVING to DB:', payload);

      if (existingData) {
        const { error } = await supabase
          .from('india_admin_validation_constants')
          .update(payload)
          .eq('id', existingData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('india_admin_validation_constants')
          .insert(payload);
        if (error) throw error;
      }

      setToast({
        message: `Saved! Commission: ${newConstants.commission_rate}%, Bank: ${newConstants.bank_conversion_rate}%, Shipping: ₹${newConstants.shipping_charge_per_kg}`,
        type: 'success',
      });
      setIsConstantsModalOpen(false);
    } catch (err) {
      console.error('Save constants error:', err);
      setToast({ message: 'Failed to save constants', type: 'error' });
    } finally {
      setIsSavingConstants(false);
    }
  };

  const autoCalculateAdmin = (product: any): { total_cost: number | null; total_revenue: number | null; profit: number | null } => {
    const salesPrice = Number(product.targetprice ?? product.target_price);
    const weight = Number(product.productweight ?? product.product_weight);
    const purchasePrice = Number(product.buyingprice ?? product.buying_price);

    if (!salesPrice || !weight || purchasePrice === null || purchasePrice === undefined || isNaN(purchasePrice)) {
      return { total_cost: null, total_revenue: null, profit: null };
    }

    const commission = salesPrice * (adminConstants.commission_rate / 100);
    const shipping = (weight / 1000) * adminConstants.shipping_charge_per_kg;
    const bankfee = salesPrice * (adminConstants.bank_conversion_rate / 100);
    const packingCost = adminConstants.packing_cost || 0;
    const total_cost = commission + shipping + bankfee + packingCost + purchasePrice;
    const total_revenue = salesPrice;
    const profit = total_revenue - total_cost;

    return {
      total_cost: isFinite(total_cost) ? total_cost : null,
      total_revenue: isFinite(total_revenue) ? total_revenue : null,
      profit: isFinite(profit) ? profit : null,
    };
  };

  // Resize tracking state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState<number>(0);
  const [startWidth, setStartWidth] = useState<number>(0);

  // Table ref for resizing
  const tableRef = useRef<HTMLTableElement>(null);

  // Handle double-click to auto-fit column width
  const handleColumnDoubleClick = (columnKey: string) => {
    if (!tableRef.current) return;

    const columnIndex = Object.keys(columnWidths).indexOf(columnKey) + 1;
    const cells = tableRef.current.querySelectorAll<HTMLElement>(`tr td:nth-child(${columnIndex + 1}), tr th:nth-child(${columnIndex + 1})`);

    let maxWidth = 80;
    cells.forEach((cell: HTMLElement) => {
      const width = cell.scrollWidth + 20;
      if (width > maxWidth) maxWidth = width;
    });

    maxWidth = Math.min(maxWidth, 500);

    const newWidths = { ...columnWidths, [columnKey]: maxWidth };
    setColumnWidths(newWidths);
    localStorage.setItem('admin_validation_column_widths', JSON.stringify(newWidths));

    setToast({
      message: `Column resized to ${maxWidth}px`,
      type: 'success',
    });
  };

  // Handle column resize start
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    setResizingColumn(columnKey);
    setStartX(e.pageX);
    setStartWidth(columnWidths[columnKey] || 100);
  };

  // Handle column resize move
  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn) return;

    const diff = e.pageX - startX;
    const newWidth = Math.max(80, Math.min(600, startWidth + diff));

    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }));
  };

  // Handle column resize end
  const handleResizeEnd = () => {
    if (resizingColumn) {
      localStorage.setItem('admin_validation_column_widths', JSON.stringify(columnWidths));
      setResizingColumn(null);
    }
  };

  // Add resize event listeners
  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);

      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, startX, startWidth, columnWidths]);

  const DEFAULT_COLUMN_ORDER = [
    'asin', 'sku', 'history', 'remark', 'product_name', 'product_link',
    'target_price', 'admin_target_price', 'funnel_seller',
    'funnel_qty', 'product_weight', 'profit', 'buying_price', 'buying_qty',
    'seller_link', 'seller_phone', 'payment_method', 'actions'
  ];

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMN_ORDER;
    try {
      const saved = localStorage.getItem('adminValidationColumnOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = parsed.filter((k: string) => DEFAULT_COLUMN_ORDER.includes(k));
        DEFAULT_COLUMN_ORDER.forEach(k => { if (!merged.includes(k)) merged.push(k); });
        return merged;
      }
    } catch { }
    return DEFAULT_COLUMN_ORDER;
  });

  const dragColumnRef = useRef<string | null>(null);
  const dragOverColumnRef = useRef<string | null>(null);

  const handleColumnDragStart = (col_key: string) => {
    dragColumnRef.current = col_key;
  };

  const handleColumnDragOver = (e: React.DragEvent, col_key: string) => {
    e.preventDefault();
    dragOverColumnRef.current = col_key;
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
    localStorage.setItem('adminValidationColumnOrder', JSON.stringify(newOrder));
    dragColumnRef.current = null;
    dragOverColumnRef.current = null;
  };
  // ========== END COLUMN DRAG REORDER ==========

  // Filter products based on active tab
  const filteredProducts = products.filter((product) => {
    // Search filter
    const matchesSearch = !searchQuery ||
      product.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.seller_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // Origin Filter
    if (originFilter !== 'ALL') {
      if (originFilter === 'India' && !product.origin_india) return false;
      if (originFilter === 'China' && !product.origin_china) return false;
      if (originFilter === 'US' && !product.origin_us) return false;
    }

    // Funnel Filter (RS = HD+LD i.e. funnel 1 or 2, DP = funnel 3)
    if (funnelFilter !== 'ALL') {
      const f = product.funnel;
      if (funnelFilter === 'RS') {
        const fStr = String(f).toUpperCase();
        if (fStr !== 'RS' && fStr !== 'HD' && fStr !== 'LD' &&
          f !== 1 && f !== '1' && f !== 2 && f !== '2')
          return false;
      } else if (funnelFilter === 'DP') {
        if (f !== 3 && f !== '3' && String(f).toUpperCase() !== 'DP') return false;
      }
    }

    // Admin Status Filter
    if (adminStatusFilter !== 'ALL') {
      if (adminStatusFilter === 'pending') {
        if (product.admin_status !== 'pending' && product.admin_status) return false;
      } else {
        if (product.admin_status !== adminStatusFilter) return false;
      }
    }

    // Remark Filter
    if (remarkFilter !== 'ALL') {
      if (remarkFilter === 'hasRemark' && (!product.remark || !product.remark.trim())) return false;
      if (remarkFilter === 'noRemark' && product.remark && product.remark.trim()) return false;
    }

    // Tab filter
    switch (activeTab) {
      case 'india':
        // ✅ Hide Confirmed/Rejected items (work like Overview)
        return product.origin_india === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
      case 'china':
        // ✅ Hide Confirmed/Rejected items (work like Overview)
        return product.origin_china === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
      case 'us':
        return product.origin_us === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
      case 'pending':
        return product.admin_status === 'pending' || !product.admin_status;
      case 'confirm':
        return product.admin_status === 'confirmed';
      case 'reject':
        return product.admin_status === 'rejected';
      case 'overview':
      default:
        // ✅ FIX: Overview shows only pending products (not confirmed/rejected)
        return product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
    }
  });


  // Handle confirm selected products
  const handleConfirmSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one product to confirm');
      return;
    }

    try {
      const selectedProducts = products.filter(p => selectedIds.has(p.id));

      for (const product of selectedProducts) {
        // ✅ STEP 1: UPDATE india_purchases (existing workflow preserved)
        const { error: updatePurchaseError } = await supabase
          .from('india_purchases')
          .update({
            admin_confirmed: true,
            admin_confirmed_at: new Date().toISOString(),
            admin_target_price: product.admin_target_price,
            buying_price: product.buying_price,           // ✅ ADD
            buying_quantity: product.buying_quantity,     // ✅ ADD
            seller_link: product.seller_link,             // ✅ ADD
            seller_phone: product.seller_phone,           // ✅ ADD
            payment_method: product.payment_method,
          })
          .eq('asin', product.asin);

        if (updatePurchaseError) throw updatePurchaseError;

        // ✅ STEP 2: UPDATE status in india_admin_validation (KEEP the product, don't delete)
        const { error: updateAdminError } = await supabase
          .from('india_admin_validation')
          .update({
            admin_status: 'confirmed',  // ✅ Set to 'confirmed' so it appears in Confirm tab
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateAdminError) throw updateAdminError;
      }

      alert(`Successfully confirmed ${selectedIds.size} products!`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error: any) {
      alert(`Error confirming products: ${error.message}`);
    }
  };

  // UPDATE handleCellEdit TO TRIGGER AUTO-CALCULATION
  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      const fieldMapping: Record<string, string> = {
        'inrpurchaselink': 'inr_purchase_link',
        'productname': 'product_name',
        'productlink': 'product_link',
        'sellertag': 'seller_tag',
        'targetprice': 'target_price',
        'targetpricevalidation': 'target_price_validation',
        'targetpricelinkvalidation': 'target_price_link_validation',
        'buyingprice': 'buying_price',
        'buyingquantity': 'buying_quantity',
        'sellerlink': 'seller_link',
        'sellerphone': 'seller_phone',
        'paymentmethod': 'payment_method',
        'originindia': 'origin_india',
        'originchina': 'origin_china',
        'originus': 'origin_us',
        'productweight': 'product_weight',
        'totalcost': 'total_cost',
        'totalrevenue': 'total_revenue',
        'adminstatus': 'admin_status',
        'adminnotes': 'admin_notes',
        'remark': 'remark',
        'sku': 'sku',
        'admintargetprice': 'admin_target_price',
        'usdprice': 'usd_price',
        'inrpurchase': 'inr_purchase',
        'createdat': 'created_at',
      };

      const dbField = fieldMapping[field] || field;
      console.log('📊 Updating product:', { id, field, dbField, value });

      const updatePayload: Record<string, any> = { [dbField]: value };

      let calcResult: { total_cost: number | null; total_revenue: number | null; profit: number | null } =
        { total_cost: null, total_revenue: null, profit: null };

      if (field === 'targetprice' || field === 'productweight' || field === 'buyingprice') {
        const updatedProduct = products.find((p) => p.id === id);
        if (updatedProduct) {
          calcResult = autoCalculateAdmin({ ...updatedProduct, [field]: value });
          if (calcResult.profit !== null) {
            updatePayload.profit = calcResult.profit;
            updatePayload.total_cost = calcResult.total_cost;
            updatePayload.total_revenue = calcResult.total_revenue;
          }
        }
      }

      // UPDATE LOCAL STATE FIRST (before DB call to prevent realtime race condition)
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const updated = { ...p, [field]: value };
          if (field === 'admintargetprice') updated.admin_target_price = value;
          if (field === 'sellertag') updated.seller_tag = value;
          if (calcResult.profit !== null) {
            updated.profit = calcResult.profit;
            updated.total_cost = calcResult.total_cost;
            updated.total_revenue = calcResult.total_revenue;
          }
          return updated;
        })
      );

      // THEN save to DB
      const { error } = await supabase
        .from('india_admin_validation')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        console.error('Update error:', error);
        setToast({ message: 'Failed to update', type: 'error' });
        return;
      }

      console.log('Product updated successfully', updatePayload);

      const wasCalcTriggered = ['targetprice', 'productweight', 'buyingprice'].includes(field);
      const profitVal = updatePayload.profit;
      setToast({
        message: wasCalcTriggered && profitVal !== undefined
          ? `Profit: ₹${Number(profitVal).toFixed(2)} | Cost: ₹${Number(updatePayload.total_cost).toFixed(2)} | Revenue: ₹${Number(updatePayload.total_revenue).toFixed(2)}`
          : 'Updated successfully',
        type: wasCalcTriggered && profitVal !== undefined ? (profitVal >= 0 ? 'success' : 'warning') : 'success',
      });
    } catch (err: any) {
      console.error('Update error:', err);
      setToast({ message: 'Update failed', type: 'error' });
    }
  };


  // =========================================================
  // ✅ ROBUST AUTO-DISTRIBUTE (Handles Typos & MULTIPLE TAGS)
  // =========================================================
  const handleConfirmProduct = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const cleanAsin = product.asin.trim();
      console.log(`🚀 Confirming: ${cleanAsin}`);

      // 1. FRESH FETCH (Only existing columns)
      const { data: validationData, error: fetchError } = await supabase
        .from('india_validation_main_file')
        .select('funnel, seller_tag')
        .eq('asin', cleanAsin)
        .limit(1)
        .maybeSingle();

      if (fetchError) console.warn("⚠️ DB Fetch Warning:", fetchError.message);

      // 2. DETERMINE SELLER TAG (With Fallback)
      const rawSellerTag = validationData?.seller_tag || product.seller_tag;

      if (!rawSellerTag) {
        alert("Error: Missing Seller Tag. Please check product data.");
        return;
      }

      // 3. DETERMINE FUNNEL ID (Robust Parser)
      let finalFunnelId = 0;
      const rawFunnel = validationData?.funnel ?? product.funnel;

      // Handle number (1) or string ("1", "High Demand")
      if (rawFunnel !== null && rawFunnel !== undefined) {
        if (!isNaN(Number(rawFunnel))) finalFunnelId = Number(rawFunnel);
        else {
          const str = String(rawFunnel).toLowerCase();
          if (str.includes('high') || str === 'hd' || str === 'rs') finalFunnelId = 1;  // ← ADD rs HERE
          else if (str.includes('low') || str === 'ld') finalFunnelId = 2;
          else if (str.includes('drop') || str.includes('dp')) finalFunnelId = 3;
        }
      }

      // 4. PARSE MULTIPLE TAGS (Fix for 'VV,GR' error)
      // We split by comma to handle cases where a product belongs to multiple sellers
      const tags = rawSellerTag.split(',').map((t: string) => t.trim().toUpperCase());
      const validSellerIds: number[] = [];

      for (const tag of tags) {
        switch (tag) {
          case "GR": validSellerIds.push(1); break;
          case "RR": validSellerIds.push(2); break;
          case "UB": validSellerIds.push(3); break;
          case "VV": validSellerIds.push(4); break;
          case "DE": validSellerIds.push(5); break; // ✅ ADD THIS
          case "CV": validSellerIds.push(6); break; // ✅ ADD THIS
          default: console.warn("Skipping unrecognized tag part", tag);
        }
      }

      if (validSellerIds.length === 0) {
        alert(`Error: No valid seller tags found in '${rawSellerTag}'`);
        return;
      }

      console.log(`📊 Distributing to Sellers: ${validSellerIds.join(', ')} | Funnel=${finalFunnelId}`);

      // 5. LOOP THROUGH ALL VALID SELLERS (Distribute to each)
      for (const sellerId of validSellerIds) {
        // A. Prepare Payload
        const payload = {
          source_admin_validation_id: product.id,
          asin: cleanAsin,
          product_name: product.product_name,
          sku: product.sku || cleanAsin,
          selling_price: product.buying_price || product.admin_target_price || 0,
          seller_link: product.seller_link,
          min_price: null,
          max_price: null,
          remark: product.remark ?? null,
        };

        // B. Select Tables for THIS seller
        const tablesToInsert = [`india_listing_error_seller_${sellerId}_pending`];

        if (finalFunnelId === 1) tablesToInsert.push(`india_listing_error_seller_${sellerId}_high_demand`);
        else if (finalFunnelId === 2) tablesToInsert.push(`india_listing_error_seller_${sellerId}_low_demand`);
        else if (finalFunnelId === 3) tablesToInsert.push(`india_listing_error_seller_${sellerId}_dropshipping`);

        // C. Execute UPSERTS
        const insertPromises = tablesToInsert.map(table =>
          supabase.from(table).upsert(payload, { onConflict: 'asin' })
        );

        await Promise.all(insertPromises);

        // D. Update Stats for THIS seller
        const { data: currentStats } = await supabase
          .from('listing_error_progress')
          .select('total_pending')
          .eq('seller_id', sellerId)
          .single();

        if (currentStats) {
          await supabase.from('listing_error_progress')
            .update({
              total_pending: currentStats.total_pending + 1,
              updated_at: new Date().toISOString()
            })
            .eq('seller_id', sellerId);
        }
      }

      // 6. Update FINAL Statuses (Once per product)
      await supabase.from('india_purchases').update({
        admin_confirmed: true,
        admin_confirmed_at: new Date().toISOString(),
        admin_target_price: product.admin_target_price,
        buying_price: product.buying_price,
        buying_quantity: product.buying_quantity,
        seller_link: product.seller_link,
        seller_phone: product.seller_phone,
        payment_method: product.payment_method,
        sku: product.sku || null,
      }).eq('asin', cleanAsin);

      await supabase.from('india_admin_validation').update({
        admin_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }).eq('id', productId);

      fetchProducts();

      const dest = finalFunnelId === 1 ? "High Demand" : finalFunnelId === 2 ? "Low Demand" : finalFunnelId === 3 ? "Dropshipping" : "Pending Only";

      setToast({
        message: `Success! Distributed to ${validSellerIds.length} Seller(s) (${dest})`,
        type: "success"
      });

    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
    }
  };

  // ✅ COMPLETE HANDLE REJECT FUNCTION
  const handleRejectProduct = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // 1. Save to history for undo
      setMovementHistory((prev) => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.admin_status,
          toStatus: 'rejected'
        },
      }));

      // 2. Update Database
      const { error: updateAdminError } = await supabase
        .from('india_admin_validation')
        .update({
          admin_status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateAdminError) throw updateAdminError;

      // 3. Update Local State (Item will disappear from filtered list)
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, admin_status: 'rejected' } : p
        )
      );

      setToast({ message: 'Product rejected', type: 'info' });

    } catch (error: any) {
      alert(`Error rejecting product: ${error.message}`);
    }
  };

  // ✅ ADD: Roll Back last movement
  const handleRollBack = async () => {
    // Always use activeTab as the key where movements are saved
    const lastMovement = movementHistory[activeTab];

    if (!lastMovement) {
      alert('No recent movement to roll back from this tab');
      return;
    }

    setLoading(true);
    try {
      const { product, fromStatus, toStatus } = lastMovement;

      if (toStatus === 'confirmed') {
        // Rolling back from Confirm
        // 1. Revert india_purchases
        const { error: updatePurchaseError } = await supabase
          .from('india_purchases')
          .update({
            admin_confirmed: false,
            admin_confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updatePurchaseError) {
          console.error('Error rolling back india_purchases:', updatePurchaseError);
        }

        // 2. Revert india_admin_validation status
        const { error: updateAdminError } = await supabase
          .from('india_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updateAdminError) throw updateAdminError;

      } else if (toStatus === 'rejected') {
        // Rolling back from Reject
        const { error: updateAdminError } = await supabase
          .from('india_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            rejected_at: null,
          })
          .eq('asin', product.asin);

        if (updateAdminError) throw updateAdminError;
      }

      // Clear history for this tab
      setMovementHistory((prev) => {
        const newHistory = { ...prev };
        delete newHistory[activeTab];
        return newHistory;
      });

      alert(`Rolled back: ${product.product_name}`);
      fetchProducts();
    } catch (error) {
      console.error('Error rolling back:', error);
      alert('Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle select/deselect
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

  const pendingCount = products.filter((p) => p.admin_status === 'pending' || !p.admin_status).length;
  const rejectedCount = products.filter((p) => p.admin_status === 'rejected').length;
  const confirmedCount = products.filter(p => p.admin_status === 'confirmed').length; // ✅ ADD THIS
  const indiaCount = products.filter((p) => p.origin_india && p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length;
  const chinaCount = products.filter((p) => p.origin_china && p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length;
  const usCount = products.filter(p => p.origin_us && p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length;

  const renderAdminCell = (col_key: string, product: AdminProduct) => {
    switch (col_key) {

      case 'asin':
        return (
          <td key={col_key} className="px-4 py-3 text-sm text-slate-300 font-mono tracking-tight">
            {product.asin}
          </td>
        );

      case 'sku':
        return (
          <td key={col_key} className="px-4 py-3 text-sm overflow-hidden" style={{ maxWidth: columnWidths.sku || 100, width: columnWidths.sku || 100 }}>
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
                    onClick={() => {
                      handleCellEdit(product.id, 'sku', editingSkuValue.trim() || null);
                      setEditingSkuId(null);
                    }}
                    className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                    title="Save (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingSkuId(null)}
                    className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                    title="Cancel (Esc)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : product.sku ? (
                <div className="flex items-center gap-2">
                  <span className="text-slate-200 text-xs truncate" title={product.sku}>{product.sku}</span>
                  <button
                    onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(product.sku || ''); }}
                    className="text-slate-500 hover:text-amber-500 transition-colors flex-shrink-0"
                    title="Edit SKU"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(''); }}
                  className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add SKU
                </button>
              )}
            </div>
          </td>
        );

      case 'history':
        return (
          <td key={col_key} className="px-4 py-3 text-center bg-amber-900/10">
            <button
              onClick={() => fetchHistory(product.asin)}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-400/50 transition-all cursor-pointer"
              title={`Journey ${product.journey_number || 1} — Click to view history`}
            >
              <span>{product.journey_number || 1}</span>
              <History className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          </td>
        );

      case 'remark':
        return (
          <td key={col_key} className="px-4 py-2" style={{ width: columnWidths.remark }}>
            <div className="flex items-center gap-2">
              {product.remark ? (
                <button onClick={() => setSelectedRemark(product.remark)} className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors">
                  View
                </button>
              ) : null}
            </div>
          </td>
        );

      case 'product_name':
        return (
          <td key={col_key} className="px-4 py-3 text-sm text-slate-200" style={{ maxWidth: columnWidths.productname, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.product_name || '-'}>
            {product.product_name || '-'}
          </td>
        );

      case 'product_link':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            <div className="w-32">
              {editingLinkId === product.id ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={editingLinkValue} onChange={(e) => setEditingLinkValue(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    placeholder="URL..." autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleCellEdit(product.id, 'productlink', editingLinkValue); setEditingLinkId(null); } else if (e.key === 'Escape') { setEditingLinkId(null); } }}
                  />
                  <button onClick={() => { handleCellEdit(product.id, 'productlink', editingLinkValue); setEditingLinkId(null); }} className="text-emerald-500 hover:text-emerald-400 flex-shrink-0" title="Save (Enter)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => setEditingLinkId(null)} className="text-rose-500 hover:text-rose-400 flex-shrink-0" title="Cancel (Esc)">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {product.product_link ? (
                    <>
                      <a href={product.product_link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium whitespace-nowrap">View Link</a>
                      <button onClick={() => { setEditingLinkId(product.id); setEditingLinkValue(product.product_link || ''); }} className="text-slate-500 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit link">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingLinkId(product.id); setEditingLinkValue(''); }} className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Link
                    </button>
                  )}
                </div>
              )}
            </div>
          </td>
        );

      case 'target_price':
        return (
          <td key={col_key} className="px-4 py-3">
            <input type="number" defaultValue={product.target_price}
              onChange={(e) => handleCellEdit(product.id, 'targetprice', parseFloat(e.target.value))}
              className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </td>
        );

      // case 'target_qty':
      //   return (
      //     <td key={col_key} className="px-4 py-3">
      //       <input type="number" defaultValue={product.target_quantity}
      //         onChange={(e) => handleCellEdit(product.id, 'targetquantity', parseInt(e.target.value))}
      //         className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      //       />
      //     </td>
      //   );

      case 'admin_target_price':
        return (
          <td key={col_key} className="px-4 py-3 bg-purple-900/10">
            <input type="number" step="0.01" value={product.admin_target_price ?? ''}
              onChange={(e) => handleCellEdit(product.id, 'admintargetprice', e.target.value === '' ? null : parseFloat(e.target.value))}
              className="w-24 px-2 py-1 bg-slate-950 border border-purple-500/50 rounded text-sm text-purple-200 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-purple-400/50"
              placeholder="₹"
            />
          </td>
        );

      case 'funnel_seller':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            {product.seller_tag ? (
              <div className="flex flex-wrap gap-2">
                {product.seller_tag.split(',').map((tag) => {
                  const cleanTag = tag.trim();
                  let badgeColor = 'bg-slate-600 text-white';
                  if (cleanTag === 'GR') badgeColor = 'bg-yellow-500 text-black';
                  else if (cleanTag === 'RR') badgeColor = 'bg-slate-500 text-white';
                  else if (cleanTag === 'UB') badgeColor = 'bg-pink-500 text-white';
                  else if (cleanTag === 'VV') badgeColor = 'bg-purple-500 text-white';
                  else if (cleanTag === 'DE') badgeColor = 'bg-cyan-500 text-black';
                  else if (cleanTag === 'CV') badgeColor = 'bg-teal-500 text-white';
                  return (
                    <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${badgeColor}`}>
                      {cleanTag}
                    </span>
                  );
                })}
              </div>
            ) : (<span className="text-xs text-slate-600 italic">-</span>)}
          </td>
        );

      case 'funnel_qty':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            {product.funnel ? (
              <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-xs ${(product.funnel == 1 || product.funnel == '1' || product.funnel == 2 || product.funnel == '2' || String(product.funnel).toUpperCase() === 'HD' || String(product.funnel).toUpperCase() === 'LD' || String(product.funnel).toUpperCase() === 'RS')
                ? 'bg-emerald-600 text-white'
                : (product.funnel == 3 || product.funnel == '3' || String(product.funnel).toUpperCase() === 'DP')
                  ? 'bg-amber-500 text-black'
                  : 'bg-slate-600 text-white'
                }`}>
                {(product.funnel == 1 || product.funnel == '1' || product.funnel == 2 || product.funnel == '2' || String(product.funnel).toUpperCase() === 'HD' || String(product.funnel).toUpperCase() === 'LD' || String(product.funnel).toUpperCase() === 'RS')
                  ? 'RS'
                  : (product.funnel == 3 || product.funnel == '3' || String(product.funnel).toUpperCase() === 'DP')
                    ? 'DP'
                    : product.funnel}
              </span>
            ) : (<span className="text-xs text-slate-600 italic">-</span>)}
          </td>
        );

      case 'product_weight':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            <div className="relative">
              <input type="number" step="0.01" defaultValue={product.product_weight}
                onBlur={(e) => handleCellEdit(product.id, 'productweight', parseFloat(e.target.value) || null)}
                className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="g"
              />
              {calculatingIds.has(product.id) && (
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-indigo-500 border-t-transparent"></div>
                </div>
              )}
            </div>
          </td>
        );

      case 'profit':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            <div className="flex flex-col gap-1">
              <div className={`w-full min-w-[6rem] px-2 py-1 border rounded text-sm font-bold text-center truncate ${(product.profit ?? 0) >= 0
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                }`}>
                {product.profit != null ? `₹${product.profit.toFixed(2)}` : '-'}
              </div>
              <div className="flex gap-2 text-[10px] text-slate-500 justify-center">
                <span title="Total Cost">C: {product.total_cost != null ? `₹${product.total_cost.toFixed(0)}` : '-'}</span>
                <span title="Total Revenue">R: {product.total_revenue != null ? `₹${product.total_revenue.toFixed(0)}` : '-'}</span>
              </div>
            </div>
          </td>
        );

      case 'buying_price':
        return (
          <td key={col_key} className="px-4 py-3">
            <input type="number" defaultValue={product.buying_price}
              onChange={(e) => handleCellEdit(product.id, 'buyingprice', parseFloat(e.target.value))}
              className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </td>
        );

      case 'buying_qty':
        return (
          <td key={col_key} className="px-4 py-3">
            <input type="number" defaultValue={product.buying_quantity}
              onChange={(e) => handleCellEdit(product.id, 'buyingquantity', parseInt(e.target.value))}
              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </td>
        );

      case 'seller_link':
        return (
          <td key={col_key} className="px-4 py-3 text-sm">
            <div className="w-32">
              {editingLinkId === `seller_${product.id}` ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={editingLinkValue} onChange={(e) => setEditingLinkValue(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-950 border border-indigo-500 rounded text-xs text-white focus:ring-1 focus:ring-indigo-500"
                    placeholder="Amazon URL..." autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleCellEdit(product.id, 'sellerlink', editingLinkValue); setEditingLinkId(null); } else if (e.key === 'Escape') { setEditingLinkId(null); } }}
                  />
                  <button onClick={() => { handleCellEdit(product.id, 'sellerlink', editingLinkValue); setEditingLinkId(null); }} className="text-emerald-500 hover:text-emerald-400 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <button onClick={() => setEditingLinkId(null)} className="text-rose-500 hover:text-rose-400 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {product.seller_link && product.seller_link.trim() !== '' ? (
                    <>
                      <a href={product.seller_link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium whitespace-nowrap">View Link</a>
                      <button onClick={() => { setEditingLinkId(`seller_${product.id}`); setEditingLinkValue(product.seller_link || ''); }} className="text-slate-500 hover:text-amber-500 transition-colors flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingLinkId(`seller_${product.id}`); setEditingLinkValue(''); }} className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1">
                      Add Link
                    </button>
                  )}
                </div>
              )}
            </div>
          </td>
        );

      case 'seller_phone':
        return (
          <td key={col_key} className="px-4 py-3">
            <input type="text" defaultValue={product.seller_phone}
              onChange={(e) => handleCellEdit(product.id, 'sellerphone', e.target.value)}
              className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Phone"
            />
          </td>
        );

      case 'payment_method':
        return (
          <td key={col_key} className="px-4 py-3">
            <input type="text" defaultValue={product.payment_method}
              onChange={(e) => handleCellEdit(product.id, 'paymentmethod', e.target.value)}
              className="w-24 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Method"
            />
          </td>
        );

      case 'actions':
        if (activeTab === 'confirm' || activeTab === 'reject') return null;
        return (
          <td key={col_key} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfirmProduct(product.id)}
                disabled={product.admin_status === 'confirmed'}
                className={`p-2 rounded-lg transition-all ${product.admin_status === 'confirmed'
                  ? 'bg-emerald-500/20 text-emerald-600 cursor-not-allowed border border-emerald-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20'}`}
                title="Confirm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button
                onClick={() => handleRejectProduct(product.id)}
                disabled={product.admin_status === 'rejected'}
                className={`p-2 rounded-lg transition-all ${product.admin_status === 'rejected'
                  ? 'bg-rose-500/20 text-rose-600 cursor-not-allowed border border-rose-500/30'
                  : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20'}`}
                title="Reject"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </td>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 p-6 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="w-full flex flex-col flex-1 overflow-hidden">

        {/* Header Section */}
        <div className="flex-none mb-6">
          <h1 className="text-3xl font-bold text-white">Admin Validation</h1>
          <p className="text-slate-400 mt-1">Review and manage product pricing and profitability</p>
        </div>

        {/* Tabs - STICKY */}
        <div className="flex-none flex gap-2 mb-5 flex-wrap p-1.5 bg-slate-900/50 rounded-2xl border border-slate-800 w-fit backdrop-blur-sm">
          {[
            { id: 'overview', label: 'Overview', count: products.filter(p => p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length, color: 'text-indigo-400', activeBg: 'bg-indigo-500/10' },
            { id: 'india', label: 'India', count: indiaCount, color: 'text-orange-400', activeBg: 'bg-orange-500/10' },
            { id: 'china', label: 'China', count: chinaCount, color: 'text-rose-400', activeBg: 'bg-rose-500/10' },
            { id: 'us', label: 'US', count: usCount, color: 'text-sky-400', activeBg: 'bg-sky-500/10' },
            { id: 'pending', label: 'Pending', count: pendingCount, color: 'text-amber-400', activeBg: 'bg-amber-500/10' },
            { id: 'confirm', label: 'Confirmed', count: confirmedCount, color: 'text-emerald-400', activeBg: 'bg-emerald-500/10' },
            { id: 'reject', label: 'Rejected', count: rejectedCount, color: 'text-rose-400', activeBg: 'bg-rose-500/10' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-all relative overflow-hidden ${activeTab === tab.id
                ? `text-white bg-slate-800 shadow-[0_0_15px_-5px_currentColor] border border-slate-700 ${tab.color}`
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
                }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full bg-slate-950/50 border border-slate-800 ${tab.color}`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.id && (
                <div className={`absolute inset-0 opacity-10 ${tab.activeBg}`} />
              )}
            </button>
          ))}
        </div>

        {/* Search Bar & Buttons */}
        <div className="flex-none mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Search Input */}
          <div className="relative flex-1 w-full md:max-w-md group">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ASIN, Product Name, SKU, or Funnel Seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-slate-200 placeholder-slate-600 transition-all shadow-sm text-sm"
            />
          </div>

          {/* Right: Buttons Group */}
          <div className="flex items-center gap-3">

            {/* Funnel Filter Pills - RS / DP */}
            <div className="flex items-center bg-slate-900/50 rounded-xl border border-slate-800 p-1">
              {(['ALL', 'RS', 'DP'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFunnelFilter(opt)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === opt
                    ? opt === 'RS' ? 'bg-emerald-600 text-white shadow-lg'
                      : opt === 'DP' ? 'bg-amber-500 text-black shadow-lg'
                        : 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Filter Button + Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border ${originFilter !== 'ALL' || adminStatusFilter !== 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-900/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
                {(originFilter !== 'ALL' || adminStatusFilter !== 'ALL' || remarkFilter !== 'ALL') && (
                  <span className="w-5 h-5 bg-white/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {[originFilter !== 'ALL', adminStatusFilter !== 'ALL', remarkFilter !== 'ALL'].filter(Boolean).length}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 z-20 w-72">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-200 text-sm">Filters</h3>
                      {(originFilter !== 'ALL' || adminStatusFilter !== 'ALL' || remarkFilter !== 'ALL') && (
                        <button
                          onClick={() => { setOriginFilter('ALL'); setAdminStatusFilter('ALL'); setRemarkFilter('ALL'); }}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {/* Origin Filter */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Origin</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ALL', 'India', 'China', 'US'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setOriginFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${originFilter === opt
                              ? opt === 'India' ? 'bg-orange-500 text-white'
                                : opt === 'China' ? 'bg-rose-500 text-white'
                                  : opt === 'US' ? 'bg-sky-500 text-white'
                                    : 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                              }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Admin Status Filter */}
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Status</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ALL', 'pending', 'confirmed', 'rejected'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setAdminStatusFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${adminStatusFilter === opt
                              ? opt === 'pending' ? 'bg-amber-500 text-black'
                                : opt === 'confirmed' ? 'bg-emerald-500 text-white'
                                  : opt === 'rejected' ? 'bg-rose-500 text-white'
                                    : 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                              }`}
                          >
                            {opt === 'ALL' ? 'All' : opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Remark Filter */}
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-2 block">Remark</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ALL', 'hasRemark', 'noRemark'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setRemarkFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${remarkFilter === opt
                              ? opt === 'hasRemark'
                                ? 'bg-teal-500 text-white'
                                : opt === 'noRemark'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                              }`}
                          >
                            {opt === 'ALL' ? 'All' : opt === 'hasRemark' ? 'Has Remark' : 'No Remark'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Roll Back Button */}
            <button
              onClick={handleRollBack}
              disabled={!movementHistory[activeTab]}
              className="px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-lg shadow-amber-900/20 transition-all border border-amber-500/50"
              title="Roll Back last action from this tab (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Roll Back
            </button>

            {/* 🆕 NEW: Toggle Button for All Journeys */}
            <button
              onClick={() => setShowAllJourneys(!showAllJourneys)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border shadow-lg ${showAllJourneys
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500/50 shadow-indigo-900/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                }`}
              title={`Currently showing: ${showAllJourneys ? 'All journey cycles' : 'Latest journey only'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {showAllJourneys ? 'Show Latest Only' : 'Show All Journeys'}
            </button>

            {/* Configure Constants Button */}
            <button
              onClick={() => {
                setModalInputs({
                  dollarrate: String(adminConstants.dollar_rate),
                  bankfee: String(adminConstants.bank_conversion_rate),
                  shipping: String(adminConstants.shipping_charge_per_kg),
                  commission: String(adminConstants.commission_rate),
                  packingcost: String(adminConstants.packing_cost),
                });
                setIsConstantsModalOpen(true);
              }}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-purple-900/20 transition-all border border-purple-500/50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configure Constants
            </button>
          </div>
        </div>

        <div className="text-xs text-indigo-400 mb-2 px-1 font-medium flex items-center gap-2">
          <span className="bg-indigo-500/10 px-2 py-1 rounded">💡</span>
          <span>
            {showAllJourneys
              ? 'Showing ALL journey cycles. Toggle to see latest only.'
              : 'Showing LATEST journey per ASIN. Toggle to see all cycles.'}
          </span>
          <span className="bg-indigo-500/10 px-2 py-1 rounded ml-2">📊</span>
          <span>Double-click any column header to auto-fit its width</span>
        </div>

        {/* Table - SCROLLABLE ONLY */}
        <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-slate-800">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
            <table className="w-full border-collapse" ref={tableRef}>
              <thead className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10 shadow-md">
                <tr>
                  {/* Checkbox — always first, not draggable */}
                  <th className="px-4 py-3 bg-slate-950">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                    />
                  </th>

                  {columnOrder.map((col_key) => {
                    // Hide actions on confirm/reject tabs
                    if (col_key === 'actions' && (activeTab === 'confirm' || activeTab === 'reject')) return null;

                    const colConfig: Record<string, { label: string; widthKey: string; minWidth: number; headerClass?: string }> = {
                      asin: { label: 'ASIN', widthKey: 'asin', minWidth: 80 },
                      sku: { label: 'SKU', widthKey: 'sku', minWidth: 80 },
                      history: { label: 'J #', widthKey: 'history', minWidth: 70, headerClass: 'text-amber-400 bg-amber-900/10' },
                      remark: { label: 'REMARK', widthKey: 'remark', minWidth: 100 },
                      product_name: { label: 'Product Name', widthKey: 'productname', minWidth: 150 },
                      product_link: { label: 'Product Link', widthKey: 'productlink', minWidth: 80 },
                      target_price: { label: 'Sales Price INR', widthKey: 'targetprice', minWidth: 80 },
                      admin_target_price: { label: 'Admin Target Price', widthKey: 'admintargetprice', minWidth: 100, headerClass: 'text-purple-300 bg-purple-900/10' },
                      funnel_seller: { label: 'Seller Tag', widthKey: 'funnelseller', minWidth: 80 },
                      funnel_qty: { label: 'Funnel', widthKey: 'funnelqty', minWidth: 70 },
                      product_weight: { label: 'Product Weight', widthKey: 'productweight', minWidth: 100 },
                      profit: { label: 'Profit', widthKey: 'profit', minWidth: 80 },
                      buying_price: { label: 'Purchase Price', widthKey: 'buyingprice', minWidth: 80 },
                      buying_qty: { label: 'Buying Qty', widthKey: 'buyingqty', minWidth: 70 },
                      seller_link: { label: 'Purchase Link', widthKey: 'sellerlink', minWidth: 80 },
                      seller_phone: { label: 'Seller Ph No.', widthKey: 'sellerphone', minWidth: 100 },
                      payment_method: { label: 'Payment Method', widthKey: 'paymentmethod', minWidth: 100 },
                      actions: { label: 'Actions', widthKey: 'actions', minWidth: 80 },
                    };

                    const cfg = colConfig[col_key];
                    if (!cfg) return null;

                    const headerClass = cfg.headerClass || 'text-slate-400 bg-slate-950';

                    return (
                      <th
                        key={col_key}
                        draggable
                        onDragStart={() => handleColumnDragStart(col_key)}
                        onDragOver={(e) => handleColumnDragOver(e, col_key)}
                        onDrop={handleColumnDrop}
                        onDoubleClick={() => handleColumnDoubleClick(cfg.widthKey)}
                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-slate-800 relative border-r border-slate-800 select-none cursor-grab active:cursor-grabbing ${headerClass}`}
                        style={{ width: columnWidths[cfg.widthKey], minWidth: cfg.minWidth }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{cfg.label}</span>
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-500"
                          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, cfg.widthKey); }}
                          style={{
                            backgroundColor: resizingColumn === cfg.widthKey ? '#6366f1' : 'transparent',
                            width: resizingColumn === cfg.widthKey ? '2px' : '4px',
                          }}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <span className="text-lg font-semibold text-slate-400">No products found in {activeTab}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-800/60 transition-colors border-b border-slate-800">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                        />
                      </td>
                      {columnOrder.map((col_key) => renderAdminCell(col_key, product))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Stats Footer - FIXED AT BOTTOM */}
          <div className="flex-none border-t border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            Showing <span className="font-bold text-white">{filteredProducts.length}</span> of <span className="font-bold text-white">{products.length}</span> products
          </div>
        </div>

        {/* Constants Configuration Modal */}
        {isConstantsModalOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" onClick={() => setIsConstantsModalOpen(false)} />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-800 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-6 rounded-t-xl">
                  <h2 className="text-2xl font-bold">Admin Calculation Constants</h2>
                  <p className="text-purple-100 mt-1 opacity-90">Configure constants for profit calculation</p>
                </div>

                {/* Body */}
                <div className="grid grid-cols-2 gap-6 p-6">
                  {/* Dollar Rate */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">💵 Dollar Rate (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.dollarrate}
                      onChange={(e) => setModalInputs({ ...modalInputs, dollarrate: e.target.value })}
                      placeholder="e.g. 90"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Currently: ₹{adminConstants.dollar_rate}</p>
                  </div>

                  {/* Bank Fee */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">🏦 Bank Fee (%)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.bankfee}
                      onChange={(e) => setModalInputs({ ...modalInputs, bankfee: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Currently: {adminConstants.bank_conversion_rate}%</p>
                  </div>

                  {/* Shipping */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">🚚 Shipping per 1000g (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.shipping}
                      onChange={(e) => setModalInputs({ ...modalInputs, shipping: e.target.value })}
                      placeholder="e.g. 950"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Currently: ₹{adminConstants.shipping_charge_per_kg}</p>
                  </div>

                  {/* Commission Rate */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">💰 Commission Rate (%)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.commission}
                      onChange={(e) => setModalInputs({ ...modalInputs, commission: e.target.value })}
                      placeholder="e.g. 25"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Currently: {adminConstants.commission_rate}%</p>
                  </div>

                  {/* Packing Cost - Full Width */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">📦 Packing Cost (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.packingcost}
                      onChange={(e) => setModalInputs({ ...modalInputs, packingcost: e.target.value })}
                      placeholder="e.g. 25"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-1">Currently: ₹{adminConstants.packing_cost}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex items-center justify-end gap-3 rounded-b-xl">
                  <button onClick={() => setIsConstantsModalOpen(false)} className="px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 border border-slate-700 font-medium transition-colors">Cancel</button>
                  <button onClick={saveAdminConstants} disabled={isSavingConstants} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all">
                    {isSavingConstants ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Save & Apply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Toast Notification */}
      {
        toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )
      }

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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRemark(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-slate-700 overflow-hidden pointer-events-auto"
              >
                <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
                  <h2 className="text-xl font-bold text-white">Remark Details</h2>
                  <button onClick={() => setSelectedRemark(null)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{selectedRemark}</p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-800 border-t border-slate-700 flex justify-end">
                  <button onClick={() => setSelectedRemark(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div >
  );
}
