'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getUAETrackingTableName } from '@/lib/utils';
import { X } from 'lucide-react';

type InvoiceGroup = {
    invoice_number: string;
    invoice_date: string | null;
    asin_count: number;
    total_amount: number;
};

interface RollbackModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    sellerId: number;
}

export default function RollbackModal({
    open,
    onClose,
    onSuccess,
    sellerId,
}: RollbackModalProps) {
    const [invoices, setInvoices] = useState<InvoiceGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [processing, setProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Fetch invoices grouped by invoice_number
    useEffect(() => {
        if (open) {
            fetchInvoices();
        }
    }, [open]);

    const fetchInvoices = async () => {
        try {
            setLoading(true);

            // ✅ FIX #1: Use seller-specific invoice table
            const invoiceTableName = getUAETrackingTableName('INVOICE', sellerId);
            console.log('📋 Fetching from table:', invoiceTableName);

            // Step 1: Get ALL invoice groups from seller's invoice table
            const { data, error } = await supabase
                .from(invoiceTableName) // ✅ FIXED: uae_invoice_seller_X
                .select('invoice_number, invoice_date, amount, tax_amount')


            if (error) {
                // If no invoices found, just show empty
                if (error.code === 'PGRST116') {
                    setInvoices([]);
                    setLoading(false);
                    return;
                }
                throw error;
            }

            if (!data || data.length === 0) {
                setInvoices([]);
                setLoading(false);
                return;
            }

            // Group by invoice_number
            const grouped = data.reduce((acc: Record<string, InvoiceGroup>, item) => {
                if (!acc[item.invoice_number]) {
                    acc[item.invoice_number] = {
                        invoice_number: item.invoice_number,
                        invoice_date: item.invoice_date,
                        asin_count: 0,
                        total_amount: 0,
                    }
                }
                acc[item.invoice_number].asin_count += 1
                acc[item.invoice_number].total_amount += (item.amount || 0) + (item.tax_amount || 0)
                return acc
            }, {})


            console.log('📊 Found invoices:', Object.keys(grouped).length);
            setInvoices(Object.values(grouped));
        } catch (error) {
            console.error('Error fetching invoices:', error);
            setToast({ message: 'Failed to load invoices', type: 'error' });
        } finally {
            setLoading(false);
        }
    };



    // Handle select all
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.invoice_number)));
        } else {
            setSelectedInvoices(new Set());
        }
    };

    // Handle individual checkbox
    const handleSelect = (invoiceNumber: string, checked: boolean) => {
        const newSelected = new Set(selectedInvoices);
        if (checked) {
            newSelected.add(invoiceNumber);
        } else {
            newSelected.delete(invoiceNumber);
        }
        setSelectedInvoices(newSelected);
    };

    // Filter invoices by search
    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Handle rollback
    // Handle rollback
    // Handle rollback
    const handleRollback = async () => {
        if (selectedInvoices.size === 0) {
            setToast({ message: 'Please select at least one invoice to rollback', type: 'error' });
            return;
        }

        const confirmMsg = `Are you sure you want to rollback ${selectedInvoices.size} invoice(s)?\n\nThis will:\n- Restore ASINs back to Main File\n- Delete invoices from Company Invoice\n- Save rollback history`;

        if (!confirm(confirmMsg)) return;

        try {
            setProcessing(true);

            for (const invoiceNumber of selectedInvoices) {
                // ✅ FIX #2: Use seller-specific invoice table
                const invoiceTableName = getUAETrackingTableName('INVOICE', sellerId);
                const mainFileTableName = getUAETrackingTableName('MAIN', sellerId);

                console.log(`🔄 Rolling back invoice ${invoiceNumber}`);
                console.log(`📋 Invoice table: ${invoiceTableName}`);
                console.log(`📁 Main file table: ${mainFileTableName}`);

                // 1. Get all items for this invoice
                const { data: invoiceItems, error: fetchError } = await supabase
                    .from(invoiceTableName) // ✅ FIXED: uae_invoice_seller_X
                    .select('*')
                    .eq('invoice_number', invoiceNumber);

                if (fetchError) throw fetchError;

                if (!invoiceItems || invoiceItems.length === 0) {
                    console.warn(`No items found for invoice ${invoiceNumber}`);
                    continue;
                }

                console.log(`📦 Found ${invoiceItems.length} items to restore`);

                // 2. Save to rollback history
                const { error: historyError } = await supabase
                    .from('tracking_invoice_rollback')
                    .insert({
                        invoice_number: invoiceNumber,
                        asins_count: invoiceItems.length,
                        invoice_data: invoiceItems,
                    });

                if (historyError) throw historyError;

                // 3. Check which ASINs already exist in Main File
                const asins = invoiceItems.map((item) => item.asin);

                const { data: existingAsins } = await supabase
                    .from(mainFileTableName) // ✅ FIXED: uae_tracking_seller_X
                    .select('asin')
                    .in('asin', asins);

                const existingAsinSet = new Set(existingAsins?.map((item) => item.asin));

                // 4. Prepare data to restore (only non-existing ASINs)
                const dataToRestore = invoiceItems
                    .filter((item) => !existingAsinSet.has(item.asin))
                    .map((item) => ({
                        // Core fields
                        asin: item.asin,
                        product_link: item.product_link,
                        product_name: item.product_name,
                        brand: item.brand,
                        // Pricing fields
                        target_price: item.target_price,
                        target_quantity: item.target_quantity,
                        admin_target_price: item.admin_target_price,
                        buying_price: item.buying_price,
                        buying_quantity: item.buying_quantity,
                        // Seller fields
                        seller_link: item.seller_link,
                        seller_phone: item.seller_phone,
                        seller_tag: item.seller_tag,
                        // Logistics fields
                        payment_method: item.payment_method,
                        tracking_details: item.tracking_details,
                        delivery_date: item.delivery_date,
                        product_weight: item.product_weight,
                        // Origin fields
                        origin: item.origin,
                        origin_india: item.origin_india ?? false,
                        origin_china: item.origin_china ?? false,
                        // Funnel fields
                        funnel: item.funnel,
                        funnel_quantity: item.funnel_quantity,
                        funnel_seller: item.funnel_seller,
                        // Purchase links
                        inr_purchase_link: item.inr_purchase_link,
                    }));

                // 5. Insert back to Main File (if any non-duplicate ASINs)
                if (dataToRestore.length > 0) {
                    const { error: restoreError } = await supabase
                        .from(mainFileTableName) // ✅ FIXED: uae_tracking_seller_X
                        .insert(dataToRestore);

                    if (restoreError) {
                        console.error('Restore error:', restoreError);
                        throw restoreError;
                    }

                    console.log(`✅ Restored ${dataToRestore.length} ASINs`);
                }

                if (existingAsinSet.size > 0) {
                    console.log(`⚠️ Skipped ${existingAsinSet.size} duplicate ASINs`);
                }

                // 6. Delete from invoice table
                const { error: deleteError } = await supabase
                    .from(invoiceTableName) // ✅ FIXED: uae_invoice_seller_X
                    .delete()
                    .eq('invoice_number', invoiceNumber);

                if (deleteError) throw deleteError;

                // 7. Delete from master invoice table
                const { error: deleteMasterError } = await supabase
                    .from('uae_company_invoice')
                    .delete()
                    .eq('invoice_number', invoiceNumber);

                if (deleteMasterError) throw deleteMasterError;

                console.log(`✅ Rolled back invoice ${invoiceNumber}`);
            }

            // Show success toast
            setToast({
                message: `Successfully rolled back ${selectedInvoices.size} invoice(s)!`,
                type: 'success',
            });

            // Close modal and refresh after short delay
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (error: any) {
            console.error('Rollback error:', error);
            setToast({
                message: `Rollback failed: ${error.message}`,
                type: 'error',
            });
        } finally {
            setProcessing(false);
        }
    };




    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-[#111111] border-b border-white/[0.1] px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Rollback Invoices to Main File</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-[#111111] rounded-lg"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-white/[0.1]">
                    <input
                        type="text"
                        placeholder="Search by Invoice Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#111111] border border-white/[0.1] rounded-lg px-4 py-2.5 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/50 transition-all"
                    />
                </div>

                {/* Invoice List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-400">Loading invoices...</div>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-500">
                                {searchQuery ? 'No invoices found' : 'No invoices available'}
                            </div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0">
                                <tr>
                                    <th className="px-6 py-4 text-left w-12">
                                        <input
                                            type="checkbox"
                                            checked={
                                                filteredInvoices.length > 0 &&
                                                filteredInvoices.every(inv => selectedInvoices.has(inv.invoice_number))
                                            }
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-5 h-5 cursor-pointer accent-indigo-600"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                                        Invoice No
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                                        Invoice Date
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                                        ASINs Count
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">
                                        Total Amount
                                    </th>

                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredInvoices.map((invoice) => (
                                    <tr
                                        key={invoice.invoice_number}
                                        className="hover:bg-white/[0.05] cursor-pointer transition-colors"
                                        onClick={() => handleSelect(invoice.invoice_number, !selectedInvoices.has(invoice.invoice_number))}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedInvoices.has(invoice.invoice_number)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(invoice.invoice_number, e.target.checked);
                                                }}
                                                className="w-5 h-5 cursor-pointer accent-indigo-600"
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-gray-100">
                                            {invoice.invoice_number}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-300">
                                            {invoice.invoice_date
                                                ? new Date(invoice.invoice_date).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full font-semibold text-xs">
                                                {invoice.asin_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-green-400">
                                            ₹ {invoice.total_amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-[#111111] border-t border-white/[0.1] px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-300">
                        {selectedInvoices.size > 0 && (
                            <span className="font-semibold text-orange-500">
                                {selectedInvoices.size} invoice(s) selected
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-500 hover:bg-[#1a1a1a] hover:text-white transition-all font-medium"
                            disabled={processing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRollback}
                            disabled={selectedInvoices.size === 0 || processing}
                            className={`px-8 py-2.5 rounded-lg font-semibold text-white transition-all shadow-lg ${selectedInvoices.size === 0 || processing
                                ? 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                                : 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/50'
                                }`}
                        >
                            {processing ? 'Processing...' : 'Rollback Selected'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-6 right-6 z-[100] animate-slide-in">
                    <div
                        className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] border ${toast.type === 'success'
                            ? 'bg-green-600 text-white border-green-500'
                            : 'bg-red-600 text-white border-red-500'
                            }`}
                    >
                        <span className="text-2xl">
                            {toast.type === 'success' ? '✅' : '❌'}
                        </span>
                        <span className="font-semibold flex-1">{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="text-white hover:text-gray-200 transition-colors p-1 hover:bg-[#111111]/20 rounded"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
