'use client';

import { supabase } from '@/lib/supabaseClient';
import { bulkUpdateIndiaSkuFromFile } from '@/lib/utils/master-table/bulkSkuUpdate';
import { useState, useEffect, useRef } from 'react'
import Toast from '@/components/Toast';
import { History, X, Loader2, Upload, Download } from 'lucide-react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'framer-motion'
import { calculateProductValues, type CalculationConstants, type IndiaProductInput } from '@/lib/blackboxCalculations'
import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import { SELLER_STYLES } from '@/components/shared/SellerTag';

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
  buying_quantities?: Record<string, number> | null;
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
  purchase_currency?: string | null;
  sku?: string | null;
  amazon_category?: string | null;
  fulfillment_channel?: string | null;
  shipping_zone?: string | null;
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

const getDefaultConstants = (): CalculationConstants => ({
  dollar_rate: 96,
  bank_conversion_rate: 0.02,
  shipping_charge_per_kg: 1100,
  commission_rate: 0.25,
  packing_cost: 15,
  target_profit_percent: 10,
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
    case "MV": return "Maverick";
    case "KL": return "Kalash";
    default: return null;
  }
};

export default function AdminValidationPage() {
  const ensureURL = (url: string | null | undefined): string | undefined => {
    if (!url || !url.trim()) return undefined;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return 'https://' + trimmed;
  };
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { logActivity } = useActivityLogger();
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
  const [editingRemarkProductId, setEditingRemarkProductId] = useState<string | null>(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [skuUploading, setSkuUploading] = useState(false);
  const [skuUploadProgress, setSkuUploadProgress] = useState(0);
  const skuFileInputRef = useRef<HTMLInputElement>(null);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [openFunnelId, setOpenFunnelId] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
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
    targetprofit: '10',
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
      // ✅ FIX: Pending rows always win over confirmed/rejected
      let processedData = adminData;
      if (!showAllJourneys) {
        const latestByAsin = new Map();
        adminData.forEach(product => {
          const existing = latestByAsin.get(product.asin);
          if (!existing) {
            latestByAsin.set(product.asin, product);
            return;
          }

          const currentIsPending = product.admin_status === 'pending' || !product.admin_status;
          const existingIsPending = existing.admin_status === 'pending' || !existing.admin_status;

          if (currentIsPending && !existingIsPending) {
            latestByAsin.set(product.asin, product);
          } else if (!currentIsPending && existingIsPending) {
            // keep existing pending — don't replace
          } else {
            // Both same status type — newest created_at wins
            const currentDate = new Date(product.created_at).getTime();
            const existingDate = new Date(existing.created_at).getTime();
            if (currentDate > existingDate) {
              latestByAsin.set(product.asin, product);
            }
          }
        });
        processedData = Array.from(latestByAsin.values());
      }

      // 2️⃣ Get all ASINs
      const asins = adminData.map(p => p.asin)

      // 3️⃣ Batch fetch from BOTH tables
      const [purchaseResult, validationResult] = await Promise.all([
        supabase.from('india_purchases')
          .select('asin, journey_id, journey_number, buying_price, buying_quantity, buying_quantities, seller_link, seller_phone, payment_method, target_price, product_weight, usd_price, inr_purchase, funnel, seller_tag')
          .in('asin', asins),

        supabase.from('india_validation_main_file')
          .select('asin, current_journey_id, journey_number, seller_tag, funnel, product_weight, usd_price, inr_purchase, sku, amazon_category, fulfillment_channel, shipping_zone')
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
          buying_price: product.buying_price ?? purchase?.buying_price ?? null,
          buying_quantity: product.buying_quantity ?? purchase?.buying_quantity ?? null,
          buying_quantities: (() => {
            const fromAdmin = (product as any).buying_quantities;
            const fromPurchase = (purchase as any)?.buying_quantities;
            if (fromAdmin && typeof fromAdmin === 'object' && Object.keys(fromAdmin).length > 0) return fromAdmin;
            if (fromPurchase && typeof fromPurchase === 'object' && Object.keys(fromPurchase).length > 0) return fromPurchase;
            return null;
          })(),
          seller_link: product.seller_link ?? purchase?.seller_link ?? null,
          seller_phone: product.seller_phone ?? purchase?.seller_phone ?? null,
          payment_method: product.payment_method ?? purchase?.payment_method ?? null,

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
          amazon_category: validation?.amazon_category || null,
          fulfillment_channel: validation?.fulfillment_channel || 'Seller Flex',
          shipping_zone: validation?.shipping_zone || 'National',
        };
      });

      const usProducts = enrichedData.filter(p => p.origin_us === true);

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

  // Close funnel dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => {
      if (openFunnelId) {
        setOpenFunnelId(null);
        setDropdownPos(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openFunnelId]);

  useEffect(() => {
    const handleClickOutside = () => { if (isDownloadOpen) setIsDownloadOpen(false); };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDownloadOpen]);

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

      if (!error && data) {
        const parsed: CalculationConstants = {
          dollar_rate: Number(data.dollar_rate) || 96,
          bank_conversion_rate: Number(data.bank_conversion_rate) / 100 || 0.02,
          shipping_charge_per_kg: Number(data.shipping_charge_per_kg) || 1100,
          commission_rate: Number(data.commission_rate) / 100 || 0.25,
          packing_cost: Number(data.packing_cost) || 15,
          target_profit_percent: Number(data.target_profit_percent) || 10,
        };
        setModalInputs(prev => ({ ...prev, targetprofit: String(data.target_profit_percent || 10) }));

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
      setToast({ message: 'Failed to load history', type: 'error' })
    } finally {
      setHistoryLoading(false)
    }
  }


  const saveAdminConstants = async () => {
    setIsSavingConstants(true);
    try {
      // Modal inputs are user-friendly (2 for 2%, 25 for 25%)
      // Convert to blackbox format (decimals) for local state
      const newConstants: CalculationConstants = {
        ...adminConstants,
        dollar_rate: parseFloat(modalInputs.dollarrate) || adminConstants.dollar_rate,
        bank_conversion_rate: (parseFloat(modalInputs.bankfee) || adminConstants.bank_conversion_rate * 100) / 100,
        shipping_charge_per_kg: parseFloat(modalInputs.shipping) || adminConstants.shipping_charge_per_kg,
        commission_rate: (parseFloat(modalInputs.commission) || adminConstants.commission_rate * 100) / 100,
        packing_cost: parseFloat(modalInputs.packingcost) || adminConstants.packing_cost,
        target_profit_percent: parseFloat(modalInputs.targetprofit) || 10,
      };

      // Update local state immediately
      setAdminConstants(newConstants);

      const { data: existingData } = await supabase
        .from('india_admin_validation_constants')
        .select('id')
        .limit(1)
        .single();

      // DB stores whole numbers (2, 25), so convert back
      const payload = {
        dollar_rate: newConstants.dollar_rate,
        bank_conversion_rate: Math.round(newConstants.bank_conversion_rate * 100),
        shipping_charge_per_kg: newConstants.shipping_charge_per_kg,
        commission_rate: Math.round(newConstants.commission_rate * 100),
        packing_cost: newConstants.packing_cost,
        target_profit_percent: newConstants.target_profit_percent || 10,
      };


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
        message: `Saved! Commission: ${newConstants.commission_rate * 100}%, Bank: ${newConstants.bank_conversion_rate * 100}%, Shipping: ₹${newConstants.shipping_charge_per_kg}`,
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
    const buyingPrice = Number(product.buyingprice ?? product.buying_price);
    const weight = Number(product.productweight ?? product.product_weight);
    const sellingPriceINR = Number(product.targetprice ?? product.target_price);
    const currency = product.purchase_currency || 'USD';

    if (!buyingPrice || !weight || !sellingPriceINR) {
      return { total_cost: null, total_revenue: null, profit: null };
    }

    let result;
    if (currency === 'INR') {
      // Buying in INR, selling in INR — use fee-based calculation
      // Convert INR buying price to equivalent USD for the calculation engine
      const dollarRate = adminConstants.dollar_rate || 90;
      const equivalentUSD = buyingPrice / dollarRate;
      result = calculateProductValues(
        {
          usd_price: equivalentUSD,
          product_weight: weight,
          inr_purchase: sellingPriceINR,
          amazon_category: product.amazon_category || null,
          fulfillment_channel: product.fulfillment_channel || 'Seller Flex',
          shipping_zone: product.shipping_zone || 'National',
        } as IndiaProductInput,
        adminConstants,
        'INDIA'
      );
    } else {
      // Buying in USD, selling in INR — INDIA mode with fees
      result = calculateProductValues(
        {
          usd_price: buyingPrice,
          product_weight: weight,
          inr_purchase: sellingPriceINR,
          amazon_category: product.amazon_category || null,
          fulfillment_channel: product.fulfillment_channel || 'Seller Flex',
          shipping_zone: product.shipping_zone || 'National',
        } as IndiaProductInput,
        adminConstants,
        'INDIA'
      );
    }

    if (result.judgement === 'PENDING') {
      return { total_cost: null, total_revenue: null, profit: null };
    }

    return {
      total_cost: isFinite(result.total_cost) ? result.total_cost : null,
      total_revenue: isFinite(result.total_revenue) ? result.total_revenue : null,
      profit: isFinite(result.profit) ? result.profit : null,
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
    'target_price', 'admin_target_price',
    'funnel_qty', 'product_weight', 'profit', 'buying_price', 'buying_qty',
    'seller_link', 'seller_phone', 'payment_method', 'actions'
  ];

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLUMN_ORDER;
    try {
      const saved = localStorage.getItem('adminValidationColumnOrder_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = parsed.filter((k: string) => DEFAULT_COLUMN_ORDER.includes(k));
        DEFAULT_COLUMN_ORDER.forEach(k => { if (!merged.includes(k)) merged.push(k); });
        return merged;
      }
    } catch { }
    return DEFAULT_COLUMN_ORDER;
  });

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem('adminValidationHiddenColumns');
      if (saved) return new Set(JSON.parse(saved));
    } catch { }
    return new Set();
  });

  const [isColumnsDropdownOpen, setIsColumnsDropdownOpen] = useState(false);

  const toggleColumnVisibility = (col_key: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col_key)) next.delete(col_key);
      else next.add(col_key);
      localStorage.setItem('adminValidationHiddenColumns', JSON.stringify([...next]));
      return next;
    });
  };

  const COLUMN_LABELS: Record<string, string> = {
    asin: 'ASIN',
    sku: 'SKU',
    history: 'Journey #',
    remark: 'Remark',
    product_name: 'Product Name',
    product_link: 'Product Link',
    target_price: 'Sales Price INR',
    admin_target_price: 'Admin Target Price',
    funnel_qty: 'Funnel',
    funnel_seller: 'Seller Tag',
    product_weight: 'Product Weight',
    profit: 'Profit',
    buying_price: 'Purchase Price',
    buying_qty: 'Buying Qty',
    seller_link: 'Purchase Link',
    seller_phone: 'Seller Ph No.',
    payment_method: 'Payment Method',
    actions: 'Actions',
  };

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
    localStorage.setItem('adminValidationColumnOrder_v2', JSON.stringify(newOrder));
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


  const handleSendBackToPurchases = async () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Please select at least one product', type: 'error' });
      return;
    }

    const previousProducts = [...products];
    try {
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      const selectedProducts = products.filter(p => selectedIds.has(p.id));

      for (const product of selectedProducts) {
        // Reset flags in india_purchases
        let query = supabase
          .from('india_purchases')
          .update({ sent_to_admin: false, admin_confirmed: false })
          .eq('asin', product.asin);

        if (product.journey_id) {
          query = query.eq('journey_id', product.journey_id);
        }

        const { error: updateError } = await query;
        if (updateError) throw updateError;

        // Delete from india_admin_validation
        const { error: deleteError } = await supabase
          .from('india_admin_validation')
          .delete()
          .eq('id', product.id);

        if (deleteError) throw deleteError;

        logActivity({
          action: 'send_back',
          marketplace: 'india',
          page: 'admin-validation',
          table_name: 'india_admin_validation',
          asin: product.asin,
          details: { type: 'send_back_to_purchases', journey: product.journey_number }
        });
      }

      setToast({ message: `Sent ${selectedIds.size} products back to Purchases`, type: 'success' });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error: any) {
      setProducts(previousProducts);
      setToast({ message: `Error: ${error.message}`, type: 'error' });
    }
  };

  // Handle confirm selected products
  const handleConfirmSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Please select at least one product to confirm', type: 'error' });
      return;
    }

    const previousProducts = [...products];
    try {
      const selectedArray = Array.from(selectedIds);
      setProducts(prev => prev.map(p => selectedArray.includes(p.id) ? { ...p, admin_status: 'confirmed', confirmed_at: new Date().toISOString() } : p));
      const selectedProducts = products.filter(p => selectedIds.has(p.id));

      for (const product of selectedProducts) {
        // ✅ STEP 1: UPDATE india_purchases (existing workflow preserved)
        const bulkConfirmPayload: Record<string, any> = {
          admin_confirmed: true,
          admin_confirmed_at: new Date().toISOString(),
          admin_target_price: product.admin_target_price,
          buying_price: product.buying_price,
          buying_quantity: product.buying_quantity,
          seller_link: product.seller_link,
          seller_phone: product.seller_phone,
          payment_method: product.payment_method,
        };

        // Only overwrite buying_quantities if admin actually edited them
        if ((product as any).buying_quantities && Object.keys((product as any).buying_quantities).length > 0) {
          bulkConfirmPayload.buying_quantities = (product as any).buying_quantities;
        }

        let confirmSelected = supabase
          .from('india_purchases')
          .update(bulkConfirmPayload)
          .eq('asin', product.asin);

        // Use journey_id for precise matching when available
        if (product.journey_id) {
          confirmSelected = confirmSelected.eq('journey_id', product.journey_id);
        }

        const { data: updatedRows, error: updatePurchaseError } = await confirmSelected.select('id');

        if (updatePurchaseError) throw updatePurchaseError;

        // ✅ FIX: If no rows matched, purchases row was deleted — re-create it
        if (!updatedRows || updatedRows.length === 0) {
          console.warn(`⚠️ Bulk confirm: No purchases row for ${product.asin}, inserting...`);

          const originParts: string[] = [];
          if (product.origin_india) originParts.push('India');
          if (product.origin_china) originParts.push('China');
          if (product.origin_us) originParts.push('US');

          const { error: insertError } = await supabase
            .from('india_purchases')
            .insert({
              asin: product.asin,
              product_name: product.product_name,
              product_link: product.product_link,
              seller_tag: product.seller_tag,
              funnel: product.funnel ?? null,
              origin: originParts.join(', ') || 'India',
              origin_india: product.origin_india ?? false,
              origin_china: product.origin_china ?? false,
              origin_us: product.origin_us ?? false,
              inr_purchase_link: product.inr_purchase_link ?? null,
              buying_price: product.buying_price ?? null,
              buying_quantity: product.buying_quantity ?? null,
              buying_quantities: (product as any).buying_quantities ?? {},
              seller_link: product.seller_link ?? null,
              seller_phone: product.seller_phone ?? '',
              payment_method: product.payment_method ?? '',
              target_price: product.target_price ?? null,
              product_weight: product.product_weight ?? null,
              usd_price: product.usd_price ?? null,
              inr_purchase: product.inr_purchase ?? null,
              profit: product.profit ?? null,
              remark: product.remark ?? null,
              sku: product.sku ?? null,
              journey_id: product.journey_id ?? null,
              journey_number: product.journey_number ?? 1,
              status: 'pending',
              admin_confirmed: true,
              admin_confirmed_at: new Date().toISOString(),
              sent_to_admin: true,
              sent_to_admin_at: new Date().toISOString(),
            });

          if (insertError) throw insertError;
        }

        // ✅ STEP 2: UPDATE status in india_admin_validation (KEEP the product, don't delete)
        const { error: updateAdminError } = await supabase
          .from('india_admin_validation')
          .update({
            admin_status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateAdminError) throw updateAdminError;
      }

      setToast({ message: `Successfully confirmed ${selectedIds.size} products!`, type: 'success' });
      // ✅ ADD THIS:
      selectedProducts.forEach((product) => {
        logActivity({
          action: 'approved',
          marketplace: 'india',
          page: 'admin-validation',
          table_name: 'india_admin_validation',
          asin: product.asin,
          details: { type: 'bulk_confirm', journey: product.journey_number }
        });
      });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error: any) {
      setProducts(previousProducts);
      setToast({ message: `Error confirming products: ${error.message}`, type: 'error' });
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
        'purchase_currency': 'purchase_currency',
        'usdprice': 'usd_price',
        'inrpurchase': 'inr_purchase',
        'createdat': 'created_at',
      };

      const dbField = fieldMapping[field] || field;

      const updatePayload: Record<string, any> = { [dbField]: value };

      let calcResult: { total_cost: number | null; total_revenue: number | null; profit: number | null } =
        { total_cost: null, total_revenue: null, profit: null };

      if (field === 'targetprice' || field === 'productweight' || field === 'buyingprice' || field === 'purchase_currency') {
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
          if (field === 'sellerlink') updated.seller_link = value;
          if (field === 'productlink') updated.product_link = value;
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

  // ── Per-Seller Buying Quantity Edit (Admin) ──
  const handleAdminPerSellerQtyEdit = async (
    id: string,
    sellerTag: string,
    qty: number,
    product: AdminProduct
  ) => {
    try {
      const existing: Record<string, number> =
        (product.buying_quantities as Record<string, number>) ?? {};
      const updated = { ...existing, [sellerTag]: isNaN(qty) ? 0 : qty };

      // Sum all per-seller quantities
      const total = Object.values(updated)
        .reduce((sum, v) => sum + (Number(v) || 0), 0);

      // Update admin validation table
      const { error } = await supabase
        .from('india_admin_validation')
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

      setToast({
        message: `${sellerTag}: ${isNaN(qty) ? 0 : qty} | Total: ${total}`,
        type: 'success',
      });
    } catch (error: any) {
      console.error('Error updating per-seller quantity:', error.message);
      setToast({ message: 'Failed to update quantity', type: 'error' });
    }
  };

  const handleFunnelChange = async (id: string, newFunnel: string) => {
    const oldFunnel = products.find(p => p.id === id)?.funnel;

    // 1. Optimistic UI update
    setProducts(prev => prev.map(p => p.id === id ? { ...p, funnel: newFunnel } : p));
    setOpenFunnelId(null);
    setDropdownPos(null);

    try {
      // 2. Update india_purchases (funnel lives here, NOT in india_admin_validation)
      const product = products.find(p => p.id === id);
      if (!product) return;

      const { error: purchaseError } = await supabase
        .from('india_purchases')
        .update({ funnel: newFunnel })
        .eq('asin', product.asin);

      if (purchaseError) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, funnel: oldFunnel } : p));
        setToast({ message: 'Failed to update funnel', type: 'error' });
        return;
      }

      // 3. Also update india_validation_main_file
      await supabase
        .from('india_validation_main_file')
        .update({ funnel: newFunnel })
        .eq('asin', product.asin);

      setToast({ message: `Funnel changed to ${newFunnel}`, type: 'success' });
    } catch (err) {
      console.error('Funnel update error:', err);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, funnel: oldFunnel } : p));
      setToast({ message: 'Funnel update failed', type: 'error' });
    }
  };

  // =========================================================
  // ✅ ROBUST AUTO-DISTRIBUTE (Handles Typos & MULTIPLE TAGS)
  // =========================================================
  const handleConfirmProduct = async (productId: string) => {
    const previousProducts = [...products];
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      setMovementHistory((prev) => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.admin_status,
          toStatus: 'confirmed',
        },
      }));

      setProducts(prev => prev.map(p => p.id === productId ? { ...p, admin_status: 'confirmed', confirmed_at: new Date().toISOString() } : p));
      const cleanAsin = product.asin.trim();

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
        setToast({ message: "Error: Missing Seller Tag. Please check product data.", type: 'error' });
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

      // ✅ Listing error data comes from Checking stage (after full pipeline)
      // Admin confirm only marks purchases as confirmed

      // 6. Update FINAL Statuses (Once per product)
      const confirmPayload: Record<string, any> = {
        admin_confirmed: true,
        admin_confirmed_at: new Date().toISOString(),
        admin_target_price: product.admin_target_price,
        buying_price: product.buying_price,
        buying_quantity: product.buying_quantity,
        seller_link: product.seller_link,
        seller_phone: product.seller_phone,
        payment_method: product.payment_method,
        sku: product.sku ?? null,
      };

      // Only overwrite buying_quantities if admin actually has data
      if (product.buying_quantities && Object.keys(product.buying_quantities).length > 0) {
        confirmPayload.buying_quantities = product.buying_quantities;
      }

      // ✅ FIX: Try UPDATE first, then INSERT if row doesn't exist
      let confirmQuery = supabase
        .from('india_purchases')
        .update(confirmPayload)
        .eq('asin', cleanAsin);

      if (product.journey_id) {
        confirmQuery = confirmQuery.eq('journey_id', product.journey_id);
      }

      const { data: updatedRows, error: purchaseUpdateError } = await confirmQuery.select('id');

      if (purchaseUpdateError) {
        console.error('❌ Failed to update india_purchases:', purchaseUpdateError);
        throw new Error(`Failed to update purchases: ${purchaseUpdateError.message}`);
      }

      // ✅ FIX: If no rows were updated, the purchases row was deleted.
      // Re-create it from admin_validation data so it appears in the Confirmed tab.
      if (!updatedRows || updatedRows.length === 0) {
        console.warn(`⚠️ No purchases row found for ${cleanAsin}, inserting from admin data...`);

        const originParts: string[] = [];
        if (product.origin_india) originParts.push('India');
        if (product.origin_china) originParts.push('China');
        if (product.origin_us) originParts.push('US');

        const { error: insertError } = await supabase
          .from('india_purchases')
          .insert({
            asin: cleanAsin,
            product_name: product.product_name,
            product_link: product.product_link,
            seller_tag: rawSellerTag,
            funnel: rawFunnel,
            origin: originParts.join(', ') || 'India',
            origin_india: product.origin_india ?? false,
            origin_china: product.origin_china ?? false,
            origin_us: product.origin_us ?? false,
            inr_purchase_link: product.inr_purchase_link ?? null,
            buying_price: product.buying_price ?? null,
            buying_quantity: product.buying_quantity ?? null,
            buying_quantities: product.buying_quantities ?? {},
            seller_link: product.seller_link ?? null,
            seller_phone: product.seller_phone ?? '',
            payment_method: product.payment_method ?? '',
            target_price: product.target_price ?? null,
            product_weight: product.product_weight ?? null,
            usd_price: product.usd_price ?? null,
            inr_purchase: product.inr_purchase ?? null,
            profit: product.profit ?? null,
            remark: product.remark ?? null,
            sku: product.sku ?? null,
            journey_id: product.journey_id ?? null,
            journey_number: product.journey_number ?? 1,
            status: 'pending',
            admin_confirmed: true,
            admin_confirmed_at: new Date().toISOString(),
            sent_to_admin: true,
            sent_to_admin_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('❌ Failed to insert into india_purchases:', insertError);
          throw new Error(`Failed to create purchases row: ${insertError.message}`);
        }
      }

      await supabase.from('india_admin_validation').update({
        admin_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }).eq('id', productId);

      fetchProducts();

      setToast({ message: `Success! Product confirmed and sent to Purchases.`, type: 'success' });
      // ✅ ADD THIS:
      logActivity({
        action: 'approved',
        marketplace: 'india',
        page: 'admin-validation',
        table_name: 'india_admin_validation',
        asin: cleanAsin,
        details: { funnel: finalFunnelId }
      });

    } catch (error: any) {
      setProducts(previousProducts);
      console.error(error);
      setToast({ message: `Error: ${error.message}`, type: 'error' });
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
      // ✅ ADD THIS:
      logActivity({
        action: 'rejected',
        marketplace: 'india',
        page: 'admin-validation',
        table_name: 'india_admin_validation',
        asin: product.asin,
        details: { journey: product.journey_number }
      });

    } catch (error: any) {
      setToast({ message: `Error rejecting product: ${error.message}`, type: 'error' });
    }
  };

  // ✅ ADD: Roll Back last movement
  const handleRollBack = async () => {
    // Always use activeTab as the key where movements are saved
    const lastMovement = movementHistory[activeTab];

    if (!lastMovement) {
      setToast({ message: 'No recent movement to roll back from this tab', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { product, fromStatus, toStatus } = lastMovement;

      if (toStatus === 'confirmed') {
        // Rolling back from Confirm
        // 1. Revert india_purchases
        let purchaseRollbackQuery = supabase
          .from('india_purchases')
          .update({
            admin_confirmed: false,
            admin_confirmed_at: null,
          })
          .eq('asin', product.asin);
        if (product.journey_id) {
          purchaseRollbackQuery = purchaseRollbackQuery.eq('journey_id', product.journey_id);
        }
        const { error: updatePurchaseError } = await purchaseRollbackQuery;

        if (updatePurchaseError) {
          console.error('Error rolling back india_purchases:', updatePurchaseError);
        }

        // ✅ No listing error cleanup needed — admin confirm no longer inserts there

        // 2. Revert india_admin_validation status
        let adminRollbackQuery = supabase
          .from('india_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            confirmed_at: null,
          })
          .eq('asin', product.asin);
        if (product.journey_id) {
          adminRollbackQuery = adminRollbackQuery.eq('journey_id', product.journey_id);
        }
        const { error: updateAdminError } = await adminRollbackQuery;

        if (updateAdminError) throw updateAdminError;

      } else if (toStatus === 'rejected') {
        // Rolling back from Reject
        let adminRejectQuery = supabase
          .from('india_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            rejected_at: null,
          })
          .eq('asin', product.asin);
        if (product.journey_id) {
          adminRejectQuery = adminRejectQuery.eq('journey_id', product.journey_id);
        }
        const { error: updateAdminError } = await adminRejectQuery;

        if (updateAdminError) throw updateAdminError;
      }

      // Clear history for this tab
      setMovementHistory((prev) => {
        const newHistory = { ...prev };
        delete newHistory[activeTab];
        return newHistory;
      });

      setToast({ message: `Rolled back ${product.product_name}`, type: 'success' });
      // ✅ ADD THIS:
      logActivity({
        action: 'rollback',
        marketplace: 'india',
        page: 'admin-validation',
        table_name: 'india_admin_validation',
        asin: product.asin,
        details: { from_status: toStatus, restored_to: fromStatus || 'pending' }
      });
      fetchProducts();
    } catch (error) {
      console.error('Error rolling back:', error);
      setToast({ message: 'Rollback failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ─── CSV Download Helpers ───
  const flattenProductForCSV = (p: AdminProduct) => ({
    id: p.id,
    asin: p.asin,

    product_name: p.product_name ?? '',
    product_link: p.product_link ?? '',

    usd_price: p.usd_price ?? '',
    target_price: p.target_price ?? '',
    admin_target_price: p.admin_target_price ?? '',
    buying_price: p.buying_price ?? '',
    inr_purchase: p.inr_purchase ?? '',
    inr_purchase_link: p.inr_purchase_link ?? '',

    // You commented this out in the type, so keep it out or add it back to AdminProduct
    // target_quantity: p.target_quantity ?? '',

    buying_quantity: p.buying_quantity ?? '',
    buying_quantities: p.buying_quantities
      ? JSON.stringify(p.buying_quantities)
      : '{}',

    product_weight: p.product_weight ?? '',
    total_cost: p.total_cost ?? '',
    total_revenue: p.total_revenue ?? '',
    profit: p.profit ?? '',

    funnel: p.funnel ?? '',
    seller_tag: p.seller_tag ?? '',
    seller_link: p.seller_link ?? '',
    seller_phone: p.seller_phone ?? '',

    admin_status: p.admin_status ?? '',
    status: p.status ?? '',
    admin_notes: p.admin_notes ?? '',

    origin_india: p.origin_india ?? false,
    origin_china: p.origin_china ?? false,
    origin_us: p.origin_us ?? false,

    purchase_currency: p.purchase_currency ?? '',
    payment_method: p.payment_method ?? '',

    journey_id: p.journey_id ?? '',
    journey_number: p.journey_number ?? 1,

    remark: p.remark ?? '',
    sku: p.sku ?? '',

    created_at: p.created_at ?? '',
  });

  const downloadCSV = (data: AdminProduct[], filename: string) => {
    if (data.length === 0) {
      setToast({ message: 'No data to download', type: 'warning' });
      return;
    }
    const csv = Papa.unparse(data.map(flattenProductForCSV));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Downloaded ${data.length} rows as ${filename}`, type: 'success' });
  };

  const handleDownloadCurrentPage = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(filteredProducts, `india-admin-${activeTab}-page-${timestamp}.csv`);
    setIsDownloadOpen(false);
  };

  const handleDownloadAllData = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(products.filter((product) => {
      // Apply same tab filter as filteredProducts
      switch (activeTab) {
        case 'india': return product.origin_india === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
        case 'china': return product.origin_china === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
        case 'us': return product.origin_us === true && product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
        case 'pending': return product.admin_status === 'pending' || !product.admin_status;
        case 'confirm': return product.admin_status === 'confirmed';
        case 'reject': return product.admin_status === 'rejected';
        case 'overview': default: return product.admin_status !== 'confirmed' && product.admin_status !== 'rejected';
      }
    }), `india-admin-${activeTab}-all-${timestamp}.csv`);
    setIsDownloadOpen(false);
  };


  // Bulk SKU Upload Handler
  const handleSkuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be re-uploaded
    if (skuFileInputRef.current) skuFileInputRef.current.value = '';

    setSkuUploading(true);
    setSkuUploadProgress(0);

    try {
      const result = await bulkUpdateIndiaSkuFromFile(file, (progress) => {
        setSkuUploadProgress(progress);
      });

      const messages: string[] = [
        `✅ SKU Update Complete`,
        `Rows processed: ${result.inputCount}`,
        `ASINs updated: ${result.effectiveAsinCount}`,
        `Total DB rows touched: ${result.updatedCount}`,
      ];
      if (result.duplicateAsinCount > 0) {
        messages.push(`⚠️ Duplicate ASINs skipped: ${result.duplicateAsinCount}`);
      }
      if (result.emptySkuRowCount > 0) {
        messages.push(`⚠️ Empty SKU rows skipped: ${result.emptySkuRowCount}`);
      }

      setToast({ message: messages.join(' | '), type: 'success' });

      logActivity({
        action: 'bulk_sku_update',
        marketplace: 'india',
        page: 'admin-validation',
        table_name: 'all_india_tables',
        asin: `batch_${result.effectiveAsinCount}`,
        details: {
          input_count: result.inputCount,
          effective: result.effectiveAsinCount,
          duplicates: result.duplicateAsinCount,
          empty_sku: result.emptySkuRowCount,
          db_rows_updated: result.updatedCount,
        },
      });

      // Refresh table to show new SKUs
      fetchProducts(false);
    } catch (err: any) {
      console.error('SKU Upload Error:', err);
      setToast({ message: `SKU Upload Failed: ${err.message}`, type: 'error' });
    } finally {
      setSkuUploading(false);
      setSkuUploadProgress(0);
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

      case 'funnel_qty':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            <div className="relative">
              <button
                onClick={(e) => {
                  if (openFunnelId === product.id) {
                    setOpenFunnelId(null);
                    setDropdownPos(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const dropdownHeight = 140;
                    const top = spaceBelow < dropdownHeight
                      ? rect.top - dropdownHeight - 4
                      : rect.bottom + 4;
                    setDropdownPos({ top, left: rect.left });
                    setOpenFunnelId(product.id);
                  }
                }}
                className="group/funnel relative cursor-pointer transition-all hover:scale-110"
                title="Click to change funnel"
              >
                {/* Funnel badge */}
                <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-xs ${product.funnel === 1 || product.funnel === '1' || product.funnel === 2 || product.funnel === '2' ||
                  String(product.funnel).toUpperCase() === 'HD' || String(product.funnel).toUpperCase() === 'LD' || String(product.funnel).toUpperCase() === 'RS'
                  ? 'bg-emerald-600 text-white'
                  : product.funnel === 3 || product.funnel === '3' || String(product.funnel).toUpperCase() === 'DP'
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-600 text-white'
                  }`}>
                  {product.funnel === 1 || product.funnel === '1' || product.funnel === 2 || product.funnel === '2' ||
                    String(product.funnel).toUpperCase() === 'HD' || String(product.funnel).toUpperCase() === 'LD' || String(product.funnel).toUpperCase() === 'RS'
                    ? 'RS'
                    : product.funnel === 3 || product.funnel === '3' || String(product.funnel).toUpperCase() === 'DP'
                      ? 'DP'
                      : product.funnel ?? '-'}
                </span>

                {/* Edit indicator on hover */}
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-orange-400 rounded-full flex items-center justify-center opacity-0 group-hover/funnel:opacity-100 transition-opacity shadow-lg">
                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </span>
              </button>

              {/* Dropdown */}
              {openFunnelId === product.id && dropdownPos && (
                <div style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 9999 }}
                  className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-1.5 min-w-[120px] animate-in fade-in zoom-in-95 duration-150">
                  {['RS', 'DP'].map(f => (
                    <button
                      key={f}
                      onClick={() => handleFunnelChange(product.id, f)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${(product.funnel === f || String(product.funnel).toUpperCase() === f)
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'text-gray-500 hover:bg-[#111111] hover:text-white'
                        }`}
                    >
                      <span className={`w-6 h-6 inline-flex items-center justify-center rounded-lg font-bold text-xs ${f === 'RS' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-black'
                        }`}>{f}</span>
                      <span>{f === 'RS' ? 'Restock' : 'Dropshipping'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </td>
        );

      case 'asin':
        return (
          <td key={col_key} className="px-6 py-4 text-sm text-gray-300 font-mono tracking-tight">
            {product.asin}
          </td>
        );

      case 'sku':
        return (
          <td key={col_key} className="px-6 py-4 text-sm overflow-hidden" style={{ maxWidth: columnWidths.sku || 100, width: columnWidths.sku || 100 }}>
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
                  <span className="text-gray-100 text-xs truncate" title={product.sku}>{product.sku}</span>
                  <button
                    onClick={() => { setEditingSkuId(product.id); setEditingSkuValue(product.sku || ''); }}
                    className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0"
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
          <td key={col_key} className="px-6 py-4 text-center bg-amber-500/10">
            <button
              onClick={() => fetchHistory(product.asin)}
              className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-white/[0.08] hover:text-orange-400 hover:border-indigo-400/50 transition-all cursor-pointer"
              title={`Journey ${product.journey_number || 1} — Click to view history`}
            >
              <span>{product.journey_number || 1}</span>
              <History className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
            </button>
          </td>
        );

      case 'remark':
        return (
          <td key={col_key} className="px-6 py-4" style={{ width: columnWidths.remark }}>
            {product.remark ? (
              <button onClick={() => { setSelectedRemark(product.remark); setEditingRemarkText(product.remark || ''); setEditingRemarkProductId(product.id); }} className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors">
                View
              </button>
            ) : (
              <button onClick={() => { setSelectedRemark(' '); setEditingRemarkText(''); setEditingRemarkProductId(product.id); }} className="text-gray-300 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>
            )}
          </td>
        );

      case 'product_name':
        return (
          <td key={col_key} className="px-6 py-4 text-sm text-gray-100" style={{ maxWidth: columnWidths.productname, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={product.product_name || '-'}>
            {product.product_name || '-'}
          </td>
        );

      case 'product_link':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            <div className="w-32">
              {editingLinkId === product.id ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={editingLinkValue} onChange={(e) => setEditingLinkValue(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
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
                      <a href={ensureURL(product.product_link)} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap">View Link</a>
                      <button onClick={() => { setEditingLinkId(product.id); setEditingLinkValue(product.product_link || ''); }} className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0" title="Edit link">
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
          <td key={col_key} className="px-6 py-4">
            <input type="number" defaultValue={product.target_price}
              onBlur={(e) => { const v = parseFloat(e.target.value); if (v !== product.target_price) handleCellEdit(product.id, 'targetprice', v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </td>
        );

      // case 'target_qty':
      //   return (
      //     <td key={col_key} className="px-6 py-4">
      //       <input type="number" defaultValue={product.target_quantity}
      //         onChange={(e) => handleCellEdit(product.id, 'targetquantity', parseInt(e.target.value))}
      //         className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
      //       />
      //     </td>
      //   );

      case 'admin_target_price':
        return (
          <td key={col_key} className="px-6 py-4 bg-purple-900/10">
            <input type="number" step="0.01" defaultValue={product.admin_target_price ?? ''}
              onBlur={(e) => { const v = e.target.value === '' ? null : parseFloat(e.target.value); if (v !== product.admin_target_price) handleCellEdit(product.id, 'admintargetprice', v); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-24 px-2 py-1.5 bg-[#111111] border border-purple-500/50 rounded text-sm text-purple-200 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-purple-400/50"
              placeholder="₹"
            />
          </td>
        );

      case 'funnel_seller':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            {product.seller_tag ? (
              <div className="flex flex-wrap gap-2">
                {product.seller_tag.split(',').map((tag) => {
                  const cleanTag = tag.trim();
                  return (
                    <span key={cleanTag} className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-slate-600 text-white'}`}>
                      {cleanTag}
                    </span>
                  );
                })}
              </div>
            ) : (<span className="text-xs text-gray-300 italic">-</span>)}
          </td>
        );

      case 'product_weight':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            <div className="relative">
              <input type="number" step="0.01" defaultValue={product.product_weight}
                onBlur={(e) => { const v = parseFloat(e.target.value) || null; if (v !== product.product_weight) handleCellEdit(product.id, 'productweight', v); }}
                className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="g"
              />
              {calculatingIds.has(product.id) && (
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-500 border-t-transparent"></div>
                </div>
              )}
            </div>
          </td>
        );

      case 'profit':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            <div className="flex flex-col gap-1">
              <div className={`w-full min-w-[6rem] px-2 py-1 border rounded text-sm font-bold text-center truncate ${(product.profit ?? 0) >= 0
                ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30'
                : 'text-rose-400 bg-rose-500/20 border-rose-500/30'
                }`}>
                {product.profit != null ? `₹${product.profit.toFixed(2)}` : '-'}
              </div>
              <div className="flex gap-2 text-[10px] text-gray-500 justify-center">
                <span title="Total Cost">C: {product.total_cost != null ? `₹${product.total_cost.toFixed(0)}` : '-'}</span>
                <span title="Total Revenue">R: {product.total_revenue != null ? `₹${product.total_revenue.toFixed(0)}` : '-'}</span>
              </div>
            </div>
          </td>
        );

      case 'buying_price':
        return (
          <td key={col_key} className="px-6 py-4">
            <div className="flex items-center gap-1">
              <select
                value={product.purchase_currency || 'INR'}
                onChange={(e) => handleCellEdit(product.id, 'purchase_currency', e.target.value)}
                className="w-12 px-1 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500"
              >
                <option value="INR">₹</option>
                <option value="USD">$</option>
              </select>
              <input type="number" defaultValue={product.buying_price}
                onBlur={(e) => { const v = parseFloat(e.target.value); if (v !== product.buying_price) handleCellEdit(product.id, 'buyingprice', v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </td>
        );

      case 'buying_qty': {
        // Extract seller tags
        const qtyTags: string[] = product.seller_tag
          ? product.seller_tag.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];

        const perQty: Record<string, number> =
          (product.buying_quantities as Record<string, number>) ?? {};

        const hasMultiSeller = qtyTags.length > 1;

        const tagColors: Record<string, string> = {
          GR: 'bg-yellow-500 text-black border-yellow-600',
          RR: 'bg-slate-500 text-white border-white/[0.1]',
          UB: 'bg-pink-500 text-white border-pink-600',
          VV: 'bg-purple-500 text-white border-purple-600',
          DE: 'bg-cyan-500 text-black border-cyan-600',
          CV: 'bg-teal-500 text-white border-teal-600',
          MV: 'bg-orange-600 text-white border-orange-700',
          KL: 'bg-lime-500 text-black border-lime-600',
        };

        // ── Single seller → original single input (unchanged) ──
        if (!hasMultiSeller) {
          const singleTag = qtyTags[0] || '';
          return (
            <td key={col_key} className="px-6 py-4">
              <div className="flex items-center gap-1">
                {singleTag && (
                  <span className={`w-6 h-5 flex items-center justify-center rounded text-[10px] font-bold flex-shrink-0 border ${tagColors[singleTag] ?? 'bg-[#1a1a1a] text-white border-white/[0.1]'}`}>
                    {singleTag}
                  </span>
                )}
                <input type="number"
                  key={`${product.id}-single-${product.buying_quantity ?? ''}`}
                  defaultValue={product.buying_quantity ?? ''}
                  onChange={(e) => handleCellEdit(product.id, 'buyingquantity', parseInt(e.target.value))}
                  className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </td>
          );
        }

        // ── Multiple sellers → per-seller editable inputs ──
        const currentTotal = Object.values(perQty)
          .reduce((s, v) => s + (Number(v) || 0), 0);

        return (
           <td key={col_key} className="px-3 py-3" style={{ minWidth: 280 }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {qtyTags.map((tag: string) => (
                <div key={tag} className="flex items-center gap-1">
                  <span
                    className={`w-7 h-5 flex items-center justify-center rounded text-[10px] font-bold flex-shrink-0 border ${tagColors[tag] ?? 'bg-[#1a1a1a] text-white border-white/[0.1]'
                      }`}
                  >
                    {tag}
                  </span>
                  <input
                    type="number"
                    ref={(el) => {
                      if (el && perQty[tag] !== undefined && perQty[tag] !== null) {
                        el.value = String(perQty[tag]);
                      }
                    }}
                    onBlur={(e) =>
                      handleAdminPerSellerQtyEdit(
                        product.id,
                        tag,
                        parseInt(e.target.value),
                        product
                      )
                    }
                    className="w-20 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                    placeholder="Qty"
                  />
                </div>
              ))}
              <div className="col-span-2 border-t border-white/[0.1] pt-1 mt-0.5 flex items-center gap-1">
                <span className="text-[10px] text-gray-300 font-medium">Total:</span>
                <span className="text-[11px] text-gray-500 font-bold">
                  {currentTotal || '—'}
                </span>
              </div>
            </div>
          </td>
        );
      }

      case 'seller_link':
        return (
          <td key={col_key} className="px-6 py-4 text-sm">
            <div className="w-32">
              {editingLinkId === `seller_${product.id}` ? (
                <div className="flex items-center gap-1">
                  <input type="text" value={editingLinkValue} onChange={(e) => setEditingLinkValue(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
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
                      <a href={ensureURL(product.seller_link)} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap">View Link</a>
                      <button onClick={() => { setEditingLinkId(`seller_${product.id}`); setEditingLinkValue(product.seller_link || ''); }} className="text-gray-300 hover:text-amber-500 transition-colors flex-shrink-0">
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
          <td key={col_key} className="px-6 py-4">
            <input type="text" defaultValue={product.seller_phone}
              onChange={(e) => handleCellEdit(product.id, 'sellerphone', e.target.value)}
              className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Phone"
            />
          </td>
        );

      case 'payment_method':
        return (
          <td key={col_key} className="px-6 py-4">
            <input type="text" defaultValue={product.payment_method}
              onChange={(e) => handleCellEdit(product.id, 'paymentmethod', e.target.value)}
              className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Method"
            />
          </td>
        );

      case 'actions':
        if (activeTab === 'confirm' || activeTab === 'reject') return null;
        return (
          <td key={col_key} className="px-6 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfirmProduct(product.id)}
                disabled={product.admin_status === 'confirmed'}
                className={`p-2 rounded-lg transition-all ${product.admin_status === 'confirmed'
                  ? 'bg-emerald-500/20 text-emerald-600 cursor-not-allowed border border-emerald-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20'}`}
                title="Confirm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button
                onClick={() => handleRejectProduct(product.id)}
                disabled={product.admin_status === 'rejected'}
                className={`p-2 rounded-lg transition-all ${product.admin_status === 'rejected'
                  ? 'bg-rose-500/20 text-rose-600 cursor-not-allowed border border-rose-500/30'
                  : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20'}`}
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
    <div className="h-screen flex flex-col overflow-hidden bg-[#111111] p-3 sm:p-4 lg:p-6 text-gray-100 font-sans selection:bg-orange-400/30">
      <div className="w-full flex flex-col flex-1 overflow-hidden">

        {/* Header Section */}
        <div className="flex-none mb-3 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold text-white">Admin Validation</h1>
          <p className="text-gray-400 mt-1 text-xs sm:text-sm">Review and manage product pricing and profitability</p>
        </div>

        {/* Tabs - STICKY */}
        <div className="flex-none flex gap-1.5 sm:gap-2 mb-3 sm:mb-5 overflow-x-auto p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-full sm:w-fit scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', count: products.filter(p => p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length, color: 'text-orange-500', activeBg: 'bg-orange-500/10' },
            { id: 'india', label: 'India', count: indiaCount, color: 'text-orange-400', activeBg: 'bg-orange-500/10' },
            { id: 'china', label: 'China', count: chinaCount, color: 'text-rose-400', activeBg: 'bg-rose-500/20' },
            { id: 'us', label: 'US', count: usCount, color: 'text-sky-400', activeBg: 'bg-sky-500/20' },
            { id: 'pending', label: 'Pending', count: pendingCount, color: 'text-amber-400', activeBg: 'bg-amber-500/20' },
            { id: 'confirm', label: 'Confirmed', count: confirmedCount, color: 'text-emerald-400', activeBg: 'bg-emerald-500/20' },
            { id: 'reject', label: 'Rejected', count: rejectedCount, color: 'text-rose-400', activeBg: 'bg-rose-500/20' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all relative overflow-hidden whitespace-nowrap ${activeTab === tab.id
                ? `bg-orange-500 text-white font-semibold shadow-sm`
                : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
                }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full bg-[#1a1a1a] border border-white/[0.1] ${tab.color}`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {false && (
                <div className={`absolute inset-0 opacity-10 ${tab.activeBg}`} />
              )}
            </button>
          ))}
        </div>

        {/* Search Bar & Buttons */}
        <div className="flex-none mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
          {/* Left: Search Input */}
          <div className="relative flex-1 w-full md:max-w-md group">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ASIN, Product Name, SKU, or Funnel Seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600 transition-all shadow-sm text-sm"
            />
          </div>

          {/* Right: Buttons Group */}
         <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto scrollbar-none [&>*]:flex-shrink-0 [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs">

            {/* Funnel Filter Pills - RS / DP */}
            <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
              {(['ALL', 'RS', 'DP'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setFunnelFilter(opt)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${funnelFilter === opt
                    ? opt === 'RS' ? 'bg-emerald-600 text-white shadow-lg'
                      : opt === 'DP' ? 'bg-amber-500 text-black shadow-lg'
                        : 'bg-orange-500 text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-200'
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
                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-indigo-900/30'
                  : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
                {(originFilter !== 'ALL' || adminStatusFilter !== 'ALL' || remarkFilter !== 'ALL') && (
                  <span className="w-5 h-5 bg-[#111111]/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {[originFilter !== 'ALL', adminStatusFilter !== 'ALL', remarkFilter !== 'ALL'].filter(Boolean).length}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsFilterOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-4 z-20 w-72">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-100 text-sm">Filters</h3>
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
                      <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Origin</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ALL', 'India', 'China', 'US'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setOriginFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${originFilter === opt
                              ? opt === 'India' ? 'bg-orange-500 text-white'
                                : opt === 'China' ? 'bg-rose-500 text-white'
                                  : opt === 'US' ? 'bg-sky-500 text-white'
                                    : 'bg-orange-500 text-white'
                              : 'bg-[#111111] text-gray-400 hover:bg-[#1a1a1a] border border-white/[0.1]'
                              }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Admin Status Filter */}
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Status</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['ALL', 'pending', 'confirmed', 'rejected'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setAdminStatusFilter(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${adminStatusFilter === opt
                              ? opt === 'pending' ? 'bg-amber-500 text-black'
                                : opt === 'confirmed' ? 'bg-emerald-500 text-white'
                                  : opt === 'rejected' ? 'bg-rose-500 text-white'
                                    : 'bg-orange-500 text-white'
                              : 'bg-[#111111] text-gray-400 hover:bg-[#1a1a1a] border border-white/[0.1]'
                              }`}
                          >
                            {opt === 'ALL' ? 'All' : opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Remark Filter */}
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">Remark</label>
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
                                  : 'bg-orange-500 text-white'
                              : 'bg-[#111111] text-gray-400 hover:bg-[#1a1a1a] border border-white/[0.1]'
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

            {/* Hide Columns Button + Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsColumnsDropdownOpen(!isColumnsDropdownOpen)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border shadow-lg ${hiddenColumns.size > 0
                  ? 'bg-orange-500 text-white border-orange-500/50 shadow-orange-500/10'
                  : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                <span className="hidden sm:inline">Columns</span>
                {hiddenColumns.size > 0 && (
                  <span className="w-5 h-5 bg-[#111111]/20 rounded-full text-[10px] flex items-center justify-center font-bold">
                    {hiddenColumns.size}
                  </span>
                )}
              </button>

              {isColumnsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsColumnsDropdownOpen(false)} />
                  <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl p-3 z-20 w-64 max-h-80 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-100 text-sm">Toggle Columns</h3>
                      {hiddenColumns.size > 0 && (
                        <button
                          onClick={() => { setHiddenColumns(new Set()); localStorage.removeItem('adminValidationHiddenColumns'); }}
                          className="text-[10px] text-orange-500 hover:text-orange-400"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {DEFAULT_COLUMN_ORDER.filter(k => k !== 'actions').map(col_key => (
                        <label
                          key={col_key}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#111111] cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!hiddenColumns.has(col_key)}
                            onChange={() => toggleColumnVisibility(col_key)}
                            className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer w-3.5 h-3.5"
                          />
                          <span className={`text-xs font-medium ${hiddenColumns.has(col_key) ? 'text-gray-500' : 'text-gray-100'}`}>
                            {COLUMN_LABELS[col_key] || col_key}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Roll Back Button */}
            <button
              onClick={handleRollBack}
              disabled={!movementHistory[activeTab]}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-xs sm:text-sm font-medium shadow-lg shadow-amber-900/20 transition-all border border-amber-500/50"
              title="Roll Back last action from this tab (Ctrl+Z)"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="hidden sm:inline">Roll Back</span>
            </button>

            {/* 🆕 NEW: Toggle Button for All Journeys */}
            <button
              onClick={() => setShowAllJourneys(!showAllJourneys)}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-all border shadow-lg ${showAllJourneys
                ? 'bg-orange-500 text-white hover:bg-orange-400 border-orange-500/50 shadow-orange-500/10'
                : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
                }`}
              title={`Currently showing: ${showAllJourneys ? 'All journey cycles' : 'Latest journey only'}`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">{showAllJourneys ? 'Show Latest Only' : 'Show All Journeys'}</span>
            </button>

            {/* Configure Constants Button */}
            {/* Hidden file input for SKU upload */}
            <input
              type="file"
              accept=".csv"
              ref={skuFileInputRef}
              onChange={handleSkuUpload}
              className="hidden"
            />

            {/* Bulk SKU Upload Button */}
            <button
              onClick={() => skuFileInputRef.current?.click()}
              disabled={skuUploading}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border shadow-lg ${skuUploading
                ? 'bg-cyan-800 text-cyan-200 border-cyan-700 cursor-wait'
                : 'bg-cyan-600 text-white hover:bg-cyan-500 border-cyan-500/50 shadow-cyan-900/20'
                }`}
              title="Upload CSV with asin,sku columns to bulk-update SKU across all India tables"
            >
              {skuUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Updating SKUs...</span> {skuUploadProgress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Upload SKU</span>
                </>
              )}
            </button>

            {/* Download CSV Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsDownloadOpen(!isDownloadOpen); }}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all border shadow-lg bg-purple-600 text-white hover:bg-purple-500 border-purple-500/50 shadow-purple-900/20"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download CSV</span>
              </button>

              {isDownloadOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <button
                    onClick={handleDownloadCurrentPage}
                    className="w-full px-4 py-3 text-left text-sm text-gray-100 hover:bg-[#1a1a1a] transition-colors flex items-center gap-3"
                  >
                    <Download className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-medium">Current Page</div>
                      <div className="text-xs text-gray-400">{filteredProducts.length} rows</div>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadAllData}
                    className="w-full px-4 py-3 text-left text-sm text-gray-100 hover:bg-[#1a1a1a] transition-colors flex items-center gap-3 border-t border-white/[0.1]"
                  >
                    <Download className="w-4 h-4 text-purple-400" />
                    <div>
                      <div className="font-medium">All Data (This Tab)</div>
                      <div className="text-xs text-gray-400">
                        {activeTab === 'confirm' ? confirmedCount : activeTab === 'reject' ? rejectedCount : activeTab === 'pending' ? pendingCount : products.filter(p => p.admin_status !== 'confirmed' && p.admin_status !== 'rejected').length} rows
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={handleSendBackToPurchases}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md whitespace-nowrap"
              >
                Send Back ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => {
                setModalInputs({
                  dollarrate: String(adminConstants.dollar_rate),
                  bankfee: String(adminConstants.bank_conversion_rate * 100),
                  shipping: String(adminConstants.shipping_charge_per_kg),
                  commission: String(adminConstants.commission_rate * 100),
                  packingcost: String(adminConstants.packing_cost),
                  targetprofit: String(adminConstants.target_profit_percent || 10),
                });
                setIsConstantsModalOpen(true);
              }}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap shadow-lg shadow-purple-900/20 transition-all border border-purple-500/50"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Configure Constants</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-orange-500 mb-2 px-1 font-medium hidden sm:flex items-center gap-2">
          <span className="bg-orange-500/10 px-2 py-1 rounded">💡</span>
          <span>
            {showAllJourneys
              ? 'Showing ALL journey cycles. Toggle to see latest only.'
              : 'Showing LATEST journey per ASIN. Toggle to see all cycles.'}
          </span>
          <span className="bg-orange-500/10 px-2 py-1 rounded ml-2">📊</span>
          <span>Double-click any column header to auto-fit its width</span>
        </div>

        {/* Table - SCROLLABLE ONLY */}
        <div className="bg-[#111111] rounded-2xl shadow-xl overflow-hidden flex flex-col flex-1 min-h-0 border border-white/[0.1]">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/50">
            <table className="w-full border-collapse" ref={tableRef}>
              <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10 shadow-md">
                <tr>
                  {/* Checkbox — always first, not draggable */}
                  <th className="px-6 py-4 bg-[#111111] border-r border-white/[0.1]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                    />
                  </th>

                  {columnOrder.filter(k => !hiddenColumns.has(k)).map((col_key) => {
                    // Hide actions on confirm/reject tabs
                    if (col_key === 'actions' && (activeTab === 'confirm' || activeTab === 'reject')) return null;

                    const colConfig: Record<string, { label: string; widthKey: string; minWidth: number; headerClass?: string }> = {
                      asin: { label: 'ASIN', widthKey: 'asin', minWidth: 80 },
                      sku: { label: 'SKU', widthKey: 'sku', minWidth: 80 },
                      history: { label: 'J #', widthKey: 'history', minWidth: 70, headerClass: 'text-amber-400 bg-amber-500/10' },
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
                      buying_qty: { label: 'Buying Qty', widthKey: 'buyingqty', minWidth: 200 },
                      seller_link: { label: 'Purchase Link', widthKey: 'sellerlink', minWidth: 80 },
                      seller_phone: { label: 'Seller Ph No.', widthKey: 'sellerphone', minWidth: 100 },
                      payment_method: { label: 'Payment Method', widthKey: 'paymentmethod', minWidth: 100 },
                      actions: { label: 'Actions', widthKey: 'actions', minWidth: 80 },
                    };

                    const cfg = colConfig[col_key];
                    if (!cfg) return null;

                    const headerClass = cfg.headerClass || 'text-gray-400 bg-[#111111]';

                    return (
                      <th
                        key={col_key}
                        draggable
                        onDragStart={() => handleColumnDragStart(col_key)}
                        onDragOver={(e) => handleColumnDragOver(e, col_key)}
                        onDrop={handleColumnDrop}
                        onDoubleClick={() => handleColumnDoubleClick(cfg.widthKey)}
                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-[#111111] relative border-r border-white/[0.1] select-none cursor-grab active:cursor-grabbing ${headerClass}`}
                        style={{ width: columnWidths[cfg.widthKey], minWidth: cfg.minWidth }}
                      >
                        <div className="flex items-center justify-between">
                          <span>{cfg.label}</span>
                        </div>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
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

              <tbody className="divide-y divide-white/[0.06]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-16 text-center text-gray-300">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <span className="text-lg font-semibold text-gray-400">No products found in {activeTab}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#111111]/60 transition-colors border-b border-white/[0.1] [&>td]:border-r [&>td]:border-white/[0.1]">
                      <td className="px-6 py-4 border-r border-white/[0.1]">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                        />
                      </td>
                      {columnOrder.filter(k => !hiddenColumns.has(k)).map((col_key) => renderAdminCell(col_key, product))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Stats Footer - FIXED AT BOTTOM */}
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 text-sm text-gray-300">
            Showing <span className="font-bold text-white">{filteredProducts.length}</span> of <span className="font-bold text-white">{products.length}</span> products
            {filteredProducts.length > 0 && (
              <button
                onClick={() => downloadCSV(filteredProducts, `india-admin-${activeTab}-quick-${new Date().toISOString().split('T')[0]}.csv`)}
                className="ml-4 text-xs text-orange-500 hover:text-orange-400 underline cursor-pointer"
              >
                Export visible rows
              </button>
            )}
          </div>
        </div>

        {/* Constants Configuration Modal */}
        {isConstantsModalOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-[#111111] z-40" onClick={() => setIsConstantsModalOpen(false)} />
            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full border border-white/[0.1] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-4 sm:p-6 rounded-t-xl">
                  <h2 className="text-lg sm:text-2xl font-bold">Admin Calculation Constants</h2>
                  <p className="text-purple-100 mt-1 opacity-90 text-xs sm:text-sm">Configure constants for profit calculation</p>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6">
                  {/* Dollar Rate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">💵 Dollar Rate (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.dollarrate}
                      onChange={(e) => setModalInputs({ ...modalInputs, dollarrate: e.target.value })}
                      placeholder="e.g. 90"
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-300 mt-1">Currently: ₹{adminConstants.dollar_rate}</p>
                  </div>

                  {/* Bank Fee */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">🏦 Bank Fee (%)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.bankfee}
                      onChange={(e) => setModalInputs({ ...modalInputs, bankfee: e.target.value })}
                      placeholder="e.g. 2"
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-300 mt-1">Currently: {adminConstants.bank_conversion_rate * 100}%</p>
                  </div>

                  {/* Shipping */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">🚚 Shipping per 1000g (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.shipping}
                      onChange={(e) => setModalInputs({ ...modalInputs, shipping: e.target.value })}
                      placeholder="e.g. 950"
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-300 mt-1">Currently: ₹{adminConstants.shipping_charge_per_kg}</p>
                  </div>


                  {/* Packing Cost */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">📦 Packing Cost (₹)</label>
                    <input type="text" inputMode="decimal" value={modalInputs.packingcost}
                      onChange={(e) => setModalInputs({ ...modalInputs, packingcost: e.target.value })}
                      placeholder="e.g. 25"
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-300 mt-1">Currently: ₹{adminConstants.packing_cost}</p>
                  </div>

                  {/* Target Profit % */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">🎯 Target Profit (%)</label>
                    <input type="number" value={modalInputs.targetprofit}
                      onChange={(e) => setModalInputs({ ...modalInputs, targetprofit: e.target.value })}
                      placeholder="e.g. 10"
                      step="1"
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <p className="text-xs text-gray-300 mt-1">Currently: {adminConstants.target_profit_percent || 10}%</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t border-white/[0.1] bg-[#1a1a1a] flex items-center justify-end gap-3 rounded-b-xl">
                  <button onClick={() => setIsConstantsModalOpen(false)} className="px-5 py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] border border-white/[0.1] font-medium transition-colors">Cancel</button>
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
                className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/[0.1] overflow-hidden pointer-events-auto"
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
                      onClick={() => (() => { try { navigator.clipboard?.writeText(editingRemarkText); } catch { const t = document.createElement('textarea'); t.value = editingRemarkText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } })()}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-slate-600 text-gray-100 rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                    >
                      Copy
                    </button>
                    {editingRemarkText.trim() !== (selectedRemark || '').trim() && editingRemarkProductId && (
                      <button
                        onClick={async () => {
                          if (!editingRemarkProductId) return;
                          await handleCellEdit(editingRemarkProductId, 'remark', editingRemarkText.trim() || null);
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
    </div >
  );
}
