'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getTrackingTableName } from '@/lib/utils';
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

interface CompanyInvoiceTableProps {
  sellerId: number;
  onCountsChange?: () => void | Promise<void>;
}

export default function CompanyInvoiceTable({
  sellerId,
  onCountsChange
}: CompanyInvoiceTableProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);  // ✅ ADDED
  const [visibleColumns, setVisibleColumns] = useState({  // ✅ ADDED
    expand: true,
    invoice_no: true,
    invoice_date: true,
    gst_number: true,
    amount: true,
    tax_amount: true,
    total_amount: true,
    tracking_details: true,
    delivery_date: true,
    company: true,
    upload: true,
    action: true,
  });

  // Fetch data
  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);

      // ✅ Recursive fetch to handle 1000+ rows
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const tableName = getTrackingTableName('INVOICE', sellerId); // usa_invoice_seller_X
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setItems(allData);
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

  // ✅ Filter by search query
  const filteredInvoices = groupedInvoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
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
  const handleActionChange = async (invoiceNumber: string, action: 'pass' | 'fail') => {
    // Fail button - Do nothing for now
    if (action === 'fail') {
      setToast({ message: 'Fail action is not implemented yet.', type: 'error' });
      return;
    }

    // Pass button - Move to checking table
    if (action === 'pass') {
      try {
        console.log('🔄 Moving invoice to checking:', invoiceNumber);

        // 1. Get all items with this invoice_number from INVOICE table
        const invoiceTableName = getTrackingTableName('INVOICE', sellerId);
        console.log('📋 Fetching from:', invoiceTableName);

        const { data: itemsToMove, error: fetchError } = await supabase
          .from(invoiceTableName) // ✅ usa_invoice_seller_X
          .select('*')
          .eq('invoice_number', invoiceNumber);

        if (fetchError) throw fetchError;

        if (!itemsToMove || itemsToMove.length === 0) {
          setToast({ message: 'No items found for this invoice.', type: 'error' });
          return;
        }

        console.log(`📦 Found ${itemsToMove.length} items to move`);

        // 2. Prepare data for checking table (remove id to generate new ones)
        const dataToInsert = itemsToMove.map((item) => ({
          // Invoice info
          invoice_number: item.invoice_number,
          invoice_date: item.invoice_date,
          gst_number: item.gst_number || null,

          // Product info
          asin: item.asin,
          product_name: item.product_name,
          product_link: item.product_link || null,
          brand: item.brand || null,
          product_weight: item.product_weight || null,

          // Pricing
          target_price: item.target_price || null,
          target_quantity: item.target_quantity || null,
          admin_target_price: item.admin_target_price || null,
          buying_price: item.buying_price || null,
          buying_quantity: item.buying_quantity || null,
          amount: item.amount || null,

          // Tax info
          cgst: item.cgst || null,
          sgst: item.sgst || null,
          tax_amount: item.tax_amount || null,
          total_amount: item.total_amount || null,

          // Seller info
          seller_tag: item.seller_tag || null,
          seller_company: item.seller_company || null,
          seller_link: item.seller_link || null,
          seller_phone: item.seller_phone || null,
          authorized_signature: item.authorized_signature || null,

          // Logistics
          tracking_details: item.tracking_details || null,
          delivery_date: item.delivery_date || null,
          payment_method: item.payment_method || null,

          // Origin
          origin: item.origin || null,
          origin_india: item.origin_india ?? false,
          origin_china: item.origin_china ?? false,

          // Funnel
          funnel: item.funnel || null,
          funnel_quantity: item.funnel_quantity || null,
          funnel_seller: item.funnel_seller || null,

          // Purchase link
          inr_purchase_link: item.inr_purchase_link || null,

          // Invoice uploads
          uploaded_invoice_url: item.uploaded_invoice_url || null,
          uploaded_invoice_name: item.uploaded_invoice_name || null,

          // Journey tracking
          journey_id: item.journey_id || null,
          journey_number: item.journey_number || null,

          // Status
          action_status: 'pass',
          status: 'checking',
          moved_at: new Date().toISOString(),
        }));

        // 3. Insert into CHECKING table
        const checkingTableName = getTrackingTableName('CHECKING', sellerId);
        console.log('📥 Inserting into:', checkingTableName);

        const { error: insertError } = await supabase
          .from(checkingTableName) // ✅ usa_checking_seller_X
          .insert(dataToInsert);

        if (insertError) {
          console.error('❌ Insert error:', insertError);
          throw insertError;
        }

        console.log('✅ Insert successful');

        // 4. Delete from INVOICE table (seller-specific)
        console.log('🗑️ Deleting from:', invoiceTableName);

        const { error: deleteError } = await supabase
          .from(invoiceTableName) // ✅ FIXED: usa_invoice_seller_X (not usa_tracking_company_invoice!)
          .delete()
          .eq('invoice_number', invoiceNumber);

        if (deleteError) {
          console.error('❌ Delete error:', deleteError);
          throw deleteError;
        }

        console.log('✅ Delete successful');

        // 5. Refresh the table
        await fetchInvoiceData();
        if (onCountsChange) {
          onCountsChange();
        }

        setToast({ message: `Invoice ${invoiceNumber} (${itemsToMove.length} items) moved to Checking!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
      } catch (error: any) {
        console.error('❌ Error moving invoice to checking:', error);
        setToast({ message: `Failed to move invoice: ${error.message}`, type: 'error' });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading invoice details...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar & Hide Columns */}
      <div className="flex-none px-4 pb-4 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search by Invoice Number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md px-4 py-2.5 bg-[#111111] border border-white/[0.06] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500"
        />

        {/* Hide Columns Button */}
        <div className="relative">
          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className="px-4 py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.06] text-sm font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Hide Columns
          </button>

          {isColumnMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsColumnMenuOpen(false)}
              />

              <div className="absolute top-full right-0 mt-2 bg-[#111111] border border-white/[0.06] rounded-lg shadow-xl p-4 z-20 w-64">
                <h3 className="font-semibold text-gray-100 mb-3 text-sm">Toggle Columns</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {Object.keys(visibleColumns).map((col) => {
                    const columnDisplayNames: { [key: string]: string } = {
                      'expand': 'Expand',
                      'invoice_no': 'Invoice No',
                      'invoice_date': 'Invoice Date',
                      'gst_number': 'GST Number',
                      'amount': 'Amount',
                      'tax_amount': 'Tax Amount',
                      'tracking_details': 'Tracking Details',
                      'delivery_date': 'Delivery Date',
                      'company': 'Company',
                      'upload': 'Upload',
                      'action': 'Action',
                    };

                    return (
                      <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-[#111111] p-2 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col as keyof typeof visibleColumns]}
                          onChange={() => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              [col]: !prev[col as keyof typeof visibleColumns]
                            }));
                          }}
                          className="rounded border-white/[0.06] bg-[#111111] text-orange-500"
                        />
                        <span className="text-sm text-gray-300">
                          {columnDisplayNames[col] || col}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-white/[0.06] flex gap-2">
                  <button
                    onClick={() =>
                      setVisibleColumns(
                        Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns)
                      )
                    }
                    className="flex-1 px-3 py-1.5 bg-orange-500/100 text-white rounded hover:bg-orange-400 text-xs font-medium"
                  >
                    Show All
                  </button>
                  <button
                    onClick={() =>
                      setVisibleColumns(
                        Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'invoice_no' }), {} as typeof visibleColumns)
                      )
                    }
                    className="flex-1 px-3 py-1.5 bg-[#111111] text-gray-500 rounded hover:bg-[#1a1a1a] text-xs font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.06] h-full flex flex-col">
          {/* Table Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-[#111111] border-b border-white/[0.06] sticky top-0 z-10">
                <tr>
                  {visibleColumns.expand && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 w-8"></th>
                  )}
                  {visibleColumns.invoice_no && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice No</th>
                  )}
                  {visibleColumns.invoice_date && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Invoice Date</th>
                  )}
                  {visibleColumns.gst_number && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">GST Number</th>
                  )}
                  {visibleColumns.amount && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Amount</th>
                  )}
                  {visibleColumns.tax_amount && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tax Amount</th>
                  )}
                  {visibleColumns.total_amount && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-green-400 uppercase bg-green-900/20 border-r border-white/[0.06]">
                      Total Amount
                    </th>
                  )}

                  {visibleColumns.tracking_details && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Tracking Details</th>
                  )}
                  {visibleColumns.delivery_date && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Delivery Date</th>
                  )}
                  {visibleColumns.company && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Company</th>
                  )}
                  {visibleColumns.upload && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Upload</th>
                  )}
                  {visibleColumns.action && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-gray-300">
                      {searchQuery ? 'No invoices found' : 'No invoice items available'}
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((group) => {
                    const isExpanded = expandedInvoices.has(group.invoice_number);
                    const hasMultipleItems = group.items.length > 1;

                    return (
                      <React.Fragment key={group.invoice_number}>
                        {/* Main Invoice Row */}
                        <tr
                          className="border-t border-white/[0.06] hover:bg-white/[0.05]0/100/5 cursor-pointer transition-colors"
                          onClick={() => hasMultipleItems && toggleExpand(group.invoice_number)}
                        >
                          {visibleColumns.expand && (
                            <td className="px-6 py-4">
                              {hasMultipleItems ? (
                                isExpanded ? (
                                  <ChevronDown size={16} className="text-gray-400" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-400" />
                                )
                              ) : null}
                            </td>
                          )}
                          {visibleColumns.invoice_no && (
                            <td className="px-6 py-4 font-semibold text-gray-100">
                              {group.invoice_number}
                              {hasMultipleItems && (
                                <span className="ml-2 text-xs bg-orange-500/100 text-white px-2 py-1 rounded">
                                  {group.items.length} items
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.invoice_date && (
                            <td className="px-6 py-4 text-gray-300">
                              {group.invoice_date
                                ? new Date(group.invoice_date).toLocaleDateString()
                                : '-'}
                            </td>
                          )}
                          {visibleColumns.gst_number && (
                            <td className="px-6 py-4 text-gray-300">{group.gst_number || '-'}</td>
                          )}
                          {visibleColumns.amount && (
                            <td className="px-6 py-4 font-semibold text-green-400">
                              ₹ {group.total_amount.toFixed(2)}
                            </td>
                          )}
                          {visibleColumns.tax_amount && (
                            <td className="px-6 py-4 text-gray-300">
                              {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                            </td>
                          )}
                          {visibleColumns.total_amount && (
                            <td className="px-6 py-4 text-sm font-bold text-green-400 bg-green-900/10 border-r border-white/[0.06]">
                              ₹ {(group.total_amount + group.total_tax).toFixed(2)}
                            </td>
                          )}

                          {visibleColumns.tracking_details && (
                            <td className="px-6 py-4 text-gray-300">
                              {!hasMultipleItems ? (
                                group.items[0].tracking_details || '-'
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.delivery_date && (
                            <td className="px-6 py-4 text-gray-300">
                              {!hasMultipleItems && group.items[0].delivery_date ? (
                                new Date(group.items[0].delivery_date).toLocaleDateString()
                              ) : !hasMultipleItems ? (
                                '-'
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.company && (
                            <td className="px-6 py-4">
                              {group.seller_company ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCompany(group.seller_company);
                                  }}
                                  className="bg-orange-500/100 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                  View
                                </button>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.upload && (
                            <td className="px-6 py-4">
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
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.action && (
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleActionChange(group.invoice_number, 'pass')}
                                  className={`text-2xl cursor-pointer transition-transform hover:scale-125 ${group.action_status === 'pass' ? 'opacity-100' : 'opacity-100'
                                    }`}
                                  title="Pass"
                                >
                                  ✅
                                </button>
                                <button
                                  onClick={() => handleActionChange(group.invoice_number, 'fail')}
                                  className={`text-2xl cursor-pointer transition-transform hover:scale-125 ${group.action_status === 'fail' ? 'opacity-100' : 'opacity-100'
                                    }`}
                                  title="Fail"
                                >
                                  ❌
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expanded Card - Show individual items */}
                        {isExpanded && hasMultipleItems && (
                          <tr>
                            <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="bg-orange-500/100/5 px-6 py-4">
                              <div className="ml-8 space-y-2">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-[#111111] border border-white/[0.06] rounded-lg p-3 shadow-sm"
                                  >
                                    <div className="grid grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <span className="font-semibold text-gray-400">ASIN:</span>{' '}
                                        <span className="text-gray-100">{item.asin}</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-gray-400">Amount:</span>{' '}
                                        <span className="text-green-400">
                                          {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-gray-400">Tracking:</span>{' '}
                                        <span className="text-gray-100">{item.tracking_details || '-'}</span>
                                      </div>
                                      <div>
                                        <span className="font-semibold text-gray-400">Delivery:</span>{' '}
                                        <span className="text-gray-100">
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

          {/* Footer Count - STICKY AT BOTTOM */}
          <div className="flex-none border-t border-white/[0.06] bg-[#111111] px-4 py-3">
            <div className="text-sm text-gray-300">
              Showing {filteredInvoices.length} of {groupedInvoices.length} invoices
            </div>
          </div>
        </div>
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
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Seller Company Details</h3>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
              >
                ✕
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
  );
}
