'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getUAETrackingTableName } from '@/lib/utils';

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
    seller_company: string | null  // ✅ ADD THIS
    uploaded_invoice_url: string | null  // ✅ ADD THIS
    uploaded_invoice_name: string | null  // ✅ ADD THIS
    action_status: string | null
};

interface VyaparTableProps {
    sellerId: number;
    onCountsChange?: () => void | Promise<void>;
}

export default function VyaparTable({
    sellerId,
    onCountsChange
}: VyaparTableProps) {

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [items, setItems] = useState<VyaparItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<string | null>(null)


    const fetchVyaparData = async () => {
        try {
            setLoading(true);
            const tableName = getUAETrackingTableName('VYAPAR', sellerId);

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

    const handleStatusChange = async (itemId: string, newStatus: string) => {
        try {
            // Update database
            const tableName = getUAETrackingTableName('VYAPAR', sellerId)
            const { error } = await supabase
                .from(tableName)
                .update({ action_status: newStatus })
                .eq('id', itemId)

            if (error) throw error

            // Update local state
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === itemId ? { ...item, action_status: newStatus } : item
                )
            )

            console.log(`Status updated to ${newStatus} for item ${itemId}`)
        } catch (error: any) {
            console.error('Error updating status:', error)
            setToast({ message: `Failed to update status: ${error.message}`, type: 'error' })
        }
    }

    useEffect(() => {
        fetchVyaparData();
    }, [sellerId]);

    // Filter
    const filteredItems = items.filter((item) =>
        item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-gray-400">Loading Vyapar records...</div>;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex-none px-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Vyapar Records</h2>
                        <p className="text-sm text-gray-300 mt-1">⛔ Admin Access Only - Final Accounting</p>
                    </div>
                </div>

                <input
                    type="text"
                    placeholder="Search by Invoice or ASIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full max-w-md px-4 py-2.5 bg-[#111111] border border-white/[0.06] rounded-lg focus:outline-none focus:border-orange-500 text-gray-100"
                />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden">
                <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.06] h-full flex flex-col">

                    {/* Scrollable Table */}
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-[#111111] border-b border-white/[0.06] sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice No</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice Date</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">GST Number</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">ASIN</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Product</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Qty</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Price</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Amount</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tax</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Total</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tracking</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Delivery</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Company</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Upload</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Action</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={15} className="text-center py-8 text-gray-300">
                                            {searchQuery ? 'No items found' : 'No Vyapar records yet'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={`transition-colors ${item.action_status === 'done'
                                                    ? 'bg-green-900/30 hover:bg-green-900/40'
                                                    : 'hover:bg-white/[0.05]0/100/5'
                                                }`}
                                        >
                                            {/* 1. Invoice No */}
                                            <td className="px-6 py-4 text-gray-100 font-semibold">{item.invoice_number}</td>

                                            {/* 2. Invoice Date */}
                                            <td className="px-6 py-4 text-gray-300">
                                                {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString() : '-'}
                                            </td>

                                            {/* 3. GST Number */}
                                            <td className="px-6 py-4 text-gray-300">{item.gst_number || '-'}</td>

                                            {/* 4. ASIN */}
                                            <td className="px-6 py-4 font-mono text-orange-500">{item.asin}</td>

                                            {/* 5. Product */}
                                            <td className="px-6 py-4 text-gray-300">{item.product_name || '-'}</td>

                                            {/* 6. Qty */}
                                            <td className="px-6 py-4 text-gray-300">{item.buying_quantity || '-'}</td>

                                            {/* 7. Price */}
                                            <td className="px-6 py-4 text-gray-300">₹{item.buying_price || 0}</td>

                                            {/* 8. Amount */}
                                            <td className="px-6 py-4 text-green-400 font-semibold">
                                                ₹{item.amount?.toFixed(2) || '0.00'}
                                            </td>

                                            {/* 9. Tax */}
                                            <td className="px-6 py-4 text-gray-300">
                                                ₹{item.tax_amount?.toFixed(2) || '0.00'}
                                            </td>

                                            {/* 10. Total */}
                                            <td className="px-6 py-4 text-yellow-400 font-bold">
                                                ₹{item.total_amount?.toFixed(2) || '0.00'}
                                            </td>

                                            {/* 11. Tracking */}
                                            <td className="px-6 py-4 text-gray-300 truncate max-w-[150px]">
                                                {item.tracking_details || '-'}
                                            </td>

                                            {/* 12. Delivery */}
                                            <td className="px-6 py-4 text-gray-300">
                                                {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : '-'}
                                            </td>

                                            {/* 13. Company - MOVED HERE AT THE END */}
                                            <td className="px-6 py-4">
                                                {item.seller_company ? (
                                                    <button
                                                        onClick={() => setSelectedCompany(item.seller_company!)}
                                                        className="bg-orange-500/100 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        View
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>

                                            {/* 14. Upload - MOVED HERE AT THE END */}
                                            <td className="px-6 py-4">
                                                {item.uploaded_invoice_url ? (
                                                    <a
                                                        href={item.uploaded_invoice_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors inline-block"
                                                    >
                                                        View
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>

                                            {/* 15. Action - AT THE VERY END */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    {item.action_status === 'done' ? (
                                                        <button
                                                            onClick={() => handleStatusChange(item.id, 'pending')}
                                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                            Done
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStatusChange(item.id, 'done')}
                                                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                                        >
                                                            Pending
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer - FIXED at bottom */}
                    <div className="flex-none border-t border-white/[0.06] bg-[#111111] px-4 py-3">
                        <div className="text-sm text-gray-300">
                            Showing {filteredItems.length} of {items.length} Vyapar records
                        </div>
                    </div>

                </div>
            </div>

            {/* Company Modal */}
            {selectedCompany && (
                <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Seller Company Details</h3>
                            <button
                                onClick={() => setSelectedCompany(null)}
                                className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
                            >
                                ×
                            </button>
                        </div>
                        <div className="whitespace-pre-wrap text-gray-100 bg-[#111111] p-4 rounded-lg border border-white/[0.06]">
                            {selectedCompany}
                        </div>
                    </div>
                </div>
            )}

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
    )
}
//VyaparTable.tsx file for uae
