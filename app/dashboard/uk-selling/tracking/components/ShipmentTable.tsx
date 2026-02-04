'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getUKTrackingTableName  } from '@/lib/utils';

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
    const [items, setItems] = useState<ShipmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchShipmentData = async () => {
        try {
            setLoading(true);
            const tableName = getUKTrackingTableName ('SHIPMENT', sellerId);

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .order('moved_at', { ascending: false });

            if (error) throw error;

            console.log('✅ Shipment data fetched:', data?.length || 0);
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
            console.log('📦 Moving to Restock:', invoiceNumber);

            // 1. Get all items for this invoice
            const shipmentTableName = getUKTrackingTableName ('SHIPMENT', sellerId);
            const { data: itemsToMove, error: fetchError } = await supabase
                .from(shipmentTableName)
                .select('*')
                .eq('invoice_number', invoiceNumber);

            if (fetchError) throw fetchError;

            if (!itemsToMove || itemsToMove.length === 0) {
                alert('No items found.');
                return;
            }

            // 2. Prepare for Restock
            const restockData = itemsToMove.map(({ id, created_at, ...rest }) => ({
                ...rest,
                status: 'restocking',
                moved_at: new Date().toISOString(),
            }));

            // 3. Insert into Restock
            const restockTableName = getUKTrackingTableName ('RESTOCK', sellerId);
            const { error: insertError } = await supabase
                .from(restockTableName)
                .insert(restockData);

            if (insertError) throw insertError;

            // 4. Delete from Shipment
            const { error: deleteError } = await supabase
                .from(shipmentTableName)
                .delete()
                .eq('invoice_number', invoiceNumber);

            if (deleteError) throw deleteError;

            // 5. Update UI
            setItems((prev) => prev.filter((i) => i.invoice_number !== invoiceNumber));

            if (onCountsChange) {
                onCountsChange();
            }

            alert(`✅ Invoice ${invoiceNumber} (${itemsToMove.length} items) moved to Restock!`);
        } catch (error: any) {
            console.error('Error moving to Restock:', error);
            alert('Failed: ' + error.message);
        }
    };


    // Filter
    const filteredItems = items.filter((item) =>
        item.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.asin?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) return <div className="p-8 text-slate-400">Loading shipment data...</div>;

    return (
        <div className="h-full flex flex-col">
            {/* Search */}
            <div className="flex-none px-4 pb-4">
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
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Weight</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Qty</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Price</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Amount</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tax</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-400 uppercase bg-green-900/20">
                                        Total Amount
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tracking</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Delivery</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="text-center py-8 text-slate-500">
                                            {searchQuery ? 'No items found' : 'No shipment items'}
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
                                            <td className="px-4 py-3 text-slate-300">{item.product_weight || '-'}</td>
                                            <td className="px-4 py-3 text-slate-300">{item.buying_quantity || '-'}</td>
                                            <td className="px-4 py-3 text-slate-300">₹{item.buying_price || 0}</td>
                                            <td className="px-4 py-3 text-green-400 font-semibold">
                                                ₹{item.amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">
                                                ₹{item.tax_amount?.toFixed(2) || '0.00'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-green-400 bg-green-900/10">
                                                ₹{((item.amount || 0) + (item.tax_amount || 0)).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 truncate max-w-[150px]">
                                                {item.tracking_details || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">
                                                {item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
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
                    <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3">
                        <div className="text-sm text-slate-400">
                            Showing {filteredItems.length} of {items.length} items
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
