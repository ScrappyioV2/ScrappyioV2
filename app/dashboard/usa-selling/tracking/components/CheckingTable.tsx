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
  buying_price: number | null;
  buying_quantity: number | null;
  invoice_date: string | null;
  gst_number: string | null;
  amount: number | null;
  tax_amount: number | null;
  tracking_details: string | null;
  delivery_date: string | null;
  uploaded_invoice_url: string | null;
  uploaded_invoice_name: string | null;
  seller_company: string | null;
  action_status: string | null;
  product_received: boolean | null; // ✅ NEW
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
};

export default function CheckingTable() {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  // Fetch data from usa_checking table
  useEffect(() => {
    fetchCheckingData();
  }, []);

  const fetchCheckingData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('usa_checking')
        .select('*')
        .order('moved_at', { ascending: false });

      if (error) throw error;

      console.log('✅ Checking data fetched:', data);
      console.log('✅ Number of items:', data?.length);

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching checking data:', error);
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

  // ✅ NEW: Handle checkbox change
  const handleCheckboxChange = async (itemId: string, checked: boolean) => {
    try {
      // Update database
      const { error } = await supabase
        .from('usa_checking')
        .update({ product_received: checked })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, product_received: checked } : item
        )
      );

      console.log(`✅ Checkbox ${checked ? 'checked' : 'unchecked'} for item ${itemId}`);
    } catch (error: any) {
      console.error('Error updating checkbox:', error);
      alert('Failed to update checkbox: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading checking data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold w-8"></th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Invoice No</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Invoice Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">GST Number</th>
              {/* ✅ NEW COLUMNS */}
              <th className="px-4 py-3 text-left text-sm font-semibold">Product Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Weight</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Qty</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
              {/* EXISTING COLUMNS */}
              <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Tax Amount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Tracking Details</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Delivery Date</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Company</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Upload</th>
              {/* ✅ NEW ACTION COLUMN */}
              <th className="px-4 py-3 text-center text-sm font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {groupedInvoices.length === 0 ? (
              <tr>
                <td colSpan={15} className="text-center py-8 text-gray-500">
                  No checking items available
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
                      className="border-t hover:bg-gray-50 cursor-pointer"
                      onClick={() => hasMultipleItems && toggleExpand(group.invoice_number)}
                    >
                      <td className="px-4 py-3">
                        {hasMultipleItems ? (
                          isExpanded ? (
                            <ChevronDown size={16} className="text-gray-600" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-600" />
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {group.invoice_number}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {group.items.length} items
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {group.invoice_date
                          ? new Date(group.invoice_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3">{group.gst_number || '-'}</td>

                      {/* ✅ NEW COLUMNS - Show actual data for single, "Multiple" for multiple */}
                      <td className="px-4 py-3">
                        {!hasMultipleItems ? (
                          group.items[0].product_name || '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!hasMultipleItems ? (
                          group.items[0].product_weight ? `${group.items[0].product_weight} kg` : '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!hasMultipleItems ? (
                          group.items[0].buying_quantity || '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!hasMultipleItems ? (
                          group.items[0].buying_price ? `₹ ${group.items[0].buying_price}` : '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>

                      {/* EXISTING COLUMNS */}
                      <td className="px-4 py-3 font-semibold">
                        ₹ {group.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {!hasMultipleItems ? (
                          group.items[0].tracking_details || '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!hasMultipleItems && group.items[0].delivery_date ? (
                          new Date(group.items[0].delivery_date).toLocaleDateString()
                        ) : !hasMultipleItems ? (
                          '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {group.seller_company ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCompany(group.seller_company);
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-sm"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
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
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 rounded text-sm"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* ✅ NEW ACTION COLUMN - Checkbox for single invoice only */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {!hasMultipleItems ? (
                          <input
                            type="checkbox"
                            checked={group.items[0].product_received || false}
                            onChange={(e) =>
                              handleCheckboxChange(group.items[0].id, e.target.checked)
                            }
                            className={`w-5 h-5 cursor-pointer ${
                              group.items[0].product_received
                                ? 'accent-green-600'
                                : 'accent-gray-400'
                            }`}
                          />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Card - Show individual items with NEW columns */}
                    {isExpanded && hasMultipleItems && (
                      <tr>
                        <td colSpan={15} className="bg-gray-50 px-4 py-2">
                          <div className="ml-8 space-y-2">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                className="bg-white border rounded-lg p-3 shadow-sm"
                              >
                                <div className="grid grid-cols-7 gap-4 text-sm">
                                  <div>
                                    <span className="font-semibold text-gray-600">ASIN:</span>{' '}
                                    {item.asin}
                                  </div>
                                  {/* ✅ NEW FIELDS */}
                                  <div>
                                    <span className="font-semibold text-gray-600">Product:</span>{' '}
                                    {item.product_name || '-'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-600">Weight:</span>{' '}
                                    {item.product_weight ? `${item.product_weight} kg` : '-'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-600">Qty:</span>{' '}
                                    {item.buying_quantity || '-'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-600">Price:</span>{' '}
                                    {item.buying_price ? `₹ ${item.buying_price}` : '-'}
                                  </div>
                                  {/* EXISTING FIELDS */}
                                  <div>
                                    <span className="font-semibold text-gray-600">Amount:</span>{' '}
                                    {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                  </div>
                                  {/* ✅ NEW CHECKBOX */}
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={item.product_received || false}
                                      onChange={(e) =>
                                        handleCheckboxChange(item.id, e.target.checked)
                                      }
                                      className={`w-5 h-5 cursor-pointer ${
                                        item.product_received
                                          ? 'accent-green-600'
                                          : 'accent-gray-400'
                                      }`}
                                    />
                                    <span className="text-xs text-gray-500">Received</span>
                                  </div>
                                </div>
                                {/* Second row for tracking and delivery */}
                                <div className="grid grid-cols-2 gap-4 text-sm mt-2 pt-2 border-t">
                                  <div>
                                    <span className="font-semibold text-gray-600">Tracking:</span>{' '}
                                    {item.tracking_details || '-'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-gray-600">Delivery:</span>{' '}
                                    {item.delivery_date
                                      ? new Date(item.delivery_date).toLocaleDateString()
                                      : '-'}
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Seller Company Details</h3>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="whitespace-pre-wrap text-gray-700 bg-gray-50 p-4 rounded border">
              {selectedCompany}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
