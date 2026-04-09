'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getFlipkartTrackingTableName } from '@/lib/utils';
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

interface CheckingTableProps {
  sellerId: number;
  onCountsChange?: () => void | Promise<void>;
}

export default function CheckingTable({
  sellerId,
  onCountsChange
}: CheckingTableProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  // 🔴 ADD THIS NEW STATE
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
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
    total_amount: true,
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
    const savedWidths = localStorage.getItem('flipkart_checking_table_column_widths');
    if (savedWidths) {
      try {
        setColumnWidths(JSON.parse(savedWidths));
      } catch (e) {
        console.error('Failed to load column widths:', e);
      }
    }
  }, []);

  // Fetch data from india_checking table
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
        const tableName = getFlipkartTrackingTableName('CHECKING', sellerId);
        const { data, error } = await supabase
          .from(tableName)
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

  // Handle checkbox change - Move ENTIRE INVOICE to BOTH Shipment AND Vyapar
  // Handle checkbox change - Mark individual item as RECEIVED
  const handleCheckboxChange = async (itemId: string, checked: boolean) => {
    try {

      // Update database
      const tableName = getFlipkartTrackingTableName('CHECKING', sellerId);
      const { error } = await supabase
        .from(tableName)
        .update({ product_received: checked })
        .eq('id', itemId);

      if (error) throw error;

      // Update local state
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, product_received: checked } : item
        )
      );

    } catch (error: any) {
      console.error('❌ Error updating received status:', error);
      setToast({ message: `Failed to update: ${error.message}`, type: 'error' });
    }
  };

  // Move ONLY received items to Shipment + Vyapar
  // Move items to Shipment & Vyapar
  const handleMoveToShipment = async (itemIds: string[]) => {
    try {

      // 1. Get items to move from CHECKING table (removed product_received filter)
      const checkingTableName = getFlipkartTrackingTableName('CHECKING', sellerId);
      const { data: itemsToMove, error: fetchError } = await supabase
        .from(checkingTableName)
        .select('*')
        .in('id', itemIds)

      if (fetchError) throw fetchError

      if (!itemsToMove || itemsToMove.length === 0) {
        setToast({ message: 'No items found to move.', type: 'error' })
        return
      }


      // 2. Prepare data (remove id, created_at, product_received)
      const preparedData = itemsToMove.map((item) => {
        const { id, created_at, product_received, ...rest } = item;
        return {
          ...rest,
          moved_at: new Date().toISOString(),
        };
      });

      // 3. Prepare Shipment data
      const shipmentData = preparedData.map(item => ({
        ...item,
        status: 'shipped',
      }));

      // 4. Prepare Vyapar data
      const vyaparData = preparedData.map(item => ({
        ...item,
        status: 'vyapar_logged',
      }));

      // 5. Insert into SHIPMENT table
      const shipmentTableName = getFlipkartTrackingTableName('SHIPMENT', sellerId);

      const { error: shipmentInsertError } = await supabase
        .from(shipmentTableName)
        .insert(shipmentData);

      if (shipmentInsertError) {
        console.error('❌ Shipment insert error:', shipmentInsertError);
        throw shipmentInsertError;
      }


      // 6. Insert into VYAPAR table
      const vyaparTableName = getFlipkartTrackingTableName('VYAPAR', sellerId);

      const { error: vyaparInsertError } = await supabase
        .from(vyaparTableName)
        .insert(vyaparData);

      if (vyaparInsertError) {
        console.error('❌ Vyapar insert error:', vyaparInsertError);
        throw vyaparInsertError;
      }


      // 7. Delete from CHECKING table

      const { error: deleteError } = await supabase
        .from(checkingTableName)
        .delete()
        .in('id', itemIds);

      if (deleteError) {
        console.error('❌ Delete error:', deleteError);
        throw deleteError;
      }


      // 8. Update local state - remove moved items
      setItems((prevItems) =>
        prevItems.filter((item) => !itemIds.includes(item.id))
      );

      // 9. Trigger parent count refresh
      if (onCountsChange) {
        onCountsChange();
      }

      setToast({ message: `${itemsToMove.length} item(s) moved to Shipment + Vyapar!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('❌ Error moving items:', error);
      setToast({ message: `Failed to move items: ${error.message}`, type: 'error' });
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
      const tableName = getFlipkartTrackingTableName('CHECKING', sellerId);
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

    } catch (error: any) {
      console.error('Error updating field:', error);
      setToast({ message: `Failed to update: ${error.message}`, type: 'error' });
      // Revert on error
      fetchCheckingData();
    }
  };

  // 🔴 ADD THESE THREE NEW FUNCTIONS

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allItemIds = new Set<string>();
      items.forEach(item => allItemIds.add(item.id));
      setSelectedItemIds(allItemIds);
    } else {
      setSelectedItemIds(new Set());
    }
  };

  // Handle individual row selection
  const handleRowSelect = (itemId: string, checked: boolean) => {
    setSelectedItemIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemId);
      } else {
        newSet.delete(itemId);
      }
      return newSet;
    });
  };

  // Handle bulk move all selected items
  const handleBulkMoveToShipment = async () => {
    if (selectedItemIds.size === 0) {
      setToast({ message: 'No items selected', type: 'error' });
      return;
    }

    const confirmed = confirm(`Move ${selectedItemIds.size} item(s) to Shipment & Vyapar?`);
    if (!confirmed) return;

    try {

      // 1. Get items from CHECKING table
      const checkingTableName = getFlipkartTrackingTableName('CHECKING', sellerId);
      const { data: itemsToMove, error: fetchError } = await supabase
        .from(checkingTableName)
        .select('*')
        .in('id', Array.from(selectedItemIds));

      if (fetchError) throw fetchError;
      if (!itemsToMove || itemsToMove.length === 0) {
        setToast({ message: 'No items found to move.', type: 'error' });
        return;
      }


      // 2. Prepare data
      const preparedData = itemsToMove.map((item: any) => {
        const { id, created_at, product_received, ...rest } = item;
        return {
          ...rest,
          moved_at: new Date().toISOString(),
        };
      });

      // 3. Insert into SHIPMENT
      const shipmentTableName = getFlipkartTrackingTableName('SHIPMENT', sellerId);
      const shipmentData = preparedData.map(item => ({ ...item, status: 'shipped' }));
      const { error: shipmentInsertError } = await supabase
        .from(shipmentTableName)
        .insert(shipmentData);

      if (shipmentInsertError) throw shipmentInsertError;

      // 4. Insert into VYAPAR
      const vyaparTableName = getFlipkartTrackingTableName('VYAPAR', sellerId);
      const vyaparData = preparedData.map(item => ({ ...item, status: 'vyapar_logged' }));
      const { error: vyaparInsertError } = await supabase
        .from(vyaparTableName)
        .insert(vyaparData);

      if (vyaparInsertError) throw vyaparInsertError;

      // 5. Delete from CHECKING
      const { error: deleteError } = await supabase
        .from(checkingTableName)
        .delete()
        .in('id', Array.from(selectedItemIds));

      if (deleteError) throw deleteError;

      // 6. Update UI
      setItems(prevItems => prevItems.filter(item => !selectedItemIds.has(item.id)));
      setSelectedItemIds(new Set());

      if (onCountsChange) {
        onCountsChange();
      }

      setToast({ message: `${itemsToMove.length} item(s) moved to Shipment & Vyapar!`, type: 'success' }); setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('❌ Error moving items:', error);
      setToast({ message: `Failed to move items: ${error.message}`, type: 'error' });
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
        localStorage.setItem('flipkart_checking_table_column_widths', JSON.stringify(updatedWidths));
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
        <div className="text-lg text-gray-400">Loading checking data...</div>
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
          className="flex-1 max-w-md px-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500"
        />

        {/* Hide Columns Button */}
        <div className="relative">
          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className="px-4 py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-sm font-medium flex items-center gap-2 whitespace-nowrap"
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

              <div className="absolute top-full right-0 mt-2 bg-[#111111] border border-white/[0.1] rounded-lg shadow-xl p-4 z-20 w-64 max-h-[500px] overflow-y-auto">
                <h3 className="font-semibold text-gray-100 mb-3 text-sm">Toggle Columns</h3>
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
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500"
                        />
                        <span className="text-sm text-gray-300">
                          {columnDisplayNames[col] || col}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-white/[0.1] flex gap-2">
                  <button
                    onClick={() =>
                      setVisibleColumns(
                        Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {} as typeof visibleColumns)
                      )
                    }
                    className="flex-1 px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-400 text-xs font-medium"
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

      {/* Table Wrapper - Same as page.tsx */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
          {/* Table Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full divide-y divide-white/[0.06]">

              <thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0 z-10">
                <tr>
                  {/* Expand Column */}
                  {visibleColumns.expand && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.expand }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.invoice_no }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.invoice_date }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.gst_number }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.product_name }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.weight }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.qty }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.price }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.amount }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.tax_amount }}>
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

                  {/* Total Amount */}
                  {visibleColumns.total_amount && (
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-green-400 uppercase bg-green-900/20 border-r border-white/[0.1] select-none"
                      onMouseDown={(e) => handleResizeStart('tax_amount', e)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderRight = '2px solid #6366f1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderRight = '2px solid #475569';
                      }}
                    >
                      Total Amount
                    </th>
                  )}


                  {/* Tracking Details */}
                  {visibleColumns.tracking && (
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.tracking }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.delivery_date }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.company }}>
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
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400 relative" style={{ width: columnWidths.upload }}>
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

                  {/* 🔴 KEEP THIS SIMPLE - NO BULK BUTTON IN HEADER */}
                  {visibleColumns.action && (
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400" style={{ width: columnWidths.action }}>
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="text-center py-8 text-gray-300">
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
                          className="border-t border-white/[0.1] hover:bg-white/[0.05] cursor-pointer transition-colors"
                          onClick={() => hasMultipleItems && toggleExpand(group.invoice_number)}
                        >
                          {visibleColumns.expand && (
                            <td className="px-6 py-4" style={{ width: columnWidths.expand }}>
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
                            <td className="px-6 py-4 font-semibold text-gray-100" style={{ width: columnWidths.invoice_no }}>
                              {group.invoice_number}
                              {hasMultipleItems && (
                                <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                                  {group.items.length} items
                                </span>
                              )}
                            </td>
                          )}
                          {visibleColumns.invoice_date && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.invoice_date }}>
                              {group.invoice_date
                                ? new Date(group.invoice_date).toLocaleDateString()
                                : '-'}
                            </td>
                          )}
                          {visibleColumns.gst_number && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.gst_number }}>{group.gst_number || '-'}</td>
                          )}

                          {/* Product Name - WITH TRUNCATION */}
                          {visibleColumns.product_name && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.product_name }} title={!hasMultipleItems ? (group.items[0].product_name || '') : ''}>
                              {!hasMultipleItems ? (
                                truncateText(group.items[0].product_name || '', 30)
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Weight - EDITABLE when single item */}
                          {visibleColumns.weight && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.weight }}>
                              {!hasMultipleItems ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={group.items[0].product_weight || ''}
                                  onChange={(e) => handleEditField(group.items[0].id, 'product_weight', parseFloat(e.target.value) || null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-20 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                  placeholder="kg"
                                />
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Qty - EDITABLE when single item */}
                          {visibleColumns.qty && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.qty }}>
                              {!hasMultipleItems ? (
                                <input
                                  type="number"
                                  value={group.items[0].buying_quantity || ''}
                                  onChange={(e) => handleEditField(group.items[0].id, 'buying_quantity', parseFloat(e.target.value) || null)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-16 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                  placeholder="0"
                                />
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* Price - EDITABLE when single item */}
                          {visibleColumns.price && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.price }}>
                              {!hasMultipleItems ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400 text-sm">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={group.items[0].buying_price || ''}
                                    onChange={(e) => handleEditField(group.items[0].id, 'buying_price', parseFloat(e.target.value) || null)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-24 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                    placeholder="0.00"
                                  />
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}

                          {/* EXISTING COLUMNS */}
                          {visibleColumns.amount && (
                            <td className="px-6 py-4 font-semibold text-green-400" style={{ width: columnWidths.amount }}>
                              ₹ {group.total_amount.toFixed(2)}
                            </td>
                          )}
                          {visibleColumns.tax_amount && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.tax_amount }}>
                              {group.total_tax > 0 ? `₹ ${group.total_tax.toFixed(2)}` : '-'}
                            </td>
                          )}
                          {visibleColumns.total_amount && (
                            <td className="px-6 py-4 text-sm font-bold text-green-400 bg-green-900/10 border-r border-white/[0.1]">
                              ₹ {(group.total_amount + group.total_tax).toFixed(2)}
                            </td>
                          )}

                          {visibleColumns.tracking && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.tracking }}>
                              {!hasMultipleItems ? (
                                group.items[0].tracking_details || '-'
                              ) : (
                                <span className="text-gray-500 text-sm">Multiple</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.delivery_date && (
                            <td className="px-6 py-4 text-gray-300" style={{ width: columnWidths.delivery_date }}>
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
                            <td className="px-6 py-4" style={{ width: columnWidths.company }}>
                              {group.seller_company ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCompany(group.seller_company);
                                  }}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                >
                                  View
                                </button>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.upload && (
                            <td className="px-6 py-4" style={{ width: columnWidths.upload }}>
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

                          {/* Action Column - Selection Checkbox */}
                          {/* 🔴 SHOW BULK BUTTON IN MAIN INVOICE ROW */}
                          {/* 🔴 DUAL ACTION: Checkbox + Individual Send + Bulk Button */}
                          {visibleColumns.action && (
                            <td className="px-6 py-4 text-center" style={{ width: columnWidths.action }} onClick={(e) => e.stopPropagation()}>
                              {!hasMultipleItems ? (
                                <div className="flex items-center justify-center gap-2">
                                  {/* 🔥 FIXED LOGIC */}
                                  {selectedItemIds.size === 0 ? (
                                    // ✅ NO SELECTION - Show individual "Send" button
                                    <button
                                      onClick={() => handleMoveToShipment([group.items[0].id])}
                                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                                      title="Send this item to Shipment & Vyapar"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                      </svg>
                                      Send
                                    </button>
                                  ) : selectedItemIds.size === 1 && selectedItemIds.has(group.items[0].id) ? (
                                    // ✅ SINGLE ITEM SELECTED - Show "Done" button
                                    <button
                                      onClick={() => handleMoveToShipment([group.items[0].id])}
                                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                                      title="Move this item to Shipment & Vyapar"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Done
                                    </button>
                                  ) : selectedItemIds.size > 1 && selectedItemIds.has(group.items[0].id) && Array.from(selectedItemIds)[0] === group.items[0].id ? (
                                    // ✅ MULTIPLE ITEMS SELECTED - Show "Bulk Send" button on first selected row
                                    <button
                                      onClick={handleBulkMoveToShipment}
                                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg whitespace-nowrap flex items-center gap-1"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      Bulk Send ({selectedItemIds.size})
                                    </button>
                                  ) : null}

                                  {/* ✅ Checkbox for Selection (Always visible) */}
                                  <input
                                    type="checkbox"
                                    checked={selectedItemIds.has(group.items[0].id)}
                                    onChange={(e) => handleRowSelect(group.items[0].id, e.target.checked)}
                                    className="w-5 h-5 cursor-pointer accent-indigo-600 rounded"
                                    title="Select for bulk action"
                                  />
                                </div>
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Expanded Card - Show individual items */}
                        {isExpanded && hasMultipleItems && (
                          <tr>
                            <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="bg-orange-500/5 px-6 py-4">
                              <div className="ml-8 space-y-2">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="bg-[#111111] border border-white/[0.1] rounded-lg p-3 shadow-md hover:border-orange-500/50 transition-all"
                                  >
                                    <div className="flex items-center gap-6 text-sm">
                                      {/* ASIN */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">ASIN:</span>
                                        <span className="font-mono text-orange-500 font-semibold">{item.asin}</span>
                                      </div>

                                      {/* Product Name */}
                                      <div className="flex items-center gap-2 flex-1 min-w-0" title={item.product_name || ''}>
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Product:</span>
                                        <span className="text-gray-100 truncate">{item.product_name || '-'}</span>
                                      </div>

                                      {/* Weight - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Weight:</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={item.product_weight || ''}
                                          onChange={(e) => handleEditField(item.id, 'product_weight', parseFloat(e.target.value) || null)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-20 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                          placeholder="kg"
                                        />
                                      </div>

                                      {/* Quantity - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[100px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Qty:</span>
                                        <input
                                          type="number"
                                          value={item.buying_quantity || ''}
                                          onChange={(e) => handleEditField(item.id, 'buying_quantity', parseFloat(e.target.value) || null)}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-16 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                          placeholder="0"
                                        />
                                      </div>

                                      {/* Price - EDITABLE */}
                                      <div className="flex items-center gap-2 min-w-[130px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Price:</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-gray-400 text-sm">₹</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={item.buying_price || ''}
                                            onChange={(e) => handleEditField(item.id, 'buying_price', parseFloat(e.target.value) || null)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-24 bg-[#111111] border border-white/[0.1] rounded px-2 py-1 text-gray-100 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all"
                                            placeholder="0.00"
                                          />
                                        </div>
                                      </div>

                                      {/* Amount - AUTO-CALCULATED */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Amount:</span>
                                        <span className="font-bold text-green-400">
                                          {item.amount ? `₹ ${item.amount.toFixed(2)}` : '-'}
                                        </span>
                                      </div>

                                      {/* Tracking */}
                                      <div className="flex items-center gap-2 min-w-[140px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Tracking:</span>
                                        <span className="text-gray-100 truncate" title={item.tracking_details || ''}>
                                          {item.tracking_details || '-'}
                                        </span>
                                      </div>

                                      {/* Delivery Date */}
                                      <div className="flex items-center gap-2 min-w-[120px]">
                                        <span className="text-xs font-semibold text-gray-500 uppercase">Delivery:</span>
                                        <span className="text-gray-100">
                                          {item.delivery_date
                                            ? new Date(item.delivery_date).toLocaleDateString('en-IN', {
                                              day: '2-digit',
                                              month: 'short',
                                            })
                                            : '-'}
                                        </span>
                                      </div>

                                      {/* Action - Checkbox → Done → Move to Shipment */}
                                      {/* 🔴 DUAL ACTION: Individual Send + Checkbox */}
                                      {/* Action - Show Done/Bulk Send based on selection */}
                                      <div className="flex items-center gap-2 min-w-[140px] justify-end">
                                        {/* 🔥 FIXED LOGIC - Same as main row */}
                                        {selectedItemIds.size === 0 ? (
                                          // ✅ NO SELECTION - Show "Send" button
                                          <button
                                            onClick={() => handleMoveToShipment([item.id])}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                            </svg>
                                            Send
                                          </button>
                                        ) : selectedItemIds.size === 1 && selectedItemIds.has(item.id) ? (
                                          // ✅ SINGLE ITEM SELECTED - Show "Done" button
                                          <button
                                            onClick={() => handleMoveToShipment([item.id])}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Done
                                          </button>
                                        ) : selectedItemIds.size > 1 && selectedItemIds.has(item.id) && Array.from(selectedItemIds)[0] === item.id ? (
                                          // ✅ MULTIPLE ITEMS SELECTED - Show "Bulk Send" on first selected item
                                          <button
                                            onClick={handleBulkMoveToShipment}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg whitespace-nowrap flex items-center gap-1"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            Bulk Send ({selectedItemIds.size})
                                          </button>
                                        ) : null}

                                        {/* ✅ Checkbox - Always visible */}
                                        <label className="flex items-center gap-1 cursor-pointer group">
                                          <input
                                            type="checkbox"
                                            checked={selectedItemIds.has(item.id)}
                                            onChange={(e) => handleRowSelect(item.id, e.target.checked)}
                                            className="w-4 h-4 cursor-pointer accent-indigo-600 rounded"
                                          />
                                          <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">
                                            Select
                                          </span>
                                        </label>
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
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 py-3">
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
          <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Seller Company Details</h3>
              <button
                onClick={() => setSelectedCompany(null)}
                className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
              >
                ✕
              </button>
            </div>
            <div className="whitespace-pre-wrap text-gray-100 bg-[#111111] p-4 rounded-lg border border-white/[0.1]">
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
