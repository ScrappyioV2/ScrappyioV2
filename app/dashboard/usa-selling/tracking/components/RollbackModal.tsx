'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
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
}

export default function RollbackModal({
    open,
    onClose,
    onSuccess,
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

            // Step 1: Get the most recent invoice_number
            const { data: latestInvoice, error: latestError } = await supabase
                .from('usa_tracking_company_invoice')
                .select('invoice_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (latestError) throw latestError;

            if (!latestInvoice) {
                setInvoices([]);
                setLoading(false);
                return;
            }

            // Step 2: Get ALL rows for that invoice_number
            const { data, error } = await supabase
                .from('usa_tracking_company_invoice')
                .select('invoice_number, invoice_date, amount')
                .eq('invoice_number', latestInvoice.invoice_number);

            if (error) throw error;

            // Group by invoice_number
            const grouped = data.reduce((acc: Record<string, InvoiceGroup>, item) => {
                if (!acc[item.invoice_number]) {
                    acc[item.invoice_number] = {
                        invoice_number: item.invoice_number,
                        invoice_date: item.invoice_date,
                        asin_count: 0,
                        total_amount: 0,
                    };
                }
                acc[item.invoice_number].asin_count += 1;
                acc[item.invoice_number].total_amount += item.amount || 0;
                return acc;
            }, {});

            setInvoices(Object.values(grouped));
        } catch (error) {
            console.error('Error fetching invoices:', error);
            alert('Failed to load invoices');
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
    const handleRollback = async () => {
        if (selectedInvoices.size === 0) {
            alert('Please select at least one invoice to rollback');
            return;
        }

        const confirmMsg = `Are you sure you want to rollback ${selectedInvoices.size} invoice(s)?\n\nThis will:\n- Restore ASINs back to Main File\n- Delete invoices from Company Invoice Details\n- Save rollback history`;

        if (!confirm(confirmMsg)) return;

        try {
            setProcessing(true);

            for (const invoiceNumber of selectedInvoices) {
                // 1. Get all items for this invoice
                const { data: invoiceItems, error: fetchError } = await supabase
                    .from('usa_tracking_company_invoice')
                    .select('*')
                    .eq('invoice_number', invoiceNumber);

                if (fetchError) throw fetchError;

                if (!invoiceItems || invoiceItems.length === 0) {
                    console.warn(`No items found for invoice ${invoiceNumber}`);
                    continue;
                }

                // 2. Save to rollback history
                const { error: historyError } = await supabase
                    .from('tracking_invoice_rollback')
                    .insert({
                        invoice_number: invoiceNumber,
                        asins_count: invoiceItems.length,
                        invoice_data: invoiceItems,
                    });

                if (historyError) throw historyError;

                // 3. Check which ASINs already exist in usa_traking (to skip duplicates)
                const asins = invoiceItems.map(item => item.asin);
                const { data: existingAsins } = await supabase
                    .from('usa_traking')
                    .select('asin')
                    .in('asin', asins);

                const existingAsinSet = new Set(existingAsins?.map(item => item.asin) || []);

                // 4. Prepare data to restore (only non-existing ASINs)
                const dataToRestore = invoiceItems
                    .filter(item => !existingAsinSet.has(item.asin))
                    .map(item => ({
                        asin: item.asin,
                        product_link: item.product_link,
                        product_name: item.product_name,
                        target_price: item.target_price,
                        target_quantity: item.target_quantity,
                        buying_price: item.buying_price,
                        buying_quantity: item.buying_quantity,
                        seller_link: item.seller_link,
                        payment_method: item.payment_method,
                        tracking_details: item.tracking_details,
                        delivery_date: item.delivery_date,
                        seller_tag: item.seller_tag,
                        funnel: item.funnel,
                        product_weight: item.product_weight,
                        // Note: Not restoring invoice-specific fields like gst_number, cgst, sgst, etc.
                    }));

                // 5. Insert back to usa_traking (if any non-duplicate ASINs)
                if (dataToRestore.length > 0) {
                    const { error: restoreError } = await supabase
                        .from('usa_traking')
                        .insert(dataToRestore);

                    if (restoreError) throw restoreError;
                }

                // 6. Delete from usa_tracking_company_invoice
                const { error: deleteError } = await supabase
                    .from('usa_tracking_company_invoice')
                    .delete()
                    .eq('invoice_number', invoiceNumber);

                if (deleteError) throw deleteError;

                // 7. Delete from usa_company_invoice (master)
                const { error: deleteMasterError } = await supabase
                    .from('usa_company_invoice')
                    .delete()
                    .eq('invoice_number', invoiceNumber);

                if (deleteMasterError) throw deleteMasterError;

                console.log(`✅ Rolled back invoice ${invoiceNumber}: ${dataToRestore.length} ASINs restored, ${existingAsinSet.size} skipped (already exist)`);
            }

            // Show success toast
            setToast({
                message: `Successfully rolled back ${selectedInvoices.size} invoice(s)!`,
                type: 'success'
            });

            // Close modal and refresh after short delay
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (error: any) {
            console.error('Rollback error:', error);
            setToast({
                message: 'Rollback failed: ' + error.message,
                type: 'error'
            });
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold">Rollback Invoices to Main File</h2>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-300 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b">
                    <input
                        type="text"
                        placeholder="Search by Invoice Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Invoice List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-500">Loading invoices...</div>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-lg text-gray-500">
                                {searchQuery ? 'No invoices found' : 'No invoices available'}
                            </div>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left w-12">
                                        <input
                                            type="checkbox"
                                            checked={
                                                filteredInvoices.length > 0 &&
                                                filteredInvoices.every(inv => selectedInvoices.has(inv.invoice_number))
                                            }
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-5 h-5 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                        Invoice No
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                        Invoice Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                        ASINs Count
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                                        Total Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredInvoices.map((invoice) => (
                                    <tr
                                        key={invoice.invoice_number}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => handleSelect(invoice.invoice_number, !selectedInvoices.has(invoice.invoice_number))}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedInvoices.has(invoice.invoice_number)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(invoice.invoice_number, e.target.checked);
                                                }}
                                                className="w-5 h-5 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm">
                                            {invoice.invoice_number}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {invoice.invoice_date
                                                ? new Date(invoice.invoice_date).toLocaleDateString()
                                                : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
                                                {invoice.asin_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold">
                                            ₹ {invoice.total_amount.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        {selectedInvoices.size > 0 && (
                            <span className="font-semibold text-blue-600">
                                {selectedInvoices.size} invoice(s) selected
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 font-medium"
                            disabled={processing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRollback}
                            disabled={selectedInvoices.size === 0 || processing}
                            className={`px-8 py-2 rounded-lg font-semibold text-white transition-colors ${selectedInvoices.size === 0 || processing
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {processing ? 'Processing...' : 'Rollback Selected'}
                        </button>
                    </div>
                </div>
            </div>

            {toast && (
                <div className="fixed top-4 right-4 z-[100] animate-slide-in">
                    <div
                        className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] ${toast.type === 'success'
                                ? 'bg-green-600 text-white'
                                : 'bg-red-600 text-white'
                            }`}
                    >
                        <span className="text-2xl">
                            {toast.type === 'success' ? '✅' : '❌'}
                        </span>
                        <span className="font-semibold">{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-auto text-white hover:text-gray-200"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
