'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import UploadedInvoiceModal from './UploadedInvoiceModal';
import { ChevronDown, ChevronRight } from 'lucide-react';

type InvoiceItem = {
  id: string;
  invoice_number: string;
  asin: string;
  product_name: string | null;
  product_weight: number | null;
  invoice_date: string | null;
  gst_number: string | null;
  buying_price: number | null;
  buying_quantity: number | null;
  amount: number | null;
  cgst: number | null;
  sgst: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  tracking_details: string | null;
  delivery_date: string | null;
  seller_company: string | null;
  authorized_signature: string | null;
  uploaded_invoice_url: string | null;
  uploaded_invoice_name: string | null;
  action_status: string | null;
};

type GroupedInvoice = {
  invoice_number: string;
  items: InvoiceItem[];
  invoice_date: string | null;
  gst_number: string | null;
  total_amount: number;
  total_tax: number;
  seller_company: string | null;
  uploaded_invoice_url: string | null;
  uploaded_invoice_name: string | null;
  action_status: string | null;
};

export default function CompanyInvoiceTable() {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  // Fetch data
  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usa_tracking_company_invoice')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group items by invoice_number
  const groupedInvoices: GroupedInvoice[] = Object.values(
    items.reduce((acc, item) => {
      if (!acc[item.invoice_number]) {
        acc[item.invoice_number] = {
          invoice_number: item.invoice_number,
          items: [],
          invoice_date: item.invoice_date,
          gst_number: item.gst_number,
          total_amount: 0,
          total_tax: 0,
          seller_company: item.seller_company,
          uploaded_invoice_url: item.uploaded_invoice_url,
          uploaded_invoice_name: item.uploaded_invoice_name,
          action_status: item.action_status,
        };
      }
      acc[item.invoice_number].items.push(item);
      acc[item.invoice_number].total_amount += item.amount || 0;
      acc[item.invoice_number].total_tax += item.tax_amount || 0;
      return acc;
    }, {} as Record<string, GroupedInvoice>)
  );

  // Toggle expanded state
  const toggleExpand = (invoiceNumber: string) => {
    setExpandedInvoices((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceNumber)) {
        newSet.delete(invoiceNumber);
      } else {
        newSet.add(invoiceNumber);
      }
      return newSet;
    });
  };

  // Handle action checkbox
  const handleActionChange = async (
    invoiceNumber: string,
    action: 'pass' | 'fail'
  ) => {
    // ❌ Fail button - Do nothing for now
    if (action === 'fail') {
      alert('Fail action is not implemented yet.');
      return;
    }

    // ✅ Pass button - Move to checking table
    if (action === 'pass') {
      try {
        // 1. Get all items with this invoice_number
        const itemsToMove = items.filter(
          (item) => item.invoice_number === invoiceNumber
        );

        if (itemsToMove.length === 0) {
          alert('No items found for this invoice.');
          return;
        }

        // 2. Prepare data for usa_checking table (only columns that exist)
        const dataToInsert = itemsToMove.map((item) => {
          return {
            // Remove id to generate new ones
            invoice_number: item.invoice_number,
            asin: item.asin,
            product_name: item.product_name,
            product_weight: item.product_weight,
            invoice_date: item.invoice_date,
            gst_number: item.gst_number,
            buying_price: item.buying_price,
            buying_quantity: item.buying_quantity,
            amount: item.amount,
            cgst: item.cgst,
            sgst: item.sgst,
            tax_amount: item.tax_amount,
            total_amount: item.total_amount,
            tracking_details: item.tracking_details,
            delivery_date: item.delivery_date,
            seller_company: item.seller_company,
            authorized_signature: item.authorized_signature,
            uploaded_invoice_url: item.uploaded_invoice_url,
            uploaded_invoice_name: item.uploaded_invoice_name,
            action_status: 'pass',
            moved_at: new Date().toISOString(),
          };
        });

        // 3. Insert into usa_checking table
        const { error: insertError } = await supabase
          .from('usa_checking')
          .insert(dataToInsert);

        if (insertError) throw insertError;

        // 4. Delete from usa_tracking_company_invoice
        const { error: deleteError } = await supabase
          .from('usa_tracking_company_invoice')
          .delete()
          .eq('invoice_number', invoiceNumber);

        if (deleteError) throw deleteError;

        // 5. Refresh the table
        await fetchInvoiceData();

        alert(
          `✅ Invoice ${invoiceNumber} (${itemsToMove.length} items) moved to Checking!`
        );
      } catch (error: any) {
        console.error('Error moving invoice to checking:', error);
        alert('Failed to move invoice: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-400">Loading invoice details...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border border-slate-700 rounded-xl shadow-lg">
        <table className="w-full">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 w-8"></th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Invoice No</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Invoice Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">GST Number</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tax Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Tracking Details</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Delivery Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Company</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Upload</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {groupedInvoices.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-8 text-slate-500">
                  No invoice items available
                </td>
              </tr>
            ) : (
              groupedInvoices.map((group) => {
                const isExpanded = expandedInvoices.has(group.invoice_number);
                const hasMultipleItems = group.items.length > 1;

                return (
                  <React.Fragment key={group.invoice_number}>
                    {/* Main Invoice Row */}
                    <tr
                      key={group.invoice_number}
                      className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors"
                      onClick={() => hasMultipleItems && toggleExpand(group.invoice_number)}
                    >
                      <td className="px-4 py-3">
                        {hasMultipleItems ? (
                          isExpanded ? (
                            <ChevronDown size={16} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={16} className="text-slate-400" />
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-200">
                        {group.invoice_number}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                            {group.items.length} items
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {group.invoice_date
                          ? new Date(group.invoice_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{group.gst_number || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-green-400">
                        ₹ {group.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                      </td>
                      {/* ✅ TRACKING DETAILS COLUMN */}
                      <td className="px-4 py-3 text-slate-300">
                        {!hasMultipleItems ? (
                          group.items[0].tracking_details || '-'
                        ) : (
                          <span className="text-slate-500 text-sm">Multiple</span>
                        )}
                      </td>
                      {/* ✅ DELIVERY DATE COLUMN */}
                      <td className="px-4 py-3 text-slate-300">
                        {!hasMultipleItems && group.items[0].delivery_date ? (
                          new Date(group.items[0].delivery_date).toLocaleDateString()
                        ) : !hasMultipleItems ? (
                          '-'
                        ) : (
                          <span className="text-slate-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {group.seller_company ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCompany(group.seller_company);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {group.uploaded_invoice_url ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice({
                                url: group.uploaded_invoice_url!,
                                name: group.uploaded_invoice_name || 'Invoice',
                              });
                            }}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleActionChange(group.invoice_number, 'pass')}
                            className={`text-2xl cursor-pointer transition-transform hover:scale-125 ${
                              group.action_status === 'pass' ? 'opacity-100' : 'opacity-30'
                            }`}
                            title="Pass"
                          >
                            ✅
                          </button>
                          <button
                            onClick={() => handleActionChange(group.invoice_number, 'fail')}
                            className={`text-2xl cursor-pointer transition-transform hover:scale-125 ${
                              group.action_status === 'fail' ? 'opacity-100' : 'opacity-30'
                            }`}
                            title="Fail"
                          >
                            ❌
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Card - Show individual items */}
                    {isExpanded && hasMultipleItems && (
                      <tr>
                        <td colSpan={11} className="bg-slate-800/30 px-4 py-2">
                          <div className="ml-8 space-y-2">
                            {group.items.map((item, idx) => (
                              <div
                                key={item.id}
                                className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-sm"
                              >
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="font-semibold text-slate-400">ASIN:</span>{' '}
                                    <span className="text-slate-200">{item.asin}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400">Amount:</span>{' '}
                                    <span className="text-green-400">
                                      {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400">Tracking:</span>{' '}
                                    <span className="text-slate-200">{item.tracking_details || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-400">Delivery:</span>{' '}
                                    <span className="text-slate-200">
                                      {item.delivery_date
                                        ? new Date(item.delivery_date).toLocaleDateString()
                                        : '-'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Uploaded Invoice Modal */}
      {selectedInvoice && (
        <UploadedInvoiceModal
          open={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          invoiceUrl={selectedInvoice.url}
          invoiceName={selectedInvoice.name}
        />
      )}

      {/* Company Info Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Seller Company Details</h3>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-slate-400 hover:text-white text-2xl transition-colors p-2 hover:bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="whitespace-pre-wrap text-slate-200 bg-slate-800 p-4 rounded-lg border border-slate-700">
              {selectedCompany}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
