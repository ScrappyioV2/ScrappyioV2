'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFlipkartTrackingTableName } from '@/lib/utils';

type RestockItem = {
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
    status: string;
};

export default function RestockTable({
    sellerId,
    onCountsChange
}: {
    sellerId: number;
    onCountsChange?: () => void | Promise<void>;
}) {
    const [items, setItems] = useState<RestockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRestockData = async () => {
        try {
            setLoading(true);
            const tableName = getFlipkartTrackingTableName('RESTOCK', sellerId);

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('moved_at', { ascending: false });

            if (error) throw error;

            console.log('✅ Restock data fetched:', data?.length || 0);
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching restock data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRestockData();
    }, [sellerId]);

    // Filter
    const filteredItems = items.filter((item) =>
        item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-gray-400">Loading restock data...</div>;

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
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="text-center py-8 text-gray-300">
                                            {searchQuery ? 'No items found' : 'No restock items'}
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
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 text-xs rounded bg-green-600/20 text-green-400 border border-green-600/30 font-semibold">
                                                    {item.status || 'Restocking'}
                                                </span>
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
        </div>
    );
}
