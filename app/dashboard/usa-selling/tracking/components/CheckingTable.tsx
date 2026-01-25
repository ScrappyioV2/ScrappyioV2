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
  product_received: boolean | null;
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

// ✅ NEW: Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  expand: 50,
  invoice_no: 180,
  invoice_date: 130,
  gst_number: 150,
  product_name: 200,
  weight: 100,
  qty: 80,
  price: 120,
  amount: 120,
  tax_amount: 120,
  tracking: 180,
  delivery_date: 130,
  company: 100,
  upload: 100,
  action: 120,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);  // ✅ ADDED
  const [visibleColumns, setVisibleColumns] = useState({  // ✅ ADDED
    expand: true,
    invoice_no: true,
    invoice_date: true,
    gst_number: true,
    product_name: true,
    weight: true,
    qty: true,
    price: true,
    amount: true,
    tax_amount: true,
    tracking: true,
    delivery_date: true,
    company: true,
    upload: true,
    action: true,
  });

  // ✅ NEW: Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // ✅ NEW: Load column widths from localStorage on mount
  useEffect(() => {
    const savedWidths = localStorage.getItem('checking_table_column_widths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (e) {
        console.error('Failed to load column widths:', e);
      }
    }
  }, []);

  // Fetch data from usa_checking table
  useEffect(() => {
    fetchCheckingData();
  }, []);

  const fetchCheckingData = async () => {
    try {
      setLoading(true);

      // ✅ Recursive fetch to handle 1000+ rows
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('usa_checking')
          .select('*')
          .order('moved_at', { ascending: false })
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

      console.log('✅ Checking data fetched:', allData);
      console.log('✅ Number of items:', allData?.length);

      setItems(allData);
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

  // Handle checkbox change
  const handleCheckboxChange = async (itemId: string, checked: boolean) => {
    try {
      // Update database
      const { error } = await supabase
        .from('usa_checking')
        .update({ product_received: checked })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state - Create NEW array to force React re-render
      setItems((prevItems) => {
        const newItems = prevItems.map((item) =>
          item.id === itemId ? { ...item, product_received: checked } : item
        );
        console.log(`✅ Checkbox ${checked ? 'checked' : 'unchecked'} for item ${itemId}`);
        console.log('🔄 Updated item:', newItems.find(i => i.id === itemId));
        return [...newItems]; // Force new array reference
      });
    } catch (error: any) {
      console.error('Error updating checkbox:', error);
      alert('Failed to update checkbox: ' + error.message);
    }
  };

  // Handle edit field with auto-save
  const handleEditField = async (itemId: string, field: string, value: number | null) => {
    try {
      // Update local state immediately for instant feedback
      setItems((prevItems) => {
        const newItems = prevItems.map((item) => {
          if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };

            // Auto-calculate amount if qty or price changed
            if (field === 'buying_quantity' || field === 'buying_price') {
              const qty = field === 'buying_quantity' ? value : item.buying_quantity;
              const price = field === 'buying_price' ? value : item.buying_price;
              updatedItem.amount = (qty || 0) * (price || 0);
            }

            return updatedItem;
          }
          return item;
        });
        return [...newItems]; // Force new array reference
      });

      // Prepare update data
      const updateData: any = { [field]: value };

      // If qty or price changed, recalculate amount
      if (field === 'buying_quantity' || field === 'buying_price') {
        const currentItem = items.find(i => i.id === itemId);
        if (currentItem) {
          const qty = field === 'buying_quantity' ? value : currentItem.buying_quantity;
          const price = field === 'buying_price' ? value : currentItem.buying_price;
          updateData.amount = (qty || 0) * (price || 0);
        }
      }

      // Update database
      const { error } = await supabase
        .from('usa_checking')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      console.log(`✅ Updated ${field} for item ${itemId}: ${value}`);
    } catch (error: any) {
      console.error('Error updating field:', error);
      alert('Failed to update: ' + error.message);
      // Revert on error
      fetchCheckingData();
    }
  };


  // ✅ NEW: Truncate text helper function
  const truncateText = (text: string, maxLength: number): string => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // ✅ NEW: Handle resize start
  const handleResizeStart = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnKey]);
  };

  // ✅ NEW: Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingColumn) {
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff); // Minimum 50px
        setColumnWidths((prev) => ({
          ...prev,
          [resizingColumn]: newWidth,
        }));
      }
    };

    const handleMouseUp = () => {
      if (resizingColumn) {
        // Save to localStorage
        const updatedWidths = { ...columnWidths };
        localStorage.setItem('checking_table_column_widths', JSON.stringify(updatedWidths));
        setResizingColumn(null);
      }
    };

    if (resizingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, startX, startWidth, columnWidths]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-400">Loading checking data...</div>
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
          className="flex-1 max-w-md px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-500"
        />

        {/* Hide Columns Button */}
        <div className="relative">
          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
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

              <div className="absolute top-full right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-4 z-20 w-64 max-h-[500px] overflow-y-auto">
                <h3 className="font-semibold text-slate-200 mb-3 text-sm">Toggle Columns</h3>
                <div className="space-y-2">
                  {Object.keys(visibleColumns).map((col) => {
                    const columnDisplayNames: { [key: string]: string } = {
                      'expand': 'Expand',
                      'invoice_no': 'Invoice No',
                      'invoice_date': 'Invoice Date',
                      'gst_number': 'GST Number',
                      'product_name': 'Product Name',
                      'weight': 'Weight',
                      'qty': 'Qty',
                      'price': 'Price',
                      'amount': 'Amount',
                      'tax_amount': 'Tax Amount',
                      'tracking': 'Tracking Details',
                      'delivery_date': 'Delivery Date',
                      'company': 'Company',
                      'upload': 'Upload',
                      'action': 'Action',
                    };

                    return (
                      <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={visibleColumns[col as keyof typeof visibleColumns]}
                          onChange={() => {
                            setVisibleColumns(prev => ({
                              ...prev,
                              [col]: !prev[col as keyof typeof visibleColumns]
                            }));
                          }}
                          className="rounded border-slate-600 bg-slate-800 text-indigo-500"
                        />
                        <span className="text-sm text-slate-300">
                          {columnDisplayNames[col] || col}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                  <button
                    onClick={() =>
                      setVisibleColumns(
                        Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns)
                      )
                    }
                    className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500 text-xs font-medium"
                  >
                    Show All
                  </button>
                  <button
                    onClick={() =>
                      setVisibleColumns(
                        Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === 'invoice_no' }), {} as typeof visibleColumns)
                      )
                    }
                    className="flex-1 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table Wrapper - Same as page.tsx */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-700 h-full flex flex-col">
          {/* Table Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-slate-800" style={{ minWidth: '2000px' }}>

              <thead className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10">
                <tr>
                  {/* Expand Column */}
                  {visibleColumns.expand && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.expand }}>
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('expand', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Invoice No */}
                  {visibleColumns.invoice_no && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.invoice_no }}>
                      Invoice No
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('invoice_no', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Invoice Date */}
                  {visibleColumns.invoice_date && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.invoice_date }}>
                      Invoice Date
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('invoice_date', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* GST Number */}
                  {visibleColumns.gst_number && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.gst_number }}>
                      GST Number
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('gst_number', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Product Name */}
                  {visibleColumns.product_name && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.product_name }}>
                      Product Name
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('product_name', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Weight */}
                  {visibleColumns.weight && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.weight }}>
                      Weight
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('weight', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Qty */}
                  {visibleColumns.qty && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.qty }}>
                      Qty
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('qty', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Price */}
                  {visibleColumns.price && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.price }}>
                      Price
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('price', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Amount */}
                  {visibleColumns.amount && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.amount }}>
                      Amount
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('amount', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Tax Amount */}
                  {visibleColumns.tax_amount && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.tax_amount }}>
                      Tax Amount
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('tax_amount', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Tracking Details */}
                  {visibleColumns.tracking && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.tracking }}>
                      Tracking Details
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('tracking', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Delivery Date */}
                  {visibleColumns.delivery_date && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.delivery_date }}>
                      Delivery Date
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('delivery_date', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Company */}
                  {visibleColumns.company && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.company }}>
                      Company
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('company', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Upload */}
                  {visibleColumns.upload && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400 relative" style={{ width: columnWidths.upload }}>
                      Upload
                      <div
                        className="absolute top-0 right-0 cursor-col-resize select-none"
                        style={{
                          width: '8px',
                          height: '100%',
                          backgroundColor: 'transparent',
                          borderRight: '2px solid #475569',
                          zIndex: 10,
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => handleResizeStart('upload', e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #6366f1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderRight = '2px solid #475569';
                        }}
                      />
                    </th>
                  )}

                  {/* Action */}
                  {visibleColumns.action && (
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400" style={{ width: columnWidths.action }}>
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-slate-500">
                      {searchQuery ? 'No invoices found' : 'No checking items available'}
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
                          className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors"
                          onClick={() => hasMultipleItems && toggleExpand(group.invoice_number)}
                        >
                          {visibleColumns.expand && (
                            <td className="px-4 py-3" style={{ width: columnWidths.expand }}>
                              {hasMultipleItems ? (
                                isExpanded ? (
                                  <ChevronDown size={16} className="text-slate-400" />
                                ) : (
                                  <ChevronRight size={16} className="text-slate-400" />
                                )
                              ) : null}
                            </td>
                          )}
                          {visibleColumns.invoice_no && (
                            <td className="px-4 py-3 font-semibold text-slate-200" style={{ width: columnWidths.invoice_no }}>
                              {group.invoice_number}
                              {hasMultipleItems && (
                                <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                                  {group.items.length} items
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.invoice_date && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.invoice_date }}>
                              {group.invoice_date
                                ? new Date(group.invoice_date).toLocaleDateString()
                                : '-'}
                            </td>
                          )}
                          {visibleColumns.gst_number && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.gst_number }}>{group.gst_number || '-'}</td>
                          )}

                          {/* Product Name - WITH TRUNCATION */}
                          {visibleColumns.product_name && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.product_name }} title={!hasMultipleItems ? (group.items[0].product_name || '') : ''}>
                              {!hasMultipleItems ? (
                                truncateText(group.items[0].product_name || '', 30)
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Weight - EDITABLE when single item */}
                          {visibleColumns.weight && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.weight }}>
                              {!hasMultipleItems ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={group.items[0].product_weight || ''}
                                  onChange={(e) => handleEditField(group.items[0].id, 'product_weight', parseFloat(e.target.value) || null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                  placeholder="kg"
                                />
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Qty - EDITABLE when single item */}
                          {visibleColumns.qty && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.qty }}>
                              {!hasMultipleItems ? (
                                <input
                                  type="number"
                                  value={group.items[0].buying_quantity || ''}
                                  onChange={(e) => handleEditField(group.items[0].id, 'buying_quantity', parseFloat(e.target.value) || null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                  placeholder="0"
                                />
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Price - EDITABLE when single item */}
                          {visibleColumns.price && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.price }}>
                              {!hasMultipleItems ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 text-sm">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={group.items[0].buying_price || ''}
                                    onChange={(e) => handleEditField(group.items[0].id, 'buying_price', parseFloat(e.target.value) || null)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                    placeholder="0.00"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* EXISTING COLUMNS */}
                          {visibleColumns.amount && (
                            <td className="px-4 py-3 font-semibold text-green-400" style={{ width: columnWidths.amount }}>
                              ₹ {group.total_amount.toFixed(2)}
                            </td>
                          )}
                          {visibleColumns.tax_amount && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.tax_amount }}>
                              {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                            </td>
                          )}
                          {visibleColumns.tracking && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.tracking }}>
                              {!hasMultipleItems ? (
                                group.items[0].tracking_details || '-'
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.delivery_date && (
                            <td className="px-4 py-3 text-slate-300" style={{ width: columnWidths.delivery_date }}>
                              {!hasMultipleItems && group.items[0].delivery_date ? (
                                new Date(group.items[0].delivery_date).toLocaleDateString()
                              ) : !hasMultipleItems ? (
                                '-'
                              ) : (
                                <span className="text-slate-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.company && (
                            <td className="px-4 py-3" style={{ width: columnWidths.company }}>
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
                          )}
                          {visibleColumns.upload && (
                            <td className="px-4 py-3" style={{ width: columnWidths.upload }}>
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
                          )}

                          {/* Action Column - Checkbox OR "Done" */}
                          {visibleColumns.action && (
                            <td className="px-4 py-3 text-center" style={{ width: columnWidths.action }} onClick={(e) => e.stopPropagation()}>
                              {!hasMultipleItems ? (
                                group.items[0].product_received ? (
                                  <span className="text-green-400 font-semibold">Done</span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={group.items[0].product_received || false}
                                    onChange={(e) =>
                                      handleCheckboxChange(group.items[0].id, e.target.checked)
                                    }
                                    className="w-5 h-5 cursor-pointer accent-green-600"
                                  />
                                )
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Expanded Card - Show individual items */}
                        {isExpanded && hasMultipleItems && (
                          <tr>
                            <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="bg-slate-800/30 px-4 py-3">
                              <div className="ml-8 space-y-2">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-md hover:border-indigo-500/50 transition-all"
                                  >
                                    <div className="flex items-center gap-6 text-sm">
                                      {/* ASIN */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">ASIN:</span>
                                        <span className="font-mono text-indigo-400 font-semibold">{item.asin}</span>
                                      </div>

                                      {/* Product Name */}
                                      <div className="flex items-center gap-2 flex-1 min-w-0" title={item.product_name || ''}>
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Product:</span>
                                        <span className="text-slate-200 truncate">{item.product_name || '-'}</span>
                                      </div>

                                      {/* Weight - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Weight:</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.product_weight || ''}
                                          onChange={(e) => handleEditField(item.id, 'product_weight', parseFloat(e.target.value) || null)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                          placeholder="kg"
                                        />
                                      </div>

                                      {/* Quantity - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[100px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Qty:</span>
                                        <input
                                          type="number"
                                          value={item.buying_quantity || ''}
                                          onChange={(e) => handleEditField(item.id, 'buying_quantity', parseFloat(e.target.value) || null)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                          placeholder="0"
                                        />
                                      </div>

                                      {/* Price - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[130px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Price:</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-slate-400 text-sm">₹</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={item.buying_price || ''}
                                            onChange={(e) => handleEditField(item.id, 'buying_price', parseFloat(e.target.value) || null)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                            placeholder="0.00"
                                          />
                                        </div>
                                      </div>

                                      {/* Amount - AUTO-CALCULATED */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Amount:</span>
                                        <span className="font-bold text-green-400">
                                          {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                        </span>
                                      </div>

                                      {/* Tracking */}
                                      <div className="flex items-center gap-2 min-w-[140px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Tracking:</span>
                                        <span className="text-slate-200 truncate" title={item.tracking_details || ''}>
                                          {item.tracking_details || '-'}
                                        </span>
                                      </div>

                                      {/* Delivery Date */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-slate-500 uppercase">Delivery:</span>
                                        <span className="text-slate-200">
                                          {item.delivery_date
                                            ? new Date(item.delivery_date).toLocaleDateString('en-IN', {
                                              day: '2-digit',
                                              month: 'short',
                                            })
                                            : '-'}
                                        </span>
                                      </div>

                                      {/* Action - Checkbox OR Done */}
                                      <div className="flex items-center min-w-[100px] justify-end">
                                        {item.product_received ? (
                                          <span className="flex items-center gap-1.5 bg-green-600/20 text-green-400 px-3 py-1 rounded-md font-semibold text-xs border border-green-600/30">
                                            <span>✓</span> Done
                                          </span>
                                        ) : (
                                          <label className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                              type="checkbox"
                                              checked={item.product_received || false}
                                              onChange={(e) =>
                                                handleCheckboxChange(item.id, e.target.checked)
                                              }
                                              className="w-4 h-4 cursor-pointer accent-green-600"
                                            />
                                            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                                              Received
                                            </span>
                                          </label>
                                        )}
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
          <div className="flex-none border-t border-slate-800 bg-slate-950 px-4 py-3">
            <div className="text-sm text-slate-400">
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
