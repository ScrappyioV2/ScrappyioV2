'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTrackingTableName } from '@/lib/utils';

type VyaparItem = {
    id: string;
    invoice_number: string;
    invoice_date: string;
    gst_number: string;
    asin: string;
    product_name: string;
    buying_price: number;
    buying_quantity: number;
    amount: number;
    tax_amount: number;
    total_amount: number;
    tracking_details: string;
    delivery_date: string;
    moved_at: string;
};

interface VyaparTableProps {
    sellerId: number;
    onCountsChange?: () => void | Promise<void>;
}

export default function VyaparTable({
    sellerId,
    onCountsChange
}: VyaparTableProps) {

    const [items, setItems] = useState<VyaparItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchVyaparData = async () => {
        try {
            setLoading(true);
            const tableName = getTrackingTableName('VYAPAR', sellerId);

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('moved_at', { ascending: false });

            if (error) throw error;

            console.log('✅ Vyapar data fetched:', data?.length || 0);
            setItems(data || []);
        } catch (error) {
            console.error('Error fetching Vyapar data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVyaparData();
    }, [sellerId]);

    // Filter
    const filteredItems = items.filter((item) =>
        item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-slate-400">Loading Vyapar records...</div>;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-none px-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Vyapar Records</h2>
                        <p className="text-sm text-slate-400 mt-1">⛔ Admin Access Only - Final Accounting</p>
                    </div>
                </div>

                <input
                    type="text"
                    placeholder="Search by Invoice or ASIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-md px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-200"
                />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
                <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-700 h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-slate-950 border-b border-slate-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Invoice No</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Invoice Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">GST Number</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">ASIN</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Product</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Qty</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Price</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Amount</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tax</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Total</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tracking</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Delivery</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="text-center py-8 text-slate-500">
                                            {searchQuery ? 'No items found' : 'No Vyapar records yet'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3 text-slate-200 font-semibold">{item.invoice_number}</td>
                                            <td className="px-4 py-3 text-slate-300">
                                                {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">{item.gst_number || '-'}</td>
                                            <td className="px-4 py-3 font-mono text-indigo-400">{item.asin}</td>
                                            <td className="px-4 py-3 text-slate-300">{item.product_name || '-'}</td>
                                            <td className="px-4 py-3 text-slate-300">{item.buying_quantity || '-'}</td>
                                            <td className="px-4 py-3 text-slate-300">₹{item.buying_price || 0}</td>
                                            <td className="px-4 py-3 text-green-400 font-semibold">
                                                ₹{item.amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">
                                                ₹{item.tax_amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-4 py-3 text-yellow-400 font-bold">
                                                ₹{item.total_amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 truncate max-w-[150px]">
                                                {item.tracking_details || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">
                                                {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3">
                        <div className="text-sm text-slate-400">
                            Showing {filteredItems.length} of {items.length} Vyapar records
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
