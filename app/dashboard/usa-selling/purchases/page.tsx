'use client';

import { supabase } from '@/lib/supabaseClient';
import { useState, useEffect, useRef } from 'react';
import { PassFileProduct, Purchase } from '@/types/purchases';

type TabType = 'main_file' | 'confirmed';

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('main_file');
  const [passFileProducts, setPassFileProducts] = useState<PassFileProduct[]>([]);
  const [confirmedPurchases, setConfirmedPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<any>('');

  // Fetch pass file products
  const fetchPassFileProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('usa_validation_pass_file')
        .select('*')
        .eq('checklist_completed', true)
        .eq('sent_to_admin', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPassFileProducts(data || []);
    } catch (error) {
      console.error('Error fetching pass file products:', error);
    }
  };

  // Fetch confirmed purchases
  const fetchConfirmedPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('usa_purchases')
        .select('*')
        .eq('status', 'admin_confirmed')
        .order('admin_confirmed_at', { ascending: false });

      if (error) throw error;
      setConfirmedPurchases(data || []);
    } catch (error) {
      console.error('Error fetching confirmed purchases:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPassFileProducts(), fetchConfirmedPurchases()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const passFileChannel = supabase
      .channel('pass_file_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usa_validation_pass_file' },
        () => fetchPassFileProducts()
      )
      .subscribe();

    const purchasesChannel = supabase
      .channel('purchases_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usa_purchases' },
        () => fetchConfirmedPurchases()
      )
      .subscribe();

    return () => {
      passFileChannel.unsubscribe();
      purchasesChannel.unsubscribe();
    };
  }, []);

  // Handle sending to admin
  const handleSendToAdmin = async (product: PassFileProduct, purchaseData: any) => {
    try {
      const response = await fetch('/api/usa-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passFileData: product, purchaseData }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      alert('✅ Sent to Admin successfully!');
      fetchPassFileProducts();
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    }
  };

  // Handle bulk select
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = activeTab === 'main_file' 
        ? new Set(filteredPassFile.map(p => p.id))
        : new Set(filteredConfirmed.map(p => p.id));
      setSelectedIds(ids);
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

  // Filter products
  const filteredPassFile = passFileProducts.filter(
    (p) =>
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.funnel?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConfirmed = confirmedPurchases.filter(
    (p) =>
      p.asin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Inline editing for confirmed purchases
  const handleCellEdit = async (id: string, field: string, value: any) => {
    try {
      const response = await fetch('/api/usa-purchases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates: { [field]: value } }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      fetchConfirmedPurchases();
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Purchases</h1>
        <p className="text-gray-600 mt-1">Manage purchase orders and track confirmations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('main_file')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'main_file'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Main File
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`px-6 py-3 font-semibold transition-all ${
            activeTab === 'confirmed'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Confirmed
          {confirmedPurchases.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {confirmedPurchases.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by ASIN, Product Name, or Funnel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Main File Table */}
      {activeTab === 'main_file' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredPassFile.length && filteredPassFile.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ASIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Seller Tag</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Funnel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Origin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Move TO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPassFile.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No products available in Main File
                    </td>
                  </tr>
                ) : (
                  filteredPassFile.map((product) => (
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
                      <td className="px-4 py-3 text-sm text-gray-900">{product.brand || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{product.seller_tag || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{product.funnel || '-'}</td>
                      <td className="px-4 py-3">
                        {product.origin_india && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">India</span>
                        )}
                        {product.origin_china && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded ml-1">China</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const purchaseData = {
                                product_link: product.usa_link,
                                target_price: product.usd_price,
                                target_quantity: 1,
                                funnel_quantity: 1,
                                funnel_seller: product.funnel,
                                buying_price: product.inr_purchase,
                                buying_quantity: 1,
                                seller_link: '',
                                seller_phone: '',
                                payment_method: '',
                              };
                              handleSendToAdmin(product, purchaseData);
                            }}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded"
                          >
                            Done
                          </button>
                          <button className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded">
                            Price Wait
                          </button>
                          <button className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded">
                            Not Found
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmed Table */}
      {activeTab === 'confirmed' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredConfirmed.length && filteredConfirmed.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">ASIN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tracking Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Delivery Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredConfirmed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No confirmed purchases yet
                    </td>
                  </tr>
                ) : (
                  filteredConfirmed.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(purchase.id)}
                          onChange={(e) => handleSelectRow(purchase.id, e.target.checked)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{purchase.asin}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{purchase.product_name || '-'}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={purchase.tracking_details || ''}
                          onChange={(e) => handleCellEdit(purchase.id, 'tracking_details', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Enter tracking details"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={purchase.delivery_date || ''}
                          onChange={(e) => handleCellEdit(purchase.id, 'delivery_date', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                          {purchase.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
