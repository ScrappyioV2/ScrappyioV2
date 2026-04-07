'use client';

import { supabase } from '@/lib/supabaseClient';
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import { useState, useEffect, useRef } from 'react'
import Toast from '@/components/Toast';
import {
  calculateProductValues,
  getDefaultConstants,
  type CalculationConstants
} from '@/lib/blackboxCalculations';
import { History, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ensureAbsoluteUrl } from '@/lib/utils'


type AdminProduct = {
  id: string;
  asin: string;
  product_name: string | null;
  product_link: string | null;
  origin_india: boolean | null;
  origin_china: boolean | null;
  origin_us: boolean | null;
  target_price: number | null;
  target_quantity: number | null;
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
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState<string>('');
  const [adminConstants, setAdminConstants] = useState<CalculationConstants>(getDefaultConstants());

  // History Sidebar State
  const [selectedHistoryAsin, setSelectedHistoryAsin] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<HistorySnapshot[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);

  const [isConstantsModalOpen, setIsConstantsModalOpen] = useState(false);
  const [isSavingConstants, setIsSavingConstants] = useState(false);
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

  // Fetch products from flipkart_admin_validation table
  const fetchProducts = async (showLoader: boolean = false) => {
    try {
      if (showLoader) setLoading(true);

      // 1. Fetch base data from indiaadminvalidation
      const { data: adminData, error: adminError } = await supabase
        .from('flipkart_admin_validation')
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
        supabase.from('flipkart_purchases')
          .select('asin, journey_id, journey_number, buying_price, buying_quantity, seller_link, seller_phone, payment_method, target_price, target_quantity, product_weight, usd_price, inr_purchase, funnel, seller_tag')
          .in('asin', asins),

        supabase.from('flipkart_validation_main_file')
          .select('asin, current_journey_id, journey_number, seller_tag, funnel, product_weight, usd_price, inr_purchase')
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
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          origin_us: product.origin_us ?? false,

          // Pricing fields - respect confirmed status
          target_price: isConfirmed
            ? product.target_price
            : (product.target_price ?? purchase?.target_price ?? null),

          target_quantity: isConfirmed
            ? product.target_quantity
            : (product.target_quantity ?? purchase?.target_quantity ?? null),

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
        };
      });

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
      .channel('flipkart_admin_validation_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flipkart_admin_validation' },
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
      const saved = localStorage.getItem('flipkart_admin_validation_column_widths');
      return saved ? JSON.parse(saved) : {
        asin: 120,
        product_name: 120,
        product_link: 100,
        target_price: 100,
        target_qty: 80,
        admin_target_price: 120,
        funnel_seller: 100,
        funnel_qty: 80,
        buying_price: 100,
        buying_qty: 80,
        profit: 100,
        product_weight: 120,
        usd_price: 100,
        inr_purchase: 120,
        inr_purchase_link: 180,
        seller_link: 100,
        seller_phone: 120,
        payment_method: 120,
        journey_number: 80,
      };
    }
    return {
      asin: 120,
      history: 180,
      product_name: 200,
      product_link: 100,
      target_price: 100,
      target_qty: 80,
      admin_target_price: 120,
      funnel_seller: 100,
      funnel_qty: 80,
      buying_price: 100,
      buying_qty: 80,
      profit: 100,
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
        .from('flipkart_admin_validation_constants')
        .select('*')
        .limit(1)
        .single();

      if (!error && data) {
        setAdminConstants({
          dollar_rate: data.dollar_rate,
          bank_conversion_rate: data.bank_conversion_rate,
          shipping_charge_per_kg: data.shipping_charge_per_kg,
          commission_rate: data.commission_rate,
          packing_cost: data.packing_cost,
        });
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
        .from('flipkart_asin_history')
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
      // Update constants in database
      const { data: existingData } = await supabase
        .from('flipkart_admin_validation_constants')
        .select('id')
        .limit(1)
        .single();

      if (existingData) {
        await supabase
          .from('flipkart_admin_validation_constants')
          .update(adminConstants)
          .eq('id', existingData.id);
      } else {
        await supabase
          .from('flipkart_admin_validation_constants')
          .insert(adminConstants);
      }

      setToast({ message: 'Admin constants saved successfully!', type: 'success' });
      setIsConstantsModalOpen(false);
    } catch (err) {
      console.error('Save constants error:', err);
      setToast({ message: 'Failed to save constants', type: 'error' });
    } finally {
      setIsSavingConstants(false);
    }
  };

  const autoCalculateProfit = async (productId: string, product: any) => {
    // Check if we have all required values
    if (!product.usdprice || !product.productweight || !product.inrpurchase) {
      return; // Skip calculation if any value is missing
    }

    // Add to calculating set for spinner
    setCalculatingIds((prev) => new Set(prev).add(productId));

    try {
      // Calculate using admin constants
      const result = calculateProductValues(
        {
          usd_price: product.usdprice,
          product_weight: product.productweight,
          inr_purchase: product.inrpurchase,
        },
        adminConstants,
        'INDIA'
      );

      console.log('Calculated profit:', result.profit);

      // ✅ FIX: Update profit in CORRECT TABLE (flipkart_admin_validation)
      const { error } = await supabase
        .from('flipkart_admin_validation')  // ✅ CORRECT TABLE!
        .update({ profit: result.profit })
        .eq('id', productId);

      if (error) {
        console.error('Update profit error:', error);
        return;
      }

      // ✅ FIX: Update local state to show new profit immediately
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, profit: result.profit } : p
        )
      );

      setToast({
        message: `Profit calculated: ₹${result.profit.toFixed(2)}`,
        type: 'success',
      });
    } catch (err) {
      console.error('Calculation error:', err);
      setToast({
        message: 'Profit calculation failed',
        type: 'error',
      });
    } finally {
      // Remove from calculating set
      setCalculatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
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
    localStorage.setItem('flipkart_admin_validation_column_widths', JSON.stringify(newWidths));

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
      localStorage.setItem('flipkart_admin_validation_column_widths', JSON.stringify(columnWidths));
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

  // Filter products based on active tab
  const filteredProducts = products.filter((product) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      product.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.seller_tag?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

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
      setToast({ message: 'Please select at least one product to confirm', type: 'error' });
      return;
    }

    try {
      const selectedProducts = products.filter(p => selectedIds.has(p.id));

      for (const product of selectedProducts) {
        // ✅ STEP 1: UPDATE flipkart_purchases (existing workflow preserved)
        const { error: updatePurchaseError } = await supabase
          .from('flipkart_purchases')
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

        // ✅ STEP 2: UPDATE status in flipkart_admin_validation (KEEP the product, don't delete)
        const { error: updateAdminError } = await supabase
          .from('flipkart_admin_validation')
          .update({
            admin_status: 'confirmed',  // ✅ Set to 'confirmed' so it appears in Confirm tab
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateAdminError) throw updateAdminError;
      }

      setToast({ message: `Successfully confirmed ${selectedIds.size} products!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error: any) {
      setToast({ message: `Error confirming products: ${error.message}`, type: 'error' });
    }
  };

  // UPDATE handleCellEdit TO TRIGGER AUTO-CALCULATION
  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      // ✅ Map frontend field names to database column names with underscores
      const fieldMapping: Record<string, string> = {
        'inrpurchaselink': 'inr_purchase_link',
        'productname': 'product_name',
        'productlink': 'product_link',
        'sellertag': 'seller_tag',
        'targetprice': 'target_price',
        'targetquantity': 'target_quantity',
        'targetpricevalidation': 'target_price_validation',
        'targetpricelinkvalidation': 'target_price_link_validation',
        'buyingprice': 'buying_price',
        'buyingquantity': 'buying_quantity',
        'sellerlink': 'seller_link',
        'sellerphone': 'seller_phone',
        'paymentmethod': 'payment_method',
        'originindia': 'origin_india',
        'originchina': 'origin_china',
        'origin_us': 'origin_us',
        'productweight': 'product_weight',
        'totalcost': 'total_cost',
        'totalrevenue': 'total_revenue',
        'adminstatus': 'admin_status',
        'adminnotes': 'admin_notes',
        remark: 'remark',
        'admintargetprice': 'admin_target_price',
        'usdprice': 'usd_price',
        'inrpurchase': 'inr_purchase',
        'created_at': 'created_at',
      }

      // Use mapped field name, or original if not in mapping
      const dbField = fieldMapping[field] || field

      console.log('📊 Updating product:', { id, field, dbField, value })

      // UPDATE flipkart_admin_validation table (not flipkart_purchases)
      const { error } = await supabase
        .from('flipkart_admin_validation')  // ✅ CORRECT TABLE
        .update({ [dbField]: value })  // ✅ Use the correct database column name
        .eq('id', id)

      if (error) {
        console.error('❌ Update error:', error)
        setToast({ message: 'Failed to update', type: 'error' })
        return
      }

      console.log('✅ Product updated successfully')

      // Update local state
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;

          // 🔴 FIX: admin target price must update correct key
          if (field === 'admintargetprice') {
            return { ...p, admin_target_price: value };
          }

          if (field === 'sellertag') {
            return { ...p, seller_tag: value };
          }

          return { ...p, [field]: value };
        })
      );

      // AUTO-CALCULATE IF IT'S ONE OF THE THREE KEY FIELDS
      if (field === 'productweight' || field === 'usdprice' || field === 'inrpurchase') {
        const updatedProduct = products.find((p) => p.id === id)
        if (updatedProduct) {
          await autoCalculateProfit(id, { ...updatedProduct, [field]: value })
        }
      }

      setToast({ message: 'Updated successfully', type: 'success' })
    } catch (err: any) {
      console.error('Update error:', err)
      setToast({ message: 'Update failed', type: 'error' })
    }
  }

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
        .from('flipkart_validation_main_file')
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
        if (!isNaN(Number(rawFunnel))) {
          finalFunnelId = Number(rawFunnel);
        } else {
          const str = String(rawFunnel).toLowerCase();
          if (str.includes('high') || str === 'hd') finalFunnelId = 1;
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
        setToast({ message: `Error: No valid seller tags found in '${rawSellerTag}'`, type: 'error' });
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
          sku: cleanAsin,
          selling_price: product.buying_price || product.admin_target_price || 0,
          seller_link: product.seller_link,
          min_price: null,
          max_price: null,
          remark: product.remark ?? null,
        };

        // B. Select Tables for THIS seller
        const tablesToInsert = [`flipkart_listing_error_seller_${sellerId}_pending`];

        if (finalFunnelId === 1) tablesToInsert.push(`flipkart_listing_error_seller_${sellerId}_high_demand`);
        else if (finalFunnelId === 2) tablesToInsert.push(`flipkart_listing_error_seller_${sellerId}_low_demand`);
        else if (finalFunnelId === 3) tablesToInsert.push(`flipkart_listing_error_seller_${sellerId}_dropshipping`);

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
      await supabase.from('flipkart_purchases').update({
        admin_confirmed: true,
        admin_confirmed_at: new Date().toISOString(),
        admin_target_price: product.admin_target_price,
        buying_price: product.buying_price,
        buying_quantity: product.buying_quantity,
        seller_link: product.seller_link,
        seller_phone: product.seller_phone,
        payment_method: product.payment_method,
      }).eq('asin', cleanAsin);

      await supabase.from('flipkart_admin_validation').update({
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
        .from('flipkart_admin_validation')
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
        // 1. Revert flipkart_purchases
        const { error: updatePurchaseError } = await supabase
          .from('flipkart_purchases')
          .update({
            admin_confirmed: false,
            admin_confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updatePurchaseError) {
          console.error('Error rolling back flipkart_purchases:', updatePurchaseError);
        }

        // 2. Revert flipkart_admin_validation status
        const { error: updateAdminError } = await supabase
          .from('flipkart_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updateAdminError) throw updateAdminError;

      } else if (toStatus === 'rejected') {
        // Rolling back from Reject
        const { error: updateAdminError } = await supabase
          .from('flipkart_admin_validation')
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

      setToast({ message: `Rolled back: ${product.product_name}`, type: 'success' }); setTimeout(() => setToast(null), 3000);
      fetchProducts();
    } catch (error) {
      console.error('Error rolling back:', error);
      setToast({ message: 'Rollback failed', type: 'error' });
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#111111] p-6 text-gray-100 font-sans selection:bg-orange-400/30">
      <div className="w-full flex flex-col flex-1 overflow-hidden">

        {/* Header Section */}
        <div className="flex-none mb-6">
          <h1 className="text-3xl font-bold text-white">Admin Validation</h1>
          <p className="text-gray-400 mt-1">Review and manage product pricing and profitability</p>
        </div>

        {/* Tabs - STICKY */}
        <div className="flex-none flex gap-2 mb-5 flex-wrap p-1.5 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-fit">
          {[
            { id: 'overview', label: 'Overview', count: products.length, color: 'text-orange-500', activeBg: 'bg-orange-500/10' },
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
              className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-all relative overflow-hidden ${activeTab === tab.id
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

        {/* Search Bar + Buttons */}
        <div className="flex-none mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Search Input */}
          <div className="relative flex-1 w-full md:max-w-md group">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-orange-500 transition-colors"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by ASIN, Product Name, or Funnel Seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600 transition-all shadow-sm text-sm"
            />
          </div>

          {/* Right: Buttons Group */}
          <div className="flex items-center gap-3">
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
                ? 'bg-orange-500 text-white hover:bg-orange-400 border-orange-500/50 shadow-orange-500/10'
                : 'bg-[#111111] text-gray-500 hover:bg-[#1a1a1a] border-white/[0.1]'
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
              onClick={() => setIsConstantsModalOpen(true)}
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

        <div className="text-xs text-orange-500 mb-2 px-1 font-medium flex items-center gap-2">
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
                  {/* Checkbox */}
                  <th className="px-6 py-4 bg-[#111111]">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === products.length && products.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                    />
                  </th>

                  {/* 1. ASIN */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('asin')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.asin, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>ASIN</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'asin')}
                        style={{
                          backgroundColor: resizingColumn === 'asin' ? '#6366f1' : 'transparent',
                          width: resizingColumn === 'asin' ? '2px' : '4px',
                        }}
                      />
                    </div>
                  </th>

                  {/* ✅ HISTORY COLUMN */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('history')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.history, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>HISTORY</span>
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                      onMouseDown={(e) => handleResizeStart(e, 'history')}
                      style={{
                        backgroundColor: resizingColumn === 'history' ? '#6366f1' : 'transparent',
                        width: resizingColumn === 'history' ? '2px' : '4px',
                      }}
                    />
                  </th>

                  {/* ✅✅ REMARK COLUMN */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('remark')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.remark, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>REMARK</span>
                      <div />
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                      onMouseDown={(e) => handleResizeStart(e, 'remark')}
                      style={{
                        backgroundColor: resizingColumn === 'remark' ? '#6366f1' : 'transparent',
                        width: resizingColumn === 'remark' ? '2px' : '4px',
                      }}
                    />
                  </th>

                  {/* 🆕 2. Journey # Column */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('journey_number')}
                    className="px-4 py-3 text-xs font-bold text-amber-400 uppercase tracking-wider hover:bg-[#111111] relative bg-amber-500/10 border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.journey_number, minWidth: 70 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Journey #</span>
                    </div>
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                      onMouseDown={(e) => handleResizeStart(e, 'journey_number')}
                    />
                  </th>

                  {/* 2. Product Name */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('productname')}
                    className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.productname, minWidth: 150 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Product Name</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'productname')}
                      />
                    </div>
                  </th>

                  {/* 3. Product Link */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('productlink')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.productlink, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Product Link</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'productlink')}
                      />
                    </div>
                  </th>

                  {/* 4. Target Price */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('targetprice')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.targetprice, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Target Price</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'targetprice')}
                      />
                    </div>
                  </th>

                  {/* 5. Target Qty */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('targetqty')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.targetqty, minWidth: 70 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Target Qty</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'targetqty')}
                      />
                    </div>
                  </th>

                  {/* 6. Admin Target Price */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('admintargetprice')}
                    className="px-4 py-3 text-xs font-bold text-purple-300 uppercase tracking-wider hover:bg-purple-900/20 relative bg-purple-900/10 border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.admintargetprice, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Admin Target Price</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'admintargetprice')}
                      />
                    </div>
                  </th>

                  {/* 7. Seller Tag */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('funnelseller')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.funnelseller, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Seller Tag</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'funnelseller')}
                      />
                    </div>
                  </th>

                  {/* 8. Funnel */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('funnelqty')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.funnelqty, minWidth: 70 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Funnel</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'funnelqty')}
                      />
                    </div>
                  </th>

                  {/* 9. Product Weight */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('productweight')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.productweight, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Product Weight</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'productweight')}
                      />
                    </div>
                  </th>

                  {/* 10. USD Price */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('usdprice')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.usdprice, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>USD Price</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'usdprice')}
                      />
                    </div>
                  </th>

                  {/* 11. INR Purchase */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('inrpurchase')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.inrpurchase, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>INR Purchase</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'inrpurchase')}
                      />
                    </div>
                  </th>

                  {/* 12. Profit */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('profit')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.profit, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Profit</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'profit')}
                      />
                    </div>
                  </th>

                  {/* 13. INR Purchase Link */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('inrpurchaselink')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.inrpurchaselink, minWidth: 150 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>INR Purchase Link</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'inrpurchaselink')}
                      />
                    </div>
                  </th>

                  {/* 14. Buying Price */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('buyingprice')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.buyingprice, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Buying Price</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'buyingprice')}
                      />
                    </div>
                  </th>

                  {/* 15. Buying Quantity */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('buyingqty')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.buyingqty, minWidth: 70 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Buying Qty</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'buyingqty')}
                      />
                    </div>
                  </th>

                  {/* 16. Seller Link */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('sellerlink')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.sellerlink, minWidth: 80 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Seller Link</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'sellerlink')}
                      />
                    </div>
                  </th>

                  {/* 17. Seller Ph No. */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('sellerphone')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.sellerphone, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Seller Ph No.</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'sellerphone')}
                      />
                    </div>
                  </th>

                  {/* 18. Payment Method */}
                  <th
                    onDoubleClick={() => handleColumnDoubleClick('paymentmethod')}
                    className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider hover:bg-[#111111] relative bg-[#111111] border-r border-white/[0.1] select-none"
                    style={{ width: columnWidths.paymentmethod, minWidth: 100 }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Payment Method</span>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-orange-400"
                        onMouseDown={(e) => handleResizeStart(e, 'paymentmethod')}
                      />
                    </div>
                  </th>

                  {/* 19. Actions */}
                  {(activeTab !== 'confirm' && activeTab !== 'reject') && (
                    <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider bg-[#111111]">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.06]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="px-4 py-16 text-center text-gray-300">
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
                    <tr key={product.id} className="hover:bg-[#111111]/60 transition-colors border-b border-white/[0.1]">
                      {/* Checkbox */}
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                        />
                      </td>

                      {/* 1. ASIN */}
                      {/* ✅ 1. ASIN COLUMN - Only ASIN */}
                      <td className="px-6 py-4 text-sm text-gray-300 font-mono tracking-tight">
                        {product.asin}
                      </td>

                      {/* ✅ 2. HISTORY COLUMN - Only Clock Icon */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => fetchHistory(product.asin)}
                          className="p-2 rounded-full hover:bg-white/[0.08] text-gray-400 hover:text-orange-500 transition-colors"
                          title="View Journey History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </td>

                      {/* ✅✅ REMARK COLUMN - Editable + View Button */}
                      <td className="px-6 py-4" style={{ width: columnWidths.remark }}>
                        <div className="flex items-center gap-2">
                          {product.remark && (
                            <button
                              onClick={() => setSelectedRemark(product.remark)}
                              className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 🆕 2. Journey # */}
                      <td className="px-6 py-4 text-center bg-amber-500/10">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          #{product.journey_number || 1}
                        </span>
                      </td>

                      {/* 2. Product Name */}
                      <td
                        className="px-4 py-3 text-sm text-gray-100"
                        style={{
                          maxWidth: columnWidths.productname,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={product.product_name || '-'}
                      >
                        {product.product_name || '-'}
                      </td>

                      {/* 3. Product Link */}
                      <td className="px-6 py-4 text-sm">
                        <div className="w-32">
                          {editingLinkId === product.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingLinkValue}
                                onChange={(e) => setEditingLinkValue(e.target.value)}
                                className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                placeholder="URL..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellEdit(product.id, 'productlink', editingLinkValue);
                                    setEditingLinkId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingLinkId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  handleCellEdit(product.id, 'productlink', editingLinkValue);
                                  setEditingLinkId(null);
                                }}
                                className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                                title="Save (Enter)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingLinkId(null)}
                                className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                                title="Cancel (Esc)"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {product.product_link ? (
                                <>
                                  <a
                                    href={ensureAbsoluteUrl(product.product_link || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap"
                                  >
                                    View Link
                                  </a>
                                  <button
                                    onClick={() => {
                                      setEditingLinkId(product.id);
                                      setEditingLinkValue(product.product_link || '');
                                    }}
                                    className="text-gray-500 hover:text-amber-500 transition-colors flex-shrink-0"
                                    title="Edit link"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLinkId(product.id);
                                    setEditingLinkValue('');
                                  }}
                                  className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                                >
                                  + Add Link
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 4. Target Price */}
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          defaultValue={product.target_price || ''}
                          onChange={(e) => handleCellEdit(product.id, 'targetprice', parseFloat(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </td>

                      {/* 5. Target Qty */}
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          defaultValue={product.target_quantity || ''}
                          onChange={(e) => handleCellEdit(product.id, 'targetquantity', parseInt(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </td>

                      {/* 6. Admin Target Price */}
                      <td className="px-6 py-4 bg-purple-900/10">
                        <input
                          type="number"
                          step="0.01"
                          value={product.admin_target_price ?? ''}
                          onChange={(e) =>
                            handleCellEdit(product.id, 'admintargetprice', e.target.value === '' ? null : parseFloat(e.target.value))
                          }
                          className="w-24 px-2 py-1.5 bg-[#111111] border border-purple-500/50 rounded text-sm text-purple-200 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-purple-400/50"
                          placeholder="₹"
                        />
                      </td>

                      {/* 7. Seller Tag */}
                      <td className="px-6 py-4 text-sm">
                        {product.seller_tag ? (
                          <div className="flex flex-wrap gap-2">
                            {product.seller_tag.split(',').map((tag) => {
                              const cleanTag = tag.trim();

                              return (
                                <span
                                  key={cleanTag}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-xs ${SELLER_STYLES[cleanTag] || 'bg-[#1a1a1a] text-white'}`}
                                >
                                  {cleanTag}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">-</span>
                        )}
                      </td>

                      {/* 8. Funnel */}
                      <td className="px-6 py-4 text-sm">
                        {product.funnel ? (
                          <span
                            className={`w-8 h-8 inline-flex items-center justify-center rounded-full font-bold text-xs ${product.funnel === 1
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : product.funnel === 2
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : product.funnel === 3
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-[#1a1a1a] text-gray-500'
                              }`}
                          >
                            {product.funnel === 1 ? 'HD' : product.funnel === 2 ? 'LD' : product.funnel === 3 ? 'DP' : product.funnel}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300 italic">-</span>
                        )}
                      </td>

                      {/* 9. Product Weight */}
                      <td className="px-6 py-4 text-sm">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.product_weight || ''}
                            onBlur={(e) =>
                              handleCellEdit(
                                product.id,
                                'productweight',
                                parseFloat(e.target.value) || null
                              )
                            }
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

                      {/* 10. USD Price */}
                      <td className="px-6 py-4 text-sm">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.usd_price || ''}
                            onBlur={(e) =>
                              handleCellEdit(product.id, 'usdprice', parseFloat(e.target.value) || null)
                            }
                            className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            placeholder="$"
                          />
                          {calculatingIds.has(product.id) && (
                            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-500 border-t-transparent"></div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 11. INR Purchase */}
                      <td className="px-6 py-4 text-sm">
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={product.inr_purchase || ''}
                            onBlur={(e) =>
                              handleCellEdit(
                                product.id,
                                'inrpurchase',
                                parseFloat(e.target.value) || null
                              )
                            }
                            className="w-28 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            placeholder="₹"
                          />
                          {calculatingIds.has(product.id) && (
                            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-orange-500 border-t-transparent"></div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 12. Profit */}
                      <td className="px-6 py-4 text-sm">
                        <div
                          className={`w-24 px-2 py-1 border rounded text-sm font-bold text-center ${(product.profit || 0) >= 0
                            ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30'
                            : 'text-rose-400 bg-rose-500/20 border-rose-500/30'
                            }`}
                        >
                          {product.profit !== null && product.profit !== undefined
                            ? `₹${product.profit.toFixed(2)}`
                            : '-'}
                        </div>
                      </td>

                      {/* 13. INR Purchase Link */}
                      <td className="px-6 py-4 text-sm">
                        <div className="w-32">
                          {editingLinkId === `inr-${product.id}` ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingLinkValue}
                                onChange={(e) => setEditingLinkValue(e.target.value)}
                                className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                placeholder="Supplier URL..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellEdit(product.id, 'inrpurchaselink', editingLinkValue);
                                    setEditingLinkId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingLinkId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  handleCellEdit(product.id, 'inrpurchaselink', editingLinkValue);
                                  setEditingLinkId(null);
                                }}
                                className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingLinkId(null)}
                                className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {product.inr_purchase_link && product.inr_purchase_link.trim() !== '' ? (
                                <>
                                  <a
                                    href={ensureAbsoluteUrl(product.inr_purchase_link || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap"
                                  >
                                    View Link
                                  </a>
                                  <button
                                    onClick={() => {
                                      setEditingLinkId(`inr-${product.id}`);
                                      setEditingLinkValue(product.inr_purchase_link || '');
                                    }}
                                    className="text-gray-500 hover:text-amber-500 transition-colors flex-shrink-0"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLinkId(`inr-${product.id}`);
                                    setEditingLinkValue('');
                                  }}
                                  className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                                >
                                  + Add Link
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 14. Buying Price */}
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          defaultValue={product.buying_price || ''}
                          onChange={(e) => handleCellEdit(product.id, 'buyingprice', parseFloat(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </td>

                      {/* 15. Buying Quantity */}
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          defaultValue={product.buying_quantity || ''}
                          onChange={(e) => handleCellEdit(product.id, 'buyingquantity', parseInt(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                        />
                      </td>

                      {/* 16. Seller Link */}
                      <td className="px-6 py-4 text-sm">
                        <div className="w-32">
                          {editingLinkId === `seller_${product.id}` ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingLinkValue}
                                onChange={(e) => setEditingLinkValue(e.target.value)}
                                className="w-full px-2 py-1.5 bg-[#111111] border border-orange-500 rounded text-xs text-white focus:ring-1 focus:ring-orange-500"
                                placeholder="Amazon URL..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCellEdit(product.id, 'sellerlink', editingLinkValue);
                                    setEditingLinkId(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingLinkId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  handleCellEdit(product.id, 'sellerlink', editingLinkValue);
                                  setEditingLinkId(null);
                                }}
                                className="text-emerald-500 hover:text-emerald-400 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setEditingLinkId(null)}
                                className="text-rose-500 hover:text-rose-400 flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {product.seller_link && product.seller_link.trim() !== '' ? (
                                <>
                                  <a
                                    href={ensureAbsoluteUrl(product.seller_link || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-500 hover:text-orange-400 hover:underline font-medium whitespace-nowrap"
                                  >
                                    View Link
                                  </a>
                                  <button
                                    onClick={() => {
                                      setEditingLinkId(`seller_${product.id}`);
                                      setEditingLinkValue(product.seller_link || '');
                                    }}
                                    className="text-gray-500 hover:text-amber-500 transition-colors flex-shrink-0"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingLinkId(`seller_${product.id}`);
                                    setEditingLinkValue('');
                                  }}
                                  className="text-emerald-500 hover:text-emerald-400 font-medium text-xs whitespace-nowrap flex items-center gap-1"
                                >
                                  + Add Link
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 17. Seller Ph No. */}
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          defaultValue={product.seller_phone || ''}
                          onChange={(e) => handleCellEdit(product.id, 'sellerphone', e.target.value)}
                          className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          placeholder="Phone"
                        />
                      </td>

                      {/* 18. Payment Method */}
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          defaultValue={product.payment_method || ''}
                          onChange={(e) => handleCellEdit(product.id, 'paymentmethod', e.target.value)}
                          className="w-28 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-sm text-gray-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                          placeholder="Method"
                        />
                      </td>

                      {/* 19. Actions */}
                      {activeTab !== 'confirm' && activeTab !== 'reject' && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleConfirmProduct(product.id)}
                              disabled={product.admin_status === 'confirmed'}
                              className={`p-2 rounded-lg transition-all ${product.admin_status === 'confirmed'
                                ? 'bg-emerald-500/20 text-emerald-600 cursor-not-allowed border border-emerald-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20'
                                }`}
                              title="Confirm"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRejectProduct(product.id)}
                              disabled={product.admin_status === 'rejected'}
                              className={`p-2 rounded-lg transition-all ${product.admin_status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-600 cursor-not-allowed border border-rose-500/30'
                                : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/20'
                                }`}
                              title="Reject"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Stats Footer - FIXED AT BOTTOM */}
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3 text-sm text-gray-300">
            Showing <span className="font-bold text-white">{filteredProducts.length}</span> of <span className="font-bold text-white">{products.length}</span> products
          </div>
        </div>

        {/* Constants Configuration Modal */}
        {isConstantsModalOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[#111111] z-40"
              onClick={() => setIsConstantsModalOpen(false)}
            ></div>

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full border border-white/[0.1] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-6 rounded-t-xl">
                  <h2 className="text-2xl font-bold">Admin Calculation Constants</h2>
                  <p className="text-purple-100 mt-1 opacity-90">Configure constants for profit calculation</p>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Dollar Rate (₹)
                    </label>
                    <input
                      type="number"
                      value={adminConstants.dollar_rate}
                      onChange={(e) => setAdminConstants({ ...adminConstants, dollar_rate: parseFloat(e.target.value) || 90 })}
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Bank Fee (%)
                    </label>
                    <input
                      type="number"
                      value={adminConstants.bank_conversion_rate * 100}
                      onChange={(e) => setAdminConstants({ ...adminConstants, bank_conversion_rate: (parseFloat(e.target.value) || 2) / 100 })}
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Shipping per 1000g (₹)
                    </label>
                    <input
                      type="number"
                      value={adminConstants.shipping_charge_per_kg}
                      onChange={(e) => setAdminConstants({ ...adminConstants, shipping_charge_per_kg: parseFloat(e.target.value) || 950 })}
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      value={adminConstants.commission_rate * 100}
                      onChange={(e) => setAdminConstants({ ...adminConstants, commission_rate: (parseFloat(e.target.value) || 25) / 100 })}
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Packing Cost (₹)
                    </label>
                    <input
                      type="number"
                      value={adminConstants.packing_cost}
                      onChange={(e) => setAdminConstants({ ...adminConstants, packing_cost: parseFloat(e.target.value) || 25 })}
                      className="w-full px-4 py-3 bg-[#111111] border border-white/[0.1] rounded-xl text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/[0.1] bg-[#1a1a1a] flex items-center justify-end gap-3 rounded-b-xl">
                  <button
                    onClick={() => setIsConstantsModalOpen(false)}
                    className="px-5 py-2.5 bg-[#111111] text-gray-500 rounded-xl hover:bg-[#1a1a1a] border border-white/[0.1] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAdminConstants}
                    disabled={isSavingConstants}
                    className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
                  >
                    {isSavingConstants ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}


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
              className="absolute top-0 right-0 h-full w-[400px] bg-[#111111] border-l border-white/[0.1] shadow-2xl z-50 p-6 flex flex-col overflow-hidden"
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
                className="bg-[#111111] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-white/[0.1] overflow-hidden pointer-events-auto"
              >
                <div className="flex items-center justify-between px-6 py-4 bg-[#111111] border-b border-white/[0.1]">
                  <h2 className="text-xl font-bold text-white">Remark Details</h2>
                  <button onClick={() => setSelectedRemark(null)} className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-[#111111] rounded-lg p-4 border border-white/[0.1]">
                    <p className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{selectedRemark}</p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#111111] border-t border-white/[0.1] flex justify-end">
                  <button onClick={() => setSelectedRemark(null)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
