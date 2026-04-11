'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ShipmentItem = {
    id: string;
    invoice_number: string;
    invoice_date: string;
    gst_number: string;
    asin: string;
    product_name: string;
    product_weight: number;
    buying_price: number;
    buying_quantity: number;
    amount: number;
    cgst: number;
    sgst: number;
    tax_amount: number;
    total_amount: number;
    tracking_details: string;
    delivery_date: string;
    seller_company: string;
    uploaded_invoice_url: string;
    uploaded_invoice_name: string;
    moved_at: string;
};

interface ShipmentTableProps {
    sellerId: number;
    onCountsChange?: () => void | Promise<void>;
}

export default function ShipmentTable({
    sellerId,
    onCountsChange
}: ShipmentTableProps) {
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [items, setItems] = useState<ShipmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchShipmentData = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('tracking_ops')
                .select('*')
                .eq('marketplace', 'flipkart')
                .eq('seller_id', sellerId)
                .eq('ops_type', 'shipment')
                .order('moved_at', { ascending: false });

            if (error) throw error;

            setItems(data || []);
        } catch (error) {
            console.error('Error fetching shipment data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipmentData();
    }, [sellerId]);

    // Move to Vyapar
    // Move to Restock
    const handleMoveToRestock = async (invoiceNumber: string) => {
        const confirmMove = confirm(`Move invoice ${invoiceNumber} to Restock?`);
        if (!confirmMove) return;

        try {

            // 1. Get all items for this invoice from tracking_ops (ops_type='shipment')
            const { data: itemsToMove, error: fetchError } = await supabase
                .from('tracking_ops')
                .select('*')
                .eq('marketplace', 'flipkart')
                .eq('seller_id', sellerId)
                .eq('ops_type', 'shipment')
                .eq('invoice_number', invoiceNumber);

            if (fetchError) throw fetchError;

            if (!itemsToMove || itemsToMove.length === 0) {
                setToast({ message: 'No items found.', type: 'error' });
                return;
            }

            // 2. Prepare for Restock (new rows in tracking_ops with ops_type='restock')
            const restockData = itemsToMove.map(({ id, created_at, ops_type, ...rest }) => ({
                ...rest,
                marketplace: 'flipkart',
                seller_id: sellerId,
                ops_type: 'restock',
                status: 'restocking',
                moved_at: new Date().toISOString(),
            }));

            // 3. Insert into tracking_ops as restock rows
            const { error: insertError } = await supabase
                .from('tracking_ops')
                .insert(restockData);

            if (insertError) throw insertError;

            // 4. Delete shipment rows
            const { error: deleteError } = await supabase
                .from('tracking_ops')
                .delete()
                .eq('marketplace', 'flipkart')
                .eq('seller_id', sellerId)
                .eq('ops_type', 'shipment')
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;

            // 5. Update UI
            setItems((prev) => prev.filter((i) => i.invoice_number !== invoiceNumber));

            if (onCountsChange) {
                onCountsChange();
            }

            setToast({ message: `Invoice ${invoiceNumber} (${itemsToMove.length} items) moved to Restock!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
        } catch (error: any) {
            console.error('Error moving to Restock:', error);
            setToast({ message: `Failed: ${error.message}`, type: 'error' });
        }
    };


    // Filter
    const filteredItems = items.filter((item) =>
        item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-gray-400">Loading shipment data...</div>;

    return (
        <div className="h-full flex flex-col">
            {/* Search */}
            <div className="flex-none px-4 pb-4">
                <input
                    type="text"
                    placeholder="Search by Invoice or ASIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-md px-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 text-gray-100"
                />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
                <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice No</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice Date</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">GST Number</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">ASIN</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Product</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Weight</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Qty</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Price</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Amount</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tax</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-400 uppercase bg-green-900/20">
                                        Total Amount
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tracking</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Delivery</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="text-center py-8 text-gray-300">
                                            {searchQuery ? 'No items found' : 'No shipment items'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-white/[0.05] transition-colors">
                                            <td className="px-6 py-4 text-gray-100 font-semibold">{item.invoice_number}</td>
                                            <td className="px-6 py-4 text-gray-300">
                                                {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">{item.gst_number || '-'}</td>
                                            <td className="px-6 py-4 font-mono text-orange-500">{item.asin}</td>
                                            <td className="px-6 py-4 text-gray-300">{item.product_name || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300">{item.product_weight || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300">{item.buying_quantity || '-'}</td>
                                            <td className="px-6 py-4 text-gray-300">₹{item.buying_price || 0}</td>
                                            <td className="px-6 py-4 text-green-400 font-semibold">
                                                ₹{item.amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                ₹{item.tax_amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-green-400 bg-green-900/10">
                                                ₹{((item.amount || 0) + (item.tax_amount || 0)).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300 truncate max-w-[150px]">
                                                {item.tracking_details || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleMoveToRestock(item.invoice_number)}
                                                    className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                                                >
                                                    To Restock
                                                </button>

                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3">
                        <div className="text-sm text-gray-300">
                            Showing {filteredItems.length} of {items.length} items
                        </div>
                    </div>
                </div>
            </div>
      {toast && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
          <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-semibold flex-1 text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/70 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}
        </div>
    );
}
