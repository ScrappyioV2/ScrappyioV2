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
        <div className="text-lg">Loading checking data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto border rounded-lg" style={{ position: 'relative' }}>
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-gray-100">
            <tr>
              {/* Expand Column */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.expand }}>
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('expand', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Invoice No */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.invoice_no }}>
                Invoice No
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('invoice_no', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Invoice Date */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.invoice_date }}>
                Invoice Date
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('invoice_date', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* GST Number */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.gst_number }}>
                GST Number
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('gst_number', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Product Name */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.product_name }}>
                Product Name
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('product_name', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Weight */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.weight }}>
                Weight
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('weight', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Qty */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.qty }}>
                Qty
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('qty', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Price */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.price }}>
                Price
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('price', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Amount */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.amount }}>
                Amount
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('amount', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Tax Amount */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.tax_amount }}>
                Tax Amount
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('tax_amount', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Tracking Details */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.tracking }}>
                Tracking Details
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('tracking', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Delivery Date */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.delivery_date }}>
                Delivery Date
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('delivery_date', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Company */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.company }}>
                Company
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('company', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Upload */}
              <th className="px-4 py-3 text-left text-sm font-semibold relative" style={{ width: columnWidths.upload }}>
                Upload
                <div
                  className="absolute top-0 right-0 cursor-col-resize select-none"
                  style={{ 
                    width: '8px',
                    height: '100%',
                    backgroundColor: 'transparent',
                    borderRight: '2px solid #d1d5db',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => handleResizeStart('upload', e)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderRight = '2px solid #d1d5db';
                  }}
                />
              </th>

              {/* Action */}
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ width: columnWidths.action }}>
                Action
              </th>
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
                      <td className="px-4 py-3" style={{ width: columnWidths.expand }}>
                        {hasMultipleItems ? (
                          isExpanded ? (
                            <ChevronDown size={16} className="text-gray-600" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-600" />
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ width: columnWidths.invoice_no }}>
                        {group.invoice_number}
                        {hasMultipleItems && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            {group.items.length} items
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.invoice_date }}>
                        {group.invoice_date
                          ? new Date(group.invoice_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.gst_number }}>{group.gst_number || '-'}</td>

                      {/* ✅ Product Name - WITH TRUNCATION */}
                      <td className="px-4 py-3" style={{ width: columnWidths.product_name }} title={!hasMultipleItems ? (group.items[0].product_name || '') : ''}>
                        {!hasMultipleItems ? (
                          truncateText(group.items[0].product_name || '', 30)
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.weight }}>
                        {!hasMultipleItems ? (
                          group.items[0].product_weight ? `${group.items[0].product_weight} kg` : '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.qty }}>
                        {!hasMultipleItems ? (
                          group.items[0].buying_quantity || '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.price }}>
                        {!hasMultipleItems ? (
                          group.items[0].buying_price ? `₹ ${group.items[0].buying_price}` : '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>

                      {/* EXISTING COLUMNS */}
                      <td className="px-4 py-3 font-semibold" style={{ width: columnWidths.amount }}>
                        ₹ {group.total_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.tax_amount }}>
                        {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.tracking }}>
                        {!hasMultipleItems ? (
                          group.items[0].tracking_details || '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.delivery_date }}>
                        {!hasMultipleItems && group.items[0].delivery_date ? (
                          new Date(group.items[0].delivery_date).toLocaleDateString()
                        ) : !hasMultipleItems ? (
                          '-'
                        ) : (
                          <span className="text-gray-500 text-sm">Multiple</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ width: columnWidths.company }}>
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
                            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 rounded text-sm"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      {/* ✅ Action Column - Checkbox OR "Done" */}
                      <td className="px-4 py-3 text-center" style={{ width: columnWidths.action }} onClick={(e) => e.stopPropagation()}>
                        {!hasMultipleItems ? (
                          group.items[0].product_received ? (
                            <span className="text-green-600 font-semibold">Done</span>
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
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Card - Show individual items */}
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
                                  {/* ✅ Product - WITH TRUNCATION */}
                                  <div title={item.product_name || ''}>
                                    <span className="font-semibold text-gray-600">Product:</span>{' '}
                                    {truncateText(item.product_name || '', 30)}
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
                                  <div>
                                    <span className="font-semibold text-gray-600">Amount:</span>{' '}
                                    {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                  </div>
                                  {/* ✅ Action - Checkbox OR "Done" */}
                                  <div className="flex items-center gap-2">
                                    {item.product_received ? (
                                      <span className="text-green-600 font-semibold">Done</span>
                                    ) : (
                                      <>
                                        <input
                                          type="checkbox"
                                          checked={item.product_received || false}
                                          onChange={(e) =>
                                            handleCheckboxChange(item.id, e.target.checked)
                                          }
                                          className="w-5 h-5 cursor-pointer accent-green-600"
                                        />
                                        <span className="text-xs text-gray-500">Received</span>
                                      </>
                                    )}
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
