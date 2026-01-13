'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect } from 'react';
import { AdminValidation } from '@/types/purchases';

type TabType = 'overview' | 'india' | 'china' | 'pending' | 'reject';

export default function AdminValidationPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [products, setProducts] = useState<AdminValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<any>('');

  // Fetch admin validation products
  const fetchProducts = async () => {
    try {
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
  }, []);

  // Real-time subscription
  useEffect(() => {
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

  // Filter products by tab
  const filteredProducts = products.filter((p) => {
    // Search filter
    const matchesSearch =
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.funnel_seller?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter
    switch (activeTab) {
      case 'overview':
        return p.admin_status === 'pending';
      case 'india':
        return p.origin_india && p.admin_status === 'pending';
      case 'china':
        return p.origin_china && p.admin_status === 'pending';
      case 'pending':
        return p.admin_status === 'pending' && p.created_at === p.updated_at;
      case 'reject':
        return p.admin_status === 'rejected';
      default:
        return true;
    }
  });

  // Handle cell edit
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

  // Handle bulk select
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

  // Handle confirm selected
  const handleConfirmSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select products to confirm');
      return;
    }

    try {
      const selectedProducts = products.filter((p) => selectedIds.has(p.id));

      for (const product of selectedProducts) {
        // 1. Update admin_validation status
        await supabase
          .from('usa_admin_validation')
          .update({
            admin_status: 'confirmed',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        // 2. Update corresponding purchase
        if (product.purchase_id) {
          await supabase
            .from('usa_purchases')
            .update({
              status: 'admin_confirmed',
              admin_confirmed_at: new Date().toISOString(),
              // Copy all edited fields from admin validation
              product_link: product.product_link,
              product_name: product.product_name,
              target_price: product.target_price,
              target_quantity: product.target_quantity,
              funnel_quantity: product.funnel_quantity,
              funnel_seller: product.funnel_seller,
              buying_price: product.buying_price,
              buying_quantity: product.buying_quantity,
              seller_link: product.seller_link,
              seller_phone: product.seller_phone,
              payment_method: product.payment_method,
            })
            .eq('id', product.purchase_id);
        }
      }

      alert(`✅ Successfully confirmed ${selectedIds.size} products!`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error: any) {
      alert('❌ Error confirming products: ' + error.message);
    }
  };

  // Handle reject
  const handleReject = async (id: string, notes: string) => {
    try {
      await supabase
        .from('usa_admin_validation')
        .update({
          admin_status: 'rejected',
          rejected_at: new Date().toISOString(),
          admin_notes: notes,
        })
        .eq('id', id);

      alert('✅ Product rejected successfully!');
      fetchProducts();
    } catch (error: any) {
      alert('❌ Error rejecting product: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading admin validation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Validation</h1>
          <p className="text-gray-600 mt-1">Review and confirm purchase orders</p>
        </div>
        
        {/* Confirm Button */}
        <button
          onClick={handleConfirmSelected}
          disabled={selectedIds.size === 0}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-md flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Confirm {selectedIds.size > 0 && `(${selectedIds.size})`}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('india')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'india'
              ? 'border-b-2 border-orange-600 text-orange-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          India
        </button>
        <button
          onClick={() => setActiveTab('china')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'china'
              ? 'border-b-2 border-red-600 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          China
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'pending'
              ? 'border-b-2 border-yellow-600 text-yellow-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab('reject')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'reject'
              ? 'border-b-2 border-red-600 text-red-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Reject
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ASIN, Product Name, or Funnel Seller..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ASIN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Target Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Funnel Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Funnel Seller</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Buying Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Buying Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Seller Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Seller Ph no.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Payment Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
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
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.product_link || ''}
                        onChange={(e) => handleCellEdit(product.id, 'product_link', e.target.value)}
                        className="w-full min-w-[200px] px-2 py-1 border rounded text-sm"
                        placeholder="Product link"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.product_name || ''}
                        onChange={(e) => handleCellEdit(product.id, 'product_name', e.target.value)}
                        className="w-full min-w-[150px] px-2 py-1 border rounded text-sm"
                        placeholder="Product name"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={product.target_price || ''}
                        onChange={(e) => handleCellEdit(product.id, 'target_price', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={product.target_quantity || ''}
                        onChange={(e) => handleCellEdit(product.id, 'target_quantity', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Qty"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={product.funnel_quantity || ''}
                        onChange={(e) => handleCellEdit(product.id, 'funnel_quantity', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Qty"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.funnel_seller || ''}
                        onChange={(e) => handleCellEdit(product.id, 'funnel_seller', e.target.value)}
                        className="w-32 px-2 py-1 border rounded text-sm"
                        placeholder="Seller"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={product.buying_price || ''}
                        onChange={(e) => handleCellEdit(product.id, 'buying_price', parseFloat(e.target.value))}
                        className="w-24 px-2 py-1 border rounded text-sm"
                        placeholder="Price"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={product.buying_quantity || ''}
                        onChange={(e) => handleCellEdit(product.id, 'buying_quantity', parseInt(e.target.value))}
                        className="w-20 px-2 py-1 border rounded text-sm"
                        placeholder="Qty"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.seller_link || ''}
                        onChange={(e) => handleCellEdit(product.id, 'seller_link', e.target.value)}
                        className="w-full min-w-[200px] px-2 py-1 border rounded text-sm"
                        placeholder="Seller link"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.seller_phone || ''}
                        onChange={(e) => handleCellEdit(product.id, 'seller_phone', e.target.value)}
                        className="w-32 px-2 py-1 border rounded text-sm"
                        placeholder="Phone"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={product.payment_method || ''}
                        onChange={(e) => handleCellEdit(product.id, 'payment_method', e.target.value)}
                        className="w-32 px-2 py-1 border rounded text-sm"
                        placeholder="Method"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          const notes = prompt('Enter rejection reason:');
                          if (notes) handleReject(product.id, notes);
                        }}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredProducts.length} products | {selectedIds.size} selected
      </div>
    </div>
  );
}
