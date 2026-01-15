'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';

type AdminProduct = {
  id: string;
  asin: string;
  product_name: string | null;
  product_link: string | null;
  funnel_seller: string | null;
  origin_india: boolean | null;
  origin_china: boolean | null;
  target_price: number | null;
  target_quantity: number | null;
  buying_price: number | null;
  buying_quantity: number | null;
  funnel_quantity: number | null;
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

  // Fetch products from usa_admin_validation table
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usa_admin_validation')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching admin validation products:', error);
    } finally {
      setLoading(false);
    }
  };

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

  // Filter products based on active tab
  const filteredProducts = products.filter((product) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      product.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.funnel_seller?.toLowerCase().includes(searchQuery.toLowerCase());

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
        return true;
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

  // Handle inline editing
  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('usa_admin_validation')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
      fetchProducts();
    } catch (error: any) {
      alert('Error updating: ' + error.message);
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
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Validation</h1>
          <p className="text-gray-600 mt-1">Review and confirm purchase orders</p>
        </div>
        <button
          onClick={handleConfirmSelected}
          disabled={selectedIds.size === 0}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${selectedIds.size > 0
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          ✓ Confirm ({selectedIds.size})
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
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

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ASIN, Product Name, or Funnel Seller..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Stats */}
      <div className="mb-6 text-sm text-gray-600">
        Showing {filteredProducts.length} products | {selectedIds.size} selected
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ASIN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Funnel Seller</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Funnel Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Buying Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Buying Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Seller Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Seller Ph No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Origin</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
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
                    <td className="px-4 py-3 text-sm text-gray-900">{product.product_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="w-32">  {/* ✅ Fixed width container */}
                        {editingLinkId === product.id ? (
                          // EDIT MODE: Show input field with Save/Cancel buttons
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
                          // VIEW MODE: Show View link with pencil icon
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
                    <td className="px-4 py-3 text-sm text-gray-900">{product.funnel_seller || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{product.funnel_quantity || '-'}</td>
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
                    {/* ✅ ADD THIS: PROFIT CELL */}
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`font-semibold ${(product.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        ₹{(product.profit || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.seller_link || ''}
                        onChange={(e) => handleCellEdit(product.id, 'seller_link', e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-sm"
                        placeholder="Link"
                      />
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
                    <td className="px-4 py-3">
                      {product.origin_india && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded mr-1">India</span>
                      )}
                      {product.origin_china && (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">China</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs rounded ${product.admin_status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : product.admin_status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}
                      >
                        {product.admin_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
