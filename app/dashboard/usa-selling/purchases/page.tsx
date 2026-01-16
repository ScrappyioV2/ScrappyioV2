'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

type PassFileProduct = {
  id: string;
  asin: string;
  product_name: string | null;
  brand: string | null;
  seller_tag: string | null;
  funnel: string | null;
  origin_india: boolean | null;
  origin_china: boolean | null;
  usd_price: number | null;
  inr_purchase: number | null;
  usa_link: string | null;
  product_link: string | null;
  target_price: number | null;
  target_quantity: number | null;
  funnel_quantity: number | null;
  funnel_seller: string | null;
  buying_price: number | null;
  buying_quantity: number | null;
  seller_link: string | null;
  seller_phone: string | null;
  payment_method: string | null;
  tracking_details: string | null;
  delivery_date: string | null;
  status: string | null;
  move_to: string | null;
  sent_to_admin: boolean | null;
  sent_to_admin_at: string | null;
  admin_confirmed: boolean | null;  // ✅ Match DB column name
  admin_confirmed_at: string | null;  // ✅ Match DB column name
  check_brand: boolean | null;
  check_item_expire: boolean | null;
  check_small_size: boolean | null;
  check_multi_seller: boolean | null;
  created_at: string | null;
  inr_purchase_link?: string | null;
  validation_funnel_seller?: string | null
  validation_funnel_quantity?: number | null
  validation_seller_tag?: string | null;  // For Funnel Seller column
  validation_funnel?: string | null;       // For Funnel Quantity column
};

type TabType = 'main_file' | 'price_wait' | 'order_confirmed' | 'china' | 'india' | 'pending' | 'not_found' | 'reject';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('main_file');
  const [products, setProducts] = useState<PassFileProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchProducts = async () => {
    try {
      setLoading(true);

      // Fetch purchases...
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('usa_purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (purchasesError) throw purchasesError;

      // Fetch validation data for seller_tag and funnel badges
      const enrichedData = await Promise.all(
        purchasesData.map(async (product) => {
          // Fetch from validation main file table
          const { data: validationData } = await supabase
            .from('usa_validation_main_file')
            .select('seller_tag, funnel')
            .eq('asin', product.asin)
            .maybeSingle();

          return {
            ...product,
            validation_funnel: validationData?.funnel || null,      // HD, LD, DP
            validation_seller_tag: validationData?.seller_tag || null,  // UB, GR, RR
          };
        })
      );

      setProducts(enrichedData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel('purchases_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usa_purchases' },  // ✅ CORRECT
        () => fetchProducts()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Column widths state for resizable columns
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    checkbox: 50,
    asin: 120,
    product_link: 80,
    product_name: 200,
    targetprice: 130,        // ✅ Increased from 100 to 150
    targetquantity: 130,
    funnel_quantity: 120,
    funnel_seller: 100,
    buying_price: 100,
    buying_quantity: 120,
    seller_link: 100,
    seller_ph_no: 120,
    payment_method: 120,
    tracking_details: 150,
    delivery_date: 150,
    move_to: 150,
  });

  const [resizing, setResizing] = useState<{ column: string, startX: number, startWidth: number } | null>(null);

  // Handle sending to admin validation
  const handleSendToAdmin = async (product: PassFileProduct) => {
    try {
      // ✅ ADD THIS: Fetch profit from validation table
      const { data: validationData } = await supabase
        .from('usa_validation_main_file')
        .select('profit, total_cost, total_revenue')
        .eq('asin', product.asin)
        .maybeSingle();

      const { error: insertError } = await supabase.from('usa_admin_validation').insert({
        asin: product.asin,
        product_name: product.product_name,
        product_link: product.usa_link || product.product_link,
        funnel_seller: product.funnel || product.funnel_seller,
        origin_india: product.origin_india,
        origin_china: product.origin_china,
        target_price: product.target_price || product.usd_price,
        target_quantity: product.target_quantity || 1,
        buying_price: product.buying_price || product.inr_purchase,
        buying_quantity: product.buying_quantity || 1,
        funnel_quantity: product.funnel_quantity || 1,
        seller_link: product.seller_link || '',
        seller_phone: product.seller_phone || '',
        payment_method: product.payment_method || '',
        admin_status: 'pending',

        // ✅ ADD THESE 3 LINES:
        profit: validationData?.profit || 0,
        total_cost: validationData?.total_cost || 0,
        total_revenue: validationData?.total_revenue || 0,
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('usa_purchases')  // ✅ CORRECT
        .update({
          sent_to_admin: true,
          sent_to_admin_at: new Date().toISOString(),
        })
        .eq('id', product.id);  // Use ID not ASIN

      if (updateError) throw updateError;

      alert('✅ Sent to Admin Validation successfully!');
      fetchProducts();
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    }
  };

  // Handle Price Wait
  const handlePriceWait = async (product: PassFileProduct) => {
    try {
      const { error } = await supabase
        .from('usa_purchases')
        .update({ move_to: 'price_wait' })
        .eq('id', product.id);

      if (error) throw error;

      alert('Moved to Price Wait successfully!');
      fetchProducts();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  // Handle Not Found
  const handleNotFound = async (product: PassFileProduct) => {
    try {
      const { error } = await supabase
        .from('usa_purchases')
        .update({ move_to: 'not_found' })
        .eq('id', product.id);

      if (error) throw error;

      alert('Marked as Not Found successfully!');
      fetchProducts();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
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

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.funnel?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'main_file':
        return !p.sent_to_admin && !p.move_to;
      case 'price_wait':
        return p.move_to === 'price_wait';
      case 'order_confirmed':
        return p.admin_confirmed === true;
      case 'china':
        return p.origin_china === true;
      case 'india':
        return p.origin_india === true;
      case 'pending':
        return p.status === 'pending';
      case 'not_found':
        return p.move_to === 'not_found';
      case 'reject':
        return p.move_to === 'reject';
      default:
        return true;
    }
  });

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
    try {
      const { error } = await supabase
        .from("usa_purchases")  // CORRECT!
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;
      fetchProducts();
    } catch (error: any) {
      alert('Error updating: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading purchases...</div>
      </div>
    );
  }

  const tabs = [
    { key: 'main_file', label: 'Main File', count: products.filter(p => !p.sent_to_admin && !p.move_to).length },
    { key: 'price_wait', label: 'Price Wait', count: products.filter(p => p.move_to === 'price_wait').length },
    { key: 'order_confirmed', label: 'Order Confirmed', count: products.filter(p => p.admin_confirmed === true).length, },
    { key: 'china', label: 'China', count: products.filter(p => p.origin_china).length },
    { key: 'india', label: 'India', count: products.filter(p => p.origin_india).length },
    { key: 'pending', label: 'Pending', count: products.filter(p => p.status === 'pending').length },
    { key: 'not_found', label: 'Not Found', count: products.filter(p => p.move_to === 'not_found').length },
    { key: 'reject', label: 'Reject', count: products.filter(p => p.move_to === 'reject').length },
  ];



  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header Section - FIXED */}
      <div className="flex-none px-6 pt-6 pb-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
          <p className="text-gray-600 mt-1">Manage purchase orders and track confirmations</p>
        </div>

        {/* Tabs - FIXED */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("main_file")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "main_file"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Main File
          </button>
          <button
            onClick={() => setActiveTab("price_wait")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "price_wait"
              ? "border-yellow-600 text-yellow-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Price Wait
          </button>
          <button
            onClick={() => setActiveTab("order_confirmed")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "order_confirmed"
              ? "border-green-600 text-green-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Order Confirmed
          </button>
          <button
            onClick={() => setActiveTab("china")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "china"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            China
          </button>
          <button
            onClick={() => setActiveTab("india")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "india"
              ? "border-orange-600 text-orange-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            India
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "pending"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab("reject")}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === "reject"
              ? "border-gray-600 text-gray-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
          >
            Reject
          </button>
          <button
            onClick={() => setActiveTab('not_found')}
            className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'not_found'
              ? 'border-gray-600 text-gray-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            Not Found
          </button>
        </div>

        {/* Search - FIXED */}
        <div>
          <input
            type="text"
            placeholder="Search by ASIN, Product Name, or Funnel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table Container - SCROLLABLE ONLY */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="bg-white rounded-lg shadow h-full flex flex-col">
          {/* Table Wrapper with Scroll */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.checkbox}px` }}>
                    <input type="checkbox" checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0} onChange={(e) => handleSelectAll(e.target.checked)} className="rounded" />
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('checkbox', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.asin}px` }}>
                    ASIN
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('asin', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.product_link}px` }}>
                    Product Link
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('product_link', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.product_name}px` }}>
                    Product Name
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('product_name', e)} />
                  </th>
                  {/* Target Price */}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.targetprice}px` }}>
                    Target Price
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('targetprice', e)} />
                  </th>
                  {/* Target Quantity */}
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.targetquantity}px` }}>
                    Target Quantity
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('targetquantity', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.funnel_quantity}px` }}>
                    Funnel Quantity
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('funnel_quantity', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.funnel_seller}px` }}>
                    Funnel Seller
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('funnel_seller', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.buying_price}px` }}>
                    Buying Price
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('buying_price', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.buying_quantity}px` }}>
                    Buying Quantity
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('buying_quantity', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.seller_link}px` }}>
                    Seller Link
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('seller_link', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.seller_ph_no}px` }}>
                    Seller Ph No.
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('seller_ph_no', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.payment_method}px` }}>
                    Payment Method
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('payment_method', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.tracking_details}px` }}>
                    Tracking Details
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('tracking_details', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase bg-green-50 relative group" style={{ width: `${columnWidths.delivery_date}px` }}>
                    Delivery Date
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('delivery_date', e)} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase relative group" style={{ width: `${columnWidths.move_to}px` }}>
                    Move TO
                    <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" onMouseDown={(e) => handleMouseDown('move_to', e)} />
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-center text-gray-500">
                      No products available in {activeTab.replace('_', ' ')}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    return (
                      <tr key={product.id} className="hover:bg-gray-50 group">
                        {/* Checkbox */}
                        <td className="px-4 py-2 text-center overflow-hidden" style={{ width: `${columnWidths.checkbox}px` }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>

                        {/* ASIN */}
                        <td className="px-3 py-2 font-mono text-sm overflow-hidden" style={{ width: `${columnWidths.asin}px` }}>
                          <div className="truncate">{product.asin}</div>
                        </td>

                        {/* Product Link */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.product_link}px` }}>
                          {product.usa_link || product.product_link ? (
                            <a
                              href={product.usa_link || product.product_link || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs truncate block"
                            >
                              View
                            </a>
                          ) : (
                            <input
                              type="text"
                              defaultValue={product.product_link || ""}
                              onBlur={(e) => handleCellEdit(product.id, 'product_link', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-xs"
                              placeholder="Link"
                            />
                          )}
                        </td>

                        {/* Product Name */}
                        <td className="px-3 py-2 text-sm overflow-hidden" style={{ width: `${columnWidths.product_name}px` }}>
                          <div className="truncate">{product.product_name || '-'}</div>
                        </td>

                        {/* Target Price */}
                        <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.targetprice}px` }}>
                          {activeTab === 'order_confirmed' ? (
                            <input
                              type="number"
                              defaultValue={product.target_price ?? product.usd_price ?? ''}
                              onBlur={(e) => handleCellEdit(product.id, 'target_price', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                              placeholder="$"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">After confirmation</span>
                          )}
                        </td>

                        {/* Target Quantity */}
                        <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.targetquantity}px` }}>
                          {activeTab === 'order_confirmed' ? (
                            <input
                              type="number"
                              defaultValue={product.target_quantity ?? 1}
                              onBlur={(e) => handleCellEdit(product.id, 'target_quantity', parseInt(e.target.value))}
                              className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                              placeholder="Qty"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">After confirmation</span>
                          )}
                        </td>

                        {/* Funnel Quantity - Shows Funnel Badge from Validation */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelquantity}px` }}>
                          {product.validation_funnel ? (
                            <span className={`w-9 h-9 inline-flex items-center justify-center rounded-full font-bold text-sm ${product.validation_funnel === 'HD' ? 'bg-green-500 text-white' :
                              product.validation_funnel === 'LD' ? 'bg-blue-500 text-white' :
                                product.validation_funnel === 'DP' ? 'bg-yellow-400 text-black' :
                                  'bg-gray-400 text-white'
                              }`}>
                              {product.validation_funnel}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">-</span>
                          )}
                        </td>

                        {/* Funnel Seller - Shows Seller Tags from Validation */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.funnelseller}px` }}>
                          {product.validation_seller_tag ? (
                            <div className="flex flex-wrap gap-2">
                              {product.validation_seller_tag.split(',').map((tag) => {
                                const cleanTag = tag.trim();
                                return (
                                  <span
                                    key={cleanTag}
                                    className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm ${cleanTag === 'GR' ? 'bg-yellow-400 text-black' :
                                        cleanTag === 'RR' ? 'bg-gray-400 text-black' :
                                          cleanTag === 'UB' ? 'bg-pink-500 text-white' :
                                            cleanTag === 'VV' ? 'bg-purple-600 text-white' :
                                              'bg-slate-700 text-white'
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

                        {/* Buying Price */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingprice}px` }}>
                          <input
                            type="number"
                            defaultValue={product.buying_price || ""}
                            onBlur={(e) => handleCellEdit(product.id, 'buying_price', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="₹"
                          />
                        </td>

                        {/* Buying Quantity */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.buyingquantity}px` }}>
                          <input
                            type="number"
                            defaultValue={product.buying_quantity ?? 1}
                            onBlur={(e) => handleCellEdit(product.id, 'buying_quantity', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Qty"
                          />
                        </td>

                        {/* Seller Link */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerlink}px` }}>
                          <input
                            type="text"
                            defaultValue={product.seller_link || ""}
                            onBlur={(e) => handleCellEdit(product.id, 'seller_link', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Link"
                          />
                        </td>

                        {/* Seller Phone */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.sellerphno}px` }}>
                          <input
                            type="text"
                            defaultValue={product.seller_phone || ""}
                            onBlur={(e) => handleCellEdit(product.id, 'seller_phone', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Phone"
                          />
                        </td>

                        {/* Payment Method */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.paymentmethod}px` }}>
                          <input
                            type="text"
                            defaultValue={product.payment_method || ""}
                            onBlur={(e) => handleCellEdit(product.id, 'payment_method', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-xs"
                            placeholder="Method"
                          />
                        </td>

                        {/* Tracking Details */}
                        <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.trackingdetails}px` }}>
                          {activeTab === 'order_confirmed' ? (
                            <input
                              type="text"
                              defaultValue={product.tracking_details || ""}
                              onBlur={(e) => handleCellEdit(product.id, 'tracking_details', e.target.value)}
                              className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                              placeholder="Tracking #"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">After confirmation</span>
                          )}
                        </td>

                        {/* Delivery Date */}
                        <td className="px-3 py-2 bg-green-50 overflow-hidden" style={{ width: `${columnWidths.deliverydate}px` }}>
                          {activeTab === 'order_confirmed' ? (
                            <input
                              type="date"
                              defaultValue={product.delivery_date || ""}
                              onBlur={(e) => handleCellEdit(product.id, 'delivery_date', e.target.value)}
                              className="w-full px-2 py-1 border border-green-300 rounded text-xs bg-white"
                            />
                          ) : (
                            <span className="text-xs text-gray-400 italic">After confirmation</span>
                          )}
                        </td>



                        {/* Move TO Buttons */}
                        <td className="px-3 py-2 overflow-hidden" style={{ width: `${columnWidths.move_to}px` }}>
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => handleSendToAdmin(product)}
                              className="w-8 h-8 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center justify-center flex-shrink-0"
                              title="Done"
                            >
                              D
                            </button>
                            <button
                              onClick={() => handlePriceWait(product)}
                              className="w-8 h-8 bg-yellow-600 text-white text-xs font-bold rounded hover:bg-yellow-700 flex items-center justify-center flex-shrink-0"
                              title="Price Wait"
                            >
                              PW
                            </button>
                            <button
                              onClick={() => handleNotFound(product)}
                              className="w-8 h-8 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 flex items-center justify-center flex-shrink-0"
                              title="Not Found"
                            >
                              NF
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })

                )}
              </tbody>
            </table>
          </div>
          {/* Footer Stats - FIXED */}
          <div className="flex-none border-t bg-gray-50 px-4 py-3">
            <div className="text-sm text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
              {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}
