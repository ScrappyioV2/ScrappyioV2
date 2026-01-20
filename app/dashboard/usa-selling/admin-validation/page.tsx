'use client';
import PageGuard from '../../../components/PageGuard'
import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useRef } from 'react'
import Toast from '@/components/Toast';
import {
  calculateProductValues,
  getDefaultConstants,
  type CalculationConstants
} from '@/lib/blackboxCalculations';

type AdminProduct = {
  id: string;
  asin: string;
  product_name: string | null;
  product_link: string | null;
  origin_india: boolean | null;
  origin_china: boolean | null;
  target_price: number | null;
  target_quantity: number | null;
  buying_price: number | null;
  buying_quantity: number | null;
  funnel: number | null;
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
};

type TabType = 'overview' | 'india' | 'china' | 'pending' | 'confirm' | 'reject';

export default function AdminValidationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkValue, setEditingLinkValue] = useState<string>('');
  const [adminConstants, setAdminConstants] = useState<CalculationConstants>(getDefaultConstants());
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

  // Fetch products from usa_admin_validation table
  const fetchProducts = async () => {
    try {
      setLoading(true)

      // 1️⃣ Fetch base data from usa_admin_validation
      const { data: adminData, error: adminError } = await supabase
        .from('usa_admin_validation')
        .select('*')
        .order('created_at', { ascending: false })

      if (adminError) {
        console.error('❌ Admin validation fetch error:', adminError)
        throw adminError
      }

      if (!adminData || adminData.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }

      // 2️⃣ Get all ASINs for batch fetching
      const asins = adminData.map(p => p.asin)

      // 3️⃣ Batch fetch from BOTH tables (2 queries total, not 100+)
      const [purchaseResult, validationResult] = await Promise.all([
        // ✅ Fetch purchase team's data (5 columns)
        supabase
          .from('usa_purchases')
          .select('asin, buying_price, buying_quantity, seller_link, seller_phone, payment_method')
          .in('asin', asins),

        // ✅ Fetch validation team's data
        supabase
          .from('usa_validation_main_file')
          .select('asin, seller_tag, funnel, product_weight, usd_price, inr_purchase')
          .in('asin', asins)
      ])

      // Handle errors gracefully
      if (purchaseResult.error) {
        console.error('⚠️ Purchase data fetch error:', purchaseResult.error)
      }

      if (validationResult.error) {
        console.error('⚠️ Validation data fetch error:', validationResult.error)
      }

      // 4️⃣ Create lookup maps for O(1) access
      const purchaseMap = new Map(
        purchaseResult.data?.map(p => [p.asin, p]) ?? []
      )

      const validationMap = new Map(
        validationResult.data?.map(v => [v.asin, v]) ?? []
      )

      console.log('📦 Fetched purchase data for', purchaseMap.size, 'products')
      console.log('📦 Fetched validation data for', validationMap.size, 'products')

      // 5️⃣ Enrich data - merge all sources with CORRECT field names
      const enrichedData: AdminProduct[] = adminData.map((product) => {
        const purchase = purchaseMap.get(product.asin)
        const validation = validationMap.get(product.asin)

        return {
          id: product.id,
          asin: product.asin,
          product_name: product.product_name,
          product_link: product.product_link,
          origin_india: product.origin_india ?? false,
          origin_china: product.origin_china ?? false,
          target_price: product.target_price,
          target_quantity: product.target_quantity,
          admin_target_price: product.admin_target_price,

          // ✅ FROM PURCHASE TEAM (usa_purchases table)
          buying_price: purchase?.buying_price ?? product.buying_price ?? null,
          buying_quantity: purchase?.buying_quantity ?? product.buying_quantity ?? null,
          seller_link: purchase?.seller_link ?? product.seller_link ?? null,
          seller_phone: purchase?.seller_phone ?? product.seller_phone ?? null,
          payment_method: purchase?.payment_method ?? product.payment_method ?? null,

          // ✅ FROM VALIDATION TEAM (usa_validation_main_file table)
          funnel: validation?.funnel ?? product.funnel ?? null,
          seller_tag: validation?.seller_tag ?? product.seller_tag ?? null,
          product_weight: validation?.product_weight ?? product.product_weight ?? null,
          usd_price: validation?.usd_price ?? product.usd_price ?? null,
          inr_purchase: validation?.inr_purchase ?? product.inr_purchase ?? null,

          // ✅ FROM ADMIN VALIDATION TABLE (always)
          status: product.status,
          admin_status: product.admin_status,
          admin_notes: product.admin_notes,
          created_at: product.created_at,
          profit: product.profit,
          total_cost: product.total_cost,
          total_revenue: product.total_revenue,
          inr_purchase_link: product.inr_purchase_link,
        }
      })

      setProducts(enrichedData)
      console.log('✅ Loaded', enrichedData.length, 'products successfully')
    } catch (error: any) {
      console.error('❌ Error in fetchProducts:', error)
      setToast({ message: 'Error loading data', type: 'error' })
      setProducts([])
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    fetchProducts();
    // Real-time subscription
    const channel = supabase
      .channel('admin_validation_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usa_admin_validation' },
        () => fetchProducts()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

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
    }
    return {
      asin: 120,
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
        .from('usa_admin_validation_constants')
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

  const saveAdminConstants = async () => {
    setIsSavingConstants(true);
    try {
      // Update constants in database
      const { data: existingData } = await supabase
        .from('usa_admin_validation_constants')
        .select('id')
        .limit(1)
        .single();

      if (existingData) {
        await supabase
          .from('usa_admin_validation_constants')
          .update(adminConstants)
          .eq('id', existingData.id);
      } else {
        await supabase
          .from('usa_admin_validation_constants')
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
    if (!product.usd_price || !product.product_weight || !product.inr_purchase) {
      return; // Skip calculation if any value is missing
    }

    // Add to calculating set (for spinner)
    setCalculatingIds(prev => new Set(prev).add(productId));

    try {
      // Calculate using admin constants
      const result = calculateProductValues(
        {
          usd_price: product.usd_price,
          product_weight: product.product_weight,
          inr_purchase: product.inr_purchase,
        },
        adminConstants
      );

      // Update profit in database
      const { error } = await supabase
        .from('usa_purchases')
        .update({ profit: result.profit })
        .eq('id', productId);

      if (error) {
        console.error('Update profit error:', error);
        return;
      }

      // Update local state
      setProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? { ...p, profit: result.profit }
            : p
        )
      );
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      // Remove from calculating set
      setCalculatingIds(prev => {
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
        return product.origin_india === true;
      case 'china':
        return product.origin_china === true;
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
        // ✅ STEP 1: UPDATE usa_purchases (existing workflow preserved)
        const { error: updatePurchaseError } = await supabase
          .from('usa_purchases')
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

        // ✅ STEP 2: UPDATE status in usa_admin_validation (KEEP the product, don't delete)
        const { error: updateAdminError } = await supabase
          .from('usa_admin_validation')
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

  // ✅ UPDATE handleCellEdit TO TRIGGER AUTO-CALCULATION
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
        'productweight': 'product_weight',
        'totalcost': 'total_cost',
        'totalrevenue': 'total_revenue',
        'adminstatus': 'admin_status',
        'adminnotes': 'admin_notes',
        'admintargetprice': 'admin_target_price',
        'usdprice': 'usd_price',
        'inrpurchase': 'inr_purchase',
        'createdat': 'created_at',
      }

      // Use mapped field name, or original if not in mapping
      const dbField = fieldMapping[field] || field

      console.log('📊 Updating product:', { id, field, dbField, value })

      // UPDATE usa_admin_validation table (not usa_purchases)
      const { error } = await supabase
        .from('usa_admin_validation')  // ✅ CORRECT TABLE
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
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
      )

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

  // Handle individual product confirm
  const handleConfirmProduct = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // ✅ SAVE TO HISTORY FIRST!
      setMovementHistory((prev) => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.admin_status,
          toStatus: 'confirmed'
        },
      }));

      // UPDATE usa_purchases with ALL edited fields from admin
      const { error: updatePurchaseError } = await supabase
        .from('usa_purchases')
        .update({
          admin_confirmed: true,
          admin_confirmed_at: new Date().toISOString(),
          admin_target_price: product.admin_target_price,
          buying_price: product.buying_price,
          buying_quantity: product.buying_quantity,
          seller_link: product.seller_link,
          seller_phone: product.seller_phone,
          payment_method: product.payment_method,
        })
        .eq('asin', product.asin);

      if (updatePurchaseError) throw updatePurchaseError;

      // Update usa_admin_validation status
      const { error: updateAdminError } = await supabase
        .from('usa_admin_validation')
        .update({
          admin_status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (updateAdminError) throw updateAdminError;

      fetchProducts();
    } catch (error: any) {
      alert(`Error confirming product: ${error.message}`);
    }
  };


  // Handle individual product reject
  const handleRejectProduct = async (productId: string) => {
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // ✅ SAVE TO HISTORY FIRST!
      setMovementHistory((prev) => ({
        ...prev,
        [activeTab]: {
          product,
          fromStatus: product.admin_status,
          toStatus: 'rejected'
        },
      }));

      // ... rest of the function
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
        // 1. Revert usa_purchases
        const { error: updatePurchaseError } = await supabase
          .from('usa_purchases')
          .update({
            admin_confirmed: false,
            admin_confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updatePurchaseError) {
          console.error('Error rolling back usa_purchases:', updatePurchaseError);
        }

        // 2. Revert usa_admin_validation status
        const { error: updateAdminError } = await supabase
          .from('usa_admin_validation')
          .update({
            admin_status: fromStatus || 'pending',
            confirmed_at: null,
          })
          .eq('asin', product.asin);

        if (updateAdminError) throw updateAdminError;

      } else if (toStatus === 'rejected') {
        // Rolling back from Reject
        const { error: updateAdminError } = await supabase
          .from('usa_admin_validation')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const pendingCount = products.filter((p) => p.admin_status === 'pending' || !p.admin_status).length;
  const rejectedCount = products.filter((p) => p.admin_status === 'rejected').length;
  const confirmedCount = products.filter(p => p.admin_status === 'confirmed').length; // ✅ ADD THIS
  const indiaCount = products.filter((p) => p.origin_india).length;
  const chinaCount = products.filter((p) => p.origin_china).length;

  return (
    <PageGuard>
      <div className="h-screen flex flex-col overflow-hidden bg-gray-50 p-4">
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Tabs - STICKY */}
          <div className="flex-none flex gap-2 mb-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'overview'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Overview
              {products.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {products.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('india')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'india'
                ? 'border-b-2 border-orange-600 text-orange-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              India
              {indiaCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {indiaCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('china')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'china'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              China
              {chinaCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {chinaCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'pending'
                ? 'border-b-2 border-yellow-600 text-yellow-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Pending
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>


            <button
              onClick={() => setActiveTab('confirm')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'confirm'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Confirm
              {confirmedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                  {confirmedCount}
                </span>
              )}
            </button>


            <button
              onClick={() => setActiveTab('reject')}
              className={`px-6 py-3 font-semibold transition-all ${activeTab === 'reject'
                ? 'border-b-2 border-red-600 text-red-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Reject
              {rejectedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {rejectedCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Bar + Buttons - Same Row */}
          <div className="flex-none mb-3 flex items-center justify-between gap-3">
            {/* Left: Search Input */}
            <input
              type="text"
              placeholder="Search by ASIN, Product Name, or Funnel Seller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Right: Buttons Group */}
            <div className="flex items-center gap-3">
              {/* Roll Back Button */}
              <button
                onClick={handleRollBack}
                disabled={!movementHistory[activeTab]}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium whitespace-nowrap"
                title="Roll Back last action from this tab (Ctrl+Z)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Roll Back
              </button>

              {/* Configure Constants Button */}
              <button
                onClick={() => setIsConstantsModalOpen(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configure Constants
              </button>
            </div>
          </div>

          <div className="text-xs text-blue-600 mb-2 px-4">
            💡 Tip: Double-click any column header to auto-fit its width
          </div>

          {/* Table - SCROLLABLE ONLY */}
          <div className="bg-white rounded-lg shadow flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full" ref={tableRef}>
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === products.length && products.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </th>

                    {/* ASIN Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('asin')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.asin, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>ASIN</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'asin')}
                          style={{
                            backgroundColor: resizingColumn === 'asin' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'asin' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Product Name Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('product_name')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.product_name, minWidth: 150 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Product Name</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'product_name')}
                          style={{
                            backgroundColor: resizingColumn === 'product_name' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'product_name' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Product Link Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('product_link')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.product_link, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Product Link</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'product_link')}
                          style={{
                            backgroundColor: resizingColumn === 'product_link' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'product_link' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Target Price Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('target_price')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.target_price, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Target Price</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'target_price')}
                          style={{
                            backgroundColor: resizingColumn === 'target_price' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'target_price' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Target Qty Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('target_qty')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.target_qty, minWidth: 70 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Target Qty</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'target_qty')}
                          style={{
                            backgroundColor: resizingColumn === 'target_qty' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'target_qty' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Admin Target Price Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('admintargetprice')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative bg-purple-50"
                      style={{ width: columnWidths.admintargetprice, minWidth: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Admin Target Price</span>
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                        onMouseDown={(e) => handleResizeStart(e, 'admintargetprice')}
                        style={{
                          backgroundColor: resizingColumn === 'admintargetprice' ? '#3b82f6' : 'transparent',
                          width: resizingColumn === 'admintargetprice' ? '3px' : '4px',
                        }}
                        title="Drag to resize | Double-click to auto-fit"
                      />
                    </th>

                    {/* Funnel Seller Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('funnel_seller')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.funnel_seller, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Seller Tag</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'funnel_seller')}
                          style={{
                            backgroundColor: resizingColumn === 'funnel_seller' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'funnel_seller' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Funnel Qty Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('funnel_qty')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.funnel_qty, minWidth: 70 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Funnel</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'funnel_qty')}
                          style={{
                            backgroundColor: resizingColumn === 'funnel_qty' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'funnel_qty' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Buying Price Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('buying_price')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.buying_price, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Buying Price</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'buying_price')}
                          style={{
                            backgroundColor: resizingColumn === 'buying_price' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'buying_price' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Buying Qty Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('buying_qty')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.buying_qty, minWidth: 70 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Buying Qty</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'buying_qty')}
                          style={{
                            backgroundColor: resizingColumn === 'buying_qty' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'buying_qty' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Profit Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('profit')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.profit, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Profit</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'profit')}
                          style={{
                            backgroundColor: resizingColumn === 'profit' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'profit' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Product Weight Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('product_weight')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.product_weight, minWidth: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Product Weight</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'product_weight')}
                          style={{
                            backgroundColor: resizingColumn === 'product_weight' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'product_weight' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* USD Price Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('usd_price')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.usd_price, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>USD Price</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'usd_price')}
                          style={{
                            backgroundColor: resizingColumn === 'usd_price' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'usd_price' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* INR Purchase Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('inr_purchase')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.inr_purchase, minWidth: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>INR Purchase</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'inr_purchase')}
                          style={{
                            backgroundColor: resizingColumn === 'inr_purchase' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'inr_purchase' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* INR Purchase Link Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('inr_purchase_link')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.inr_purchase_link, minWidth: 150 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>INR Purchase Link</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'inr_purchase_link')}
                          style={{
                            backgroundColor: resizingColumn === 'inr_purchase_link' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'inr_purchase_link' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Seller Link Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('seller_link')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.seller_link, minWidth: 80 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Seller Link</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'seller_link')}
                          style={{
                            backgroundColor: resizingColumn === 'seller_link' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'seller_link' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Seller Phone Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('seller_phone')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.seller_phone, minWidth: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Seller Ph No.</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'seller_phone')}
                          style={{
                            backgroundColor: resizingColumn === 'seller_phone' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'seller_phone' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Payment Method Column */}
                    <th
                      onDoubleClick={() => handleColumnDoubleClick('payment_method')}
                      className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider hover:bg-gray-100 relative"
                      style={{ width: columnWidths.payment_method, minWidth: 100 }}
                    >
                      <div className="flex items-center justify-between">
                        <span>Payment Method</span>
                        <div
                          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                          onMouseDown={(e) => handleResizeStart(e, 'payment_method')}
                          style={{
                            backgroundColor: resizingColumn === 'payment_method' ? '#3b82f6' : 'transparent',
                            width: resizingColumn === 'payment_method' ? '3px' : '4px'
                          }}
                          title="Drag to resize | Double-click to auto-fit"
                        />
                      </div>
                    </th>

                    {/* Actions Column (no resize) */}
                    {activeTab !== 'confirm' && activeTab !== 'reject' && (
                      <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={activeTab === 'confirm' || activeTab === 'reject' ? 14 : 15} className="px-4 py-8 text-center text-gray-500">
                        No products found in {activeTab}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{product.asin}</td>
                        <td
                          className="px-4 py-3 text-sm"
                          style={{
                            maxWidth: columnWidths.product_name,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={product.product_name || '-'}
                        >
                          {product.product_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="w-32">
                            {editingLinkId === product.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingLinkValue}
                                  onChange={(e) => setEditingLinkValue(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-xs focus:ring-1 focus:ring-blue-500"
                                  placeholder="URL..."
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCellEdit(product.id, 'product_link', editingLinkValue);
                                      setEditingLinkId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingLinkId(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    handleCellEdit(product.id, 'product_link', editingLinkValue);
                                    setEditingLinkId(null);
                                  }}
                                  className="text-green-600 hover:text-green-800 flex-shrink-0"
                                  title="Save (Enter)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingLinkId(null)}
                                  className="text-red-600 hover:text-red-800 flex-shrink-0"
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
                                      href={product.product_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                                    >
                                      View
                                    </a>
                                    <button
                                      onClick={() => {
                                        setEditingLinkId(product.id);
                                        setEditingLinkValue(product.product_link || '');
                                      }}
                                      className="text-gray-400 hover:text-orange-600 transition-colors flex-shrink-0"
                                      title="Edit link"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    className="text-green-600 hover:text-green-800 font-medium text-xs whitespace-nowrap"
                                  >
                                    + Add Link
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={product.target_price || ''}
                            onChange={(e) => handleCellEdit(product.id, 'target_price', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={product.target_quantity || ''}
                            onChange={(e) => handleCellEdit(product.id, 'target_quantity', parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                        </td>

                        {/* Admin Target Price Cell - Editable */}
                        <td className="px-4 py-3 bg-purple-50">
                          <input
                            type="number"
                            step="0.01"
                            value={product.admin_target_price || ''}
                            onChange={(e) => handleCellEdit(product.id, 'admin_target_price', parseFloat(e.target.value) || null)}
                            className="w-24 px-2 py-1 border border-purple-300 rounded text-sm focus:ring-1 focus:ring-purple-500"
                            placeholder="₹"
                          />
                        </td>

                        <td className="px-4 py-3 text-sm">
                          {product.seller_tag ? (
                            <div className="flex flex-wrap gap-2">
                              {product.seller_tag.split(',').map((tag) => {
                                const cleanTag = tag.trim();
                                return (
                                  <span
                                    key={cleanTag}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm ${cleanTag === 'GR'
                                      ? 'bg-yellow-400 text-black'
                                      : cleanTag === 'RR'
                                        ? 'bg-gray-400 text-black'
                                        : cleanTag === 'UB'
                                          ? 'bg-pink-500 text-white'
                                          : cleanTag === 'VV'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-slate-700 text-white'
                                      }`}
                                  >
                                    {cleanTag}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          {product.funnel ? (
                            <span
                              className={`w-9 h-9 inline-flex items-center justify-center rounded-full font-bold text-sm ${product.funnel === 1
                                ? 'bg-green-500 text-white'
                                : product.funnel === 2
                                  ? 'bg-blue-500 text-white'
                                  : product.funnel === 3
                                    ? 'bg-yellow-400 text-black'
                                    : 'bg-gray-400 text-white'
                                }`}
                            >
                              {product.funnel === 1
                                ? 'HD'
                                : product.funnel === 2
                                  ? 'LD'
                                  : product.funnel === 3
                                    ? 'DP'
                                    : product.funnel}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={product.buying_price || ''}
                            onChange={(e) => handleCellEdit(product.id, 'buying_price', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={product.buying_quantity || ''}
                            onChange={(e) => handleCellEdit(product.id, 'buying_quantity', parseInt(e.target.value))}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <input
                            type="number"
                            step="0.01"
                            value={product.profit || ''}
                            onChange={(e) => handleCellEdit(product.id, 'profit', parseFloat(e.target.value) || 0)}
                            className={`w-24 px-2 py-1 border rounded text-sm font-semibold ${(product.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          />
                        </td>

                        {/* Product Weight Cell - WITH SPINNER */}
                        <td className="px-4 py-3 text-sm">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={product.product_weight || ''}
                              onChange={(e) => handleCellEdit(product.id, 'product_weight', parseFloat(e.target.value) || null)}
                              className="w-20 px-2 py-1 border rounded text-sm"
                              placeholder="grams"
                            />
                            {calculatingIds.has(product.id) && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* USD Price Cell - WITH SPINNER */}
                        <td className="px-4 py-3 text-sm">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={product.usd_price || ''}
                              onChange={(e) => handleCellEdit(product.id, 'usd_price', parseFloat(e.target.value) || null)}
                              className="w-24 px-2 py-1 border rounded text-sm"
                              placeholder="$"
                            />
                            {calculatingIds.has(product.id) && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* INR Purchase Cell - WITH SPINNER */}
                        <td className="px-4 py-3 text-sm">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={product.inr_purchase || ''}
                              onChange={(e) => handleCellEdit(product.id, 'inr_purchase', parseFloat(e.target.value) || null)}
                              className="w-28 px-2 py-1 border rounded text-sm"
                              placeholder="₹"
                            />
                            {calculatingIds.has(product.id) && (
                              <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* INR Purchase Link Cell - Editable with View/Edit Pattern */}
                        <td className="px-4 py-3 text-sm">
                          <div className="w-32">
                            {editingLinkId === `inr-${product.id}` ? (
                              /* EDIT MODE - Show input field with Save/Cancel buttons */
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingLinkValue}
                                  onChange={(e) => setEditingLinkValue(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-xs focus:ring-1 focus:ring-blue-500"
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
                                  className="text-green-600 hover:text-green-800 flex-shrink-0"
                                  title="Save (Enter)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingLinkId(null)}
                                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                                  title="Cancel (Esc)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              /* VIEW MODE - Show View link with pencil icon or Add Link button */
                              <div className="flex items-center gap-2">
                                {product.inr_purchase_link && product.inr_purchase_link.trim() !== '' ? (
                                  <>
                                    <a
                                      href={product.inr_purchase_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                                    >
                                      View
                                    </a>
                                    <button
                                      onClick={() => {
                                        setEditingLinkId(`inr-${product.id}`);
                                        setEditingLinkValue(product.inr_purchase_link || '');
                                      }}
                                      className="text-gray-400 hover:text-orange-600 transition-colors flex-shrink-0"
                                      title="Edit supplier link"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                        />
                                      </svg>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingLinkId(`inr-${product.id}`);
                                      setEditingLinkValue('');
                                    }}
                                    className="text-green-600 hover:text-green-800 font-medium text-xs whitespace-nowrap"
                                  >
                                    + Add Link
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="w-32">
                            {editingLinkId === `seller_${product.id}` ? (
                              // EDIT MODE: Show input field with Save/Cancel buttons
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingLinkValue}
                                  onChange={(e) => setEditingLinkValue(e.target.value)}
                                  className="w-full px-2 py-1 border border-blue-500 rounded text-xs focus:ring-1 focus:ring-blue-500"
                                  placeholder="Amazon URL..."
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleCellEdit(product.id, 'seller_link', editingLinkValue);
                                      setEditingLinkId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingLinkId(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    handleCellEdit(product.id, 'seller_link', editingLinkValue);
                                    setEditingLinkId(null);
                                  }}
                                  className="text-green-600 hover:text-green-800 flex-shrink-0"
                                  title="Save (Enter)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingLinkId(null)}
                                  className="text-red-600 hover:text-red-800 flex-shrink-0"
                                  title="Cancel (Esc)"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              // VIEW MODE: Show View link with pencil icon
                              <div className="flex items-center gap-2">
                                {product.seller_link && product.seller_link.trim() !== '' ? (
                                  <>
                                    <a
                                      href={product.seller_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium whitespace-nowrap"
                                    >
                                      View
                                    </a>
                                    <button
                                      onClick={() => {
                                        setEditingLinkId(`seller_${product.id}`);
                                        setEditingLinkValue(product.seller_link || '');
                                      }}
                                      className="text-gray-400 hover:text-orange-600 transition-colors flex-shrink-0"
                                      title="Edit seller link"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                    className="text-green-600 hover:text-green-800 font-medium text-xs whitespace-nowrap"
                                  >
                                    + Add Link
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={product.seller_phone || ''}
                            onChange={(e) => handleCellEdit(product.id, 'seller_phone', e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-sm"
                            placeholder="Phone"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={product.payment_method || ''}
                            onChange={(e) => handleCellEdit(product.id, 'payment_method', e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-sm"
                            placeholder="Method"
                          />
                        </td>
                        {/* ❌ Hide Origin in Overview tab */}
                        {activeTab !== 'overview' && (
                          <td className="px-4 py-3 text-sm">
                            <div className="flex gap-2">
                              {product.origin_india && (
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                  India
                                </span>
                              )}
                              {product.origin_china && (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                                  China
                                </span>
                              )}
                            </div>
                          </td>
                        )}

                        {activeTab !== 'confirm' && activeTab !== 'reject' && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* Confirm Button */}
                              <button
                                onClick={() => handleConfirmProduct(product.id)}
                                disabled={product.admin_status === 'confirmed'}
                                className={`p-2 rounded-lg transition-all ${product.admin_status === 'confirmed'
                                  ? 'bg-green-100 text-green-600 cursor-not-allowed'
                                  : 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white'
                                  }`}
                                title="Confirm"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>

                              {/* Reject Button */}
                              <button
                                onClick={() => handleRejectProduct(product.id)}
                                disabled={product.admin_status === 'rejected'}
                                className={`p-2 rounded-lg transition-all ${product.admin_status === 'rejected'
                                  ? 'bg-red-100 text-red-600 cursor-not-allowed'
                                  : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'
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
            <div className="flex-none border-t bg-white px-4 py-3 text-sm text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
            </div>
          </div>
          {/* ✅ CONSTANTS CONFIGURATION MODAL */}
          {isConstantsModalOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={() => setIsConstantsModalOpen(false)}
              ></div>

              {/* Modal */}
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-xl">
                    <h2 className="text-2xl font-bold">Admin Calculation Constants</h2>
                    <p className="text-purple-100 mt-1">Configure constants for profit calculation (Admin only)</p>
                  </div>

                  {/* Form */}
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dollar Rate (₹)
                      </label>
                      <input
                        type="number"
                        value={adminConstants.dollar_rate}
                        onChange={(e) => setAdminConstants({ ...adminConstants, dollar_rate: parseFloat(e.target.value) || 90 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Fee (%)
                      </label>
                      <input
                        type="number"
                        value={adminConstants.bank_conversion_rate * 100}
                        onChange={(e) => setAdminConstants({ ...adminConstants, bank_conversion_rate: (parseFloat(e.target.value) || 2) / 100 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Shipping per 1000g (₹)
                      </label>
                      <input
                        type="number"
                        value={adminConstants.shipping_charge_per_kg}
                        onChange={(e) => setAdminConstants({ ...adminConstants, shipping_charge_per_kg: parseFloat(e.target.value) || 950 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        value={adminConstants.commission_rate * 100}
                        onChange={(e) => setAdminConstants({ ...adminConstants, commission_rate: (parseFloat(e.target.value) || 25) / 100 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Packing Cost (₹)
                      </label>
                      <input
                        type="number"
                        value={adminConstants.packing_cost}
                        onChange={(e) => setAdminConstants({ ...adminConstants, packing_cost: parseFloat(e.target.value) || 25 })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
                        step="0.01"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t bg-gray-50 flex items-center justify-end gap-3 rounded-b-xl">
                    <button
                      onClick={() => setIsConstantsModalOpen(false)}
                      className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAdminConstants}
                      disabled={isSavingConstants}
                      className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSavingConstants ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
        {/* ✅ ADD TOAST COMPONENT HERE */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </PageGuard>
  );
}
