'use client';

import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getIndiaTrackingTableName, SELLER_TAG_MAPPING, SellerTag } from '@/lib/utils';
import UploadedInvoiceModal from './UploadedInvoiceModal';
import { ChevronDown, ChevronRight } from 'lucide-react';
import GenericRollbackModal from '@/components/india-selling/GenericRollbackModal';

type InvoiceItem = {
  id: string;
  invoice_number: string;
  box_number?: string | null;
  asin: string;
  sku: string | null;
  product_name: string | null;
  product_weight: number | null;
  buying_price: number | null;
  buying_quantity: number | null;
  actual_quantity?: number | null;
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
  seller_tag?: string | null;
  check_mrp_label?: boolean | null;
  check_gelatin?: boolean | null;
  check_amazon_badge?: boolean | null;
  check_cleaning?: boolean | null;
  damaged_quantity?: number | null;
  offline_sell_qty?: number | null;
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
  sr: 60,
  expand: 160,
  product_name: 220,
  asin: 160,
  weight: 70,
  qty: 60,
  tracking: 220,
  delivery_date: 100,
  action: 100,
};

interface CheckingTableProps {
  sellerId: number;
  onCountsChange?: () => void | Promise<void>;
  refreshKey?: number;
}

export default function CheckingTable({
  sellerId,
  onCountsChange,
  refreshKey
}: CheckingTableProps) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { logActivity, logBatchActivity } = useActivityLogger();
  // 🔴 ADD THIS NEW STATE
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);  // ✅ ADDED
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [listingErrorRollbackOpen, setListingErrorRollbackOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [visibleColumns, setVisibleColumns] = useState({
    sr: true,
    expand: true,
    invoice_no: true,
    product_name: true,
    asin: true,
    weight: true,
    qty: true,
    tracking: true,
    delivery_date: true,
    action: true,
  });

  // ✅ NEW: Column resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [openChecklistId, setOpenChecklistId] = useState<string | null>(null);
  const getChecklistLabel = (item: InvoiceItem): string => {
    const labels: string[] = [];
    if (item.check_mrp_label) labels.push('MRP');
    if (item.check_gelatin) labels.push('Gelatin');
    if (item.check_amazon_badge) labels.push('Amazon');
    if (item.check_cleaning) labels.push('Cleaning');

    if (labels.length === 0) return '-';
    if (labels.length === 1) return labels[0];
    return labels.join(', ');
  };
  const hasAnyChecklist = (item: InvoiceItem): boolean => {
    return !!(
      item.check_mrp_label ||
      item.check_gelatin ||
      item.check_amazon_badge ||
      item.check_cleaning
    );
  };
  const [checklistDropdownPos, setChecklistDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);


  useEffect(() => {
    localStorage.removeItem('checking_table_column_widths');
  }, []);

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

  // Fetch data from india_checking table
  useEffect(() => {
    fetchCheckingData();
  }, []);

  // Refresh when other tabs trigger changes
  useEffect(() => {
    if (refreshKey) fetchCheckingData();
  }, [refreshKey]);;

  const fetchCheckingData = async () => {
    try {
      setLoading(true);

      // ✅ Recursive fetch to handle 1000+ rows
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const tableName = 'india_box_checking';
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

      console.log('✅ Checking data fetched:', allData);
      console.log('✅ Number of items:', allData?.length);

      setItems(allData);
    } catch (error) {
      console.error('Error fetching checking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Filter by search query
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;

    return (
      (item.invoice_number || '').toLowerCase().includes(q) ||
      (item.box_number || '').toLowerCase().includes(q) ||
      (item.product_name || '').toLowerCase().includes(q) ||
      (item.asin || '').toLowerCase().includes(q) ||
      (item.sku || '').toLowerCase().includes(q)
    );
  });

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
      console.log(`${checked ? '✅' : '❌'} Marking item as ${checked ? 'received' : 'not received'}:`, itemId);

      // Update database
      const tableName = 'india_box_checking';
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

      console.log('✅ Product received status updated');
    } catch (error: any) {
      console.error('❌ Error updating received status:', error);
      alert(`Failed to update: ${error.message}`);
    }
  };

  // Move items to Distribution
  const handleMoveToRestock = async (itemIds: string[]) => {
    try {
      if (itemIds.length === 0) {
        alert('No items selected');
        return;
      }

      const checkingTableName = 'india_box_checking';

      const { data: itemsToMove, error: fetchError } = await supabase
        .from(checkingTableName)
        .select('*')
        .in('id', itemIds);

      if (fetchError) throw fetchError;
      if (!itemsToMove || itemsToMove.length === 0) {
        alert('No items found to move.');
        return;
      }

      // Resolve sellerId using seller_tag if present, otherwise prop
      const now = new Date().toISOString();

      // Group items by seller_tag so each goes to the correct restock + listing error table
      const bySeller: Record<string, any[]> = {};
      itemsToMove.forEach((item: any) => {
        const tag = (item.seller_tag as SellerTag) || 'GR';
        if (!bySeller[tag]) bySeller[tag] = [];
        bySeller[tag].push(item);
      });

      for (const [tag, sellerItems] of Object.entries(bySeller)) {
        const resolvedSellerId = SELLER_TAG_MAPPING[tag as SellerTag] || sellerId;
        const restockTableName = getIndiaTrackingTableName('RESTOCK', resolvedSellerId);

        const restockRows: any[] = [];
        sellerItems.forEach((item: any) => {
          const totalQty = item.actual_quantity ?? item.buying_quantity ?? 0;
          const damagedQty = item.damaged_quantity || 0;
          const offlineSellQty = item.offline_sell_qty || 0;
          const goodQty = Math.max(totalQty - damagedQty - offlineSellQty, 0);

          const base = {
            asin: item.asin,
            sku: item.sku,
            product_name: item.product_name,
            origin_india: item.origin_india ?? false,
            origin_china: item.origin_china ?? false,
            origin_us: item.origin_us ?? false,
            funnel: item.funnel,
            buying_price: item.buying_price,
            product_weight: item.product_weight,
            invoice_number: item.invoice_number,
            tracking_details: item.tracking_details,
            delivery_date: item.delivery_date,
            seller_tag: item.seller_tag,
            moved_from: 'checking',
            checking_id: item.id,
            moved_at: now,
          };

          // Always send to pending (even with 0 qty so it follows normal flow)
          restockRows.push({
            ...base,
            buying_quantity: goodQty,
            status: 'pending',
          });

          if (damagedQty > 0) {
            restockRows.push({
              ...base,
              buying_quantity: damagedQty,
              status: 'disposed',
            });
          }

          if (offlineSellQty > 0) {
            restockRows.push({
              ...base,
              buying_quantity: offlineSellQty,
              status: 'offline_sell',
            });
          }
        });

        if (restockRows.length === 0) continue;

        const { error: insertError } = await supabase
          .from(restockTableName)
          .insert(restockRows);

        if (insertError) throw insertError;

        // ✅ FIX: Copy to correct Listing Error tables (pending + funnel-based)
        for (const item of sellerItems) {
          const salesPrice = item.buying_price ?? 0;
          const funnelStr = String(item.funnel || '').toUpperCase();
          const listingPayload = {
            asin: item.asin,
            product_name: item.product_name,
            sku: item.sku,
            seller_tag: item.seller_tag,
            selling_price: salesPrice,
            min_price: Math.round(salesPrice * 0.95 * 100) / 100,
            max_price: Math.round(salesPrice * 1.20 * 100) / 100,
            remark: item.remark ?? null,
          };

          // Always insert into pending
          const tablesToInsert = [`india_listing_error_seller_${resolvedSellerId}_pending`];

          // Also insert into funnel-specific table
          if (funnelStr === 'RS' || funnelStr === 'HD' || funnelStr === 'LD' || funnelStr === '1' || funnelStr === '2') {
            tablesToInsert.push(`india_listing_error_seller_${resolvedSellerId}_high_demand`);
          } else if (funnelStr === 'DP' || funnelStr === '3') {
            tablesToInsert.push(`india_listing_error_seller_${resolvedSellerId}_dropshipping`);
          }

          for (const table of tablesToInsert) {
            const { error: listingError } = await supabase
              .from(table)
              .upsert(listingPayload, { onConflict: 'asin' });
            if (listingError) console.error(`Failed to copy to ${table}:`, listingError);
          }
        }
      }

      // Only delete from checking AFTER all inserts succeeded
      const { error: deleteError } = await supabase
        .from(checkingTableName)
        .delete()
        .in('id', itemIds);

      if (deleteError) throw deleteError;

      setItems(prev => prev.filter(i => !itemIds.includes(i.id)));
      await onCountsChange?.();

      const sellerTags = Object.keys(bySeller).join(', ');
      const asinList = itemsToMove.map((item: any) => item.asin).join(', ');
      const msg = `✅ ${itemsToMove.length} ASIN(s) [${asinList}] sent to Restock & Listing Errors for sellers: ${sellerTags}`;
      setToast({ message: msg, type: 'success' });
      setTimeout(() => setToast(null), 5000);

      logBatchActivity(
        itemsToMove.map((item: any) => ({
          asin: item.asin,
          details: { from: 'checking', seller_tag: item.seller_tag },
        })),
        {
          action: 'move',
          marketplace: 'india',
          page: 'tracking',
          table_name: 'restock (multi-seller)',
        },
      );
    } catch (error: any) {
      console.error('Error moving to restock:', error);
      alert('Failed to move items: ' + error.message);
    }
  };

  // Handle edit field with auto-save
  const handleEditField = async (itemId: string, field: string, value: number | null) => {
    try {
      setItems((prevItems) => {
        const newItems = prevItems.map((item) => {
          if (item.id === itemId) {
            const updatedItem = { ...item, [field]: value };

            if (field === 'actual_quantity' || field === 'buying_price') {
              const qty = field === 'actual_quantity' ? value : (item.actual_quantity ?? item.buying_quantity);
              const price = field === 'buying_price' ? value : item.buying_price;
              updatedItem.amount = (qty || 0) * (price || 0);
            }

            return updatedItem;
          }
          return item;
        });
        return [...newItems];
      });

      const updateData: any = { [field]: value };

      const tableName = 'india_box_checking';
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

      console.log(`✅ Updated ${field} for item ${itemId}: ${value}`);
    } catch (error: any) {
      console.error('Error updating field:', error);
      alert('Failed to update: ' + error.message);
      fetchCheckingData();
    }
  };

  const handleChecklistChange = async (
    itemId: string,
    field:
      | 'check_mrp_label'
      | 'check_gelatin'
      | 'check_amazon_badge'
      | 'check_cleaning',
    checked: boolean
  ) => {
    try {
      // local state
      setItems(prev =>
        prev.map(it =>
          it.id === itemId ? { ...it, [field]: checked } : it
        )
      );

      const { error } = await supabase
        .from('india_box_checking')
        .update({ [field]: checked })
        .eq('id', itemId);

      if (error) throw error;
    } catch (e: any) {
      console.error('Checklist update failed', e);
      alert('Failed to update checklist: ' + e.message);
      fetchCheckingData();
    }
  };

  // ✅ Update offline sell quantity
  const handleOfflineSellQtyChange = async (itemId: string, value: number | null) => {
    try {
      setItems(prev =>
        prev.map(it =>
          it.id === itemId ? { ...it, offline_sell_qty: value } : it
        )
      );
      const { error } = await supabase
        .from('india_box_checking')
        .update({ offline_sell_qty: value })
        .eq('id', itemId);
      if (error) throw error;
    } catch (e: any) {
      console.error('Offline sell qty update failed', e);
      alert('Failed to update offline sell qty: ' + e.message);
    }
  };

  // ✅ Update damaged quantity
  const handleDamagedQtyChange = async (itemId: string, value: number | null) => {
    try {
      setItems(prev =>
        prev.map(it =>
          it.id === itemId ? { ...it, damaged_quantity: value } : it
        )
      );

      const { error } = await supabase
        .from('india_box_checking')
        .update({ damaged_quantity: value })
        .eq('id', itemId);

      if (error) throw error;
    } catch (e: any) {
      console.error('Damaged qty update failed', e);
      alert('Failed to update damaged qty: ' + e.message);
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

  // Bulk move all selected items to Restock
  const handleBulkMoveToRestock = async () => {
    if (selectedItemIds.size === 0) {
      alert('No items selected');
      return;
    }

    const confirmed = confirm(
      `Move ${selectedItemIds.size} items to Restock?`,
    );
    if (!confirmed) return;

    await handleMoveToRestock(Array.from(selectedItemIds));
    setSelectedItemIds(new Set());
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!openChecklistId) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore clicks on trigger or dropdown content
      if (
        target.closest('[data-checklist-trigger="true"]') ||
        target.closest('[data-checklist-dropdown="true"]')
      ) {
        return;
      }

      setOpenChecklistId(null);
      setChecklistDropdownPos(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openChecklistId]);

  const SELLER_TAG_COLORS: Record<string, string> = {
    GR: 'bg-yellow-400 text-black',
    RR: 'bg-gray-400 text-black',
    UB: 'bg-pink-500 text-white',
    VV: 'bg-purple-600 text-white',
    DE: 'bg-orange-500 text-white',
    CV: 'bg-green-600 text-white',
  };

  type MergedCheckingRow = {
    asin: string;
    representative: InvoiceItem;
    sellers: { tag: string; qty: number; id: string }[];
    allIds: string[];
    totalQty: number;
  };

  const mergedItems: MergedCheckingRow[] = useMemo(() => {
    const grouped: Record<string, MergedCheckingRow> = {};
    filteredItems.forEach(item => {
      const key = item.asin;
      if (!grouped[key]) {
        grouped[key] = {
          asin: item.asin,
          representative: item,
          sellers: [],
          allIds: [],
          totalQty: 0,
        };
      }
      const qty = item.actual_quantity ?? item.buying_quantity ?? 0;
      grouped[key].sellers.push({
        tag: (item as any).seller_tag || '??',
        qty,
        id: item.id,
      });
      grouped[key].allIds.push(item.id);
      grouped[key].totalQty += qty;
    });
    return Object.values(grouped);
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-400">Loading checking data...</div>
      </div>
    );
  }

  const SELLER_ID_TO_TAG: Record<number, string> = {
    1: 'GR',
    2: 'RR',
    3: 'UB',
    4: 'VV',
    5: 'DE',
    6: 'CV',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar & Hide Columns */}
      <div className="flex-none px-2 sm:px-4 pt-4 sm:pt-5 pb-3 sm:pb-4 flex gap-2 sm:gap-4 items-center flex-wrap">
        <input
          type="text"
          placeholder="Search by Box, Invoice, ASIN or Product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-0 max-w-sm px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-200 placeholder:text-slate-500"
        />

        {/* Hide Columns Button */}
        <div className="relative">
          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className="px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap"
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
                      'asin': 'ASIN',
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
        {/* ⏪ Rollback from Distribution */}
        <button
          onClick={() => setRollbackOpen(true)}
          className="px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <span className="sm:hidden">⏪ Restock</span>
          <span className="hidden sm:inline">⏪ Rollback from Restock</span>
        </button>
        <button
          onClick={() => setListingErrorRollbackOpen(true)}
          className="px-3 sm:px-4 py-2 sm:py-2.5 bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <span className="sm:hidden">⏪ Errors</span>
          <span className="hidden sm:inline">⏪ Rollback from Listing Errors</span>
        </button>
      </div>

      {/* Table Wrapper - Same as page.tsx */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-slate-900 rounded-lg shadow-xl border border-slate-700 h-full flex flex-col">
          {/* Table Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            <table
              className="w-full divide-y divide-slate-800"
              style={{ minWidth: '1100px' }}   // or just omit style={}
            >
              <thead className="bg-slate-950 sticky top-0 z-10">
                <tr>
                  {/* Sr. No */}
                  {visibleColumns.sr && (
                    <th
                      style={{ width: columnWidths.sr }}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                    >
                      Sr
                    </th>
                  )}

                  {/* SKU */}
                  {visibleColumns.expand && (
                    <th
                      style={{ width: columnWidths.expand }}
                      className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                    >
                      SKU
                    </th>
                  )}

                  {visibleColumns.product_name && (
                    <th
                      style={{ width: columnWidths.product_name }}
                      className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                    >
                      Product
                    </th>
                  )}

                  <th
                    style={{ width: columnWidths.asin }}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                  >
                    ASIN
                  </th>

                  <th
                    style={{ width: 220 }}
                    className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                  >
                    Seller Tag
                  </th>

                  {visibleColumns.weight && (
                    <th
                      style={{ width: columnWidths.weight }}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                    >
                      Weight
                    </th>
                  )}

                  {visibleColumns.qty && (
                    <th
                      style={{ width: columnWidths.qty }}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800"
                    >
                      Qty
                    </th>
                  )}

                  {/* Checklist column */}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                    Checklist
                  </th>

                  {/* Damaged Qty column */}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase border-r border-slate-800">
                    Damaged Qty
                  </th>

                  {/* Offline Sell column */}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-400 uppercase border-r border-slate-800">
                    Offline Sell
                  </th>

                  {visibleColumns.action && (
                    <th
                      style={{ width: columnWidths.action }}
                      className="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase"
                    >
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {mergedItems.map((merged, index) => {
                  const item = merged.representative;
                  const anyChecklist = merged.allIds.some(id => {
                    const row = items.find(i => i.id === id);
                    return row ? hasAnyChecklist(row) : false;
                  });
                  return (
                    <tr key={merged.asin + '-' + index} className="bg-slate-900/40 hover:bg-slate-800/60">
                      {/* SR NO */}
                      {visibleColumns.sr && (
                        <td
                          style={{ width: columnWidths.sr }}
                          className="px-3 py-2 text-center text-sm text-slate-300 border-r border-slate-800"
                        >
                          {index + 1}
                        </td>
                      )}

                      {/* SKU column */}
                      {visibleColumns.expand && (
                        <td
                          style={{ width: columnWidths.expand }}
                          className="px-3 py-2 text-sm font-mono text-slate-300 border-r border-slate-800"
                        >
                          {item.sku || '-'}
                        </td>
                      )}

                      {/* Product name */}
                      {visibleColumns.product_name && (
                        <td
                          style={{ width: columnWidths.product_name }}
                          className="px-3 py-2 text-sm text-slate-300 border-r border-slate-800"
                        >
                          {item.product_name || '-'}
                        </td>
                      )}

                      {/* ASIN */}
                      <td
                        style={{ width: columnWidths.asin }}
                        className="px-3 py-2 text-sm font-mono border-r border-slate-800"
                      >
                        {item.asin ? (
                          <a href={`https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                            {item.asin}
                          </a>
                        ) : '-'}
                      </td>

                      {/* Seller Tag (merged) */}
                      <td
                        style={{ width: 220 }}
                        className="px-3 py-2 text-center border-r border-slate-800"
                      >
                        <div className="flex flex-wrap gap-1.5 justify-center items-center">
                          {merged.sellers.map(s => (
                            <div key={s.id} className="flex items-center gap-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_TAG_COLORS[s.tag] || 'bg-slate-700 text-white'}`}>
                                {s.tag}
                              </span>
                              <input
                                type="number"
                                className="w-14 bg-slate-800 border border-slate-600 rounded px-1 py-0.5 text-xs text-white text-center"
                                value={s.qty}
                                onChange={(e) => {
                                  const newVal = e.target.value === '' ? null : parseInt(e.target.value);
                                  handleEditField(s.id, 'actual_quantity', newVal);
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Weight */}
                      {visibleColumns.weight && (
                        <td
                          style={{ width: columnWidths.weight }}
                          className="px-3 py-2 text-center border-r border-slate-800"
                        >
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.product_weight ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              merged.allIds.forEach(id => handleEditField(id, 'product_weight', val));
                            }}
                            className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </td>
                      )}

                      {/* Qty (read-only total) */}
                      {visibleColumns.qty && (
                        <td
                          style={{ width: columnWidths.qty }}
                          className="px-3 py-2 text-center border-r border-slate-800 text-sm text-slate-200 font-bold"
                        >
                          {merged.totalQty}
                        </td>
                      )}

                      {/* Checklist — applies to ALL underlying rows */}
                      <td className="px-3 py-2 text-center border-r border-slate-800">
                        <div className="inline-flex flex-wrap items-center justify-center gap-2">
                          <label className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 border border-emerald-500/60 hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_mrp_label}
                              onChange={(e) =>
                                merged.allIds.forEach(id => handleChecklistChange(id, 'check_mrp_label', e.target.checked))
                              }
                              className="h-3 w-3 rounded border-emerald-400 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                            />
                            <span>MRP label</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 border border-amber-500/60 hover:bg-amber-500/20 hover:border-amber-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_gelatin}
                              onChange={(e) =>
                                merged.allIds.forEach(id => handleChecklistChange(id, 'check_gelatin', e.target.checked))
                              }
                              className="h-3 w-3 rounded border-amber-400 bg-slate-900 text-amber-400 focus:ring-amber-400"
                            />
                            <span>Gelatin</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200 border border-sky-500/60 hover:bg-sky-500/20 hover:border-sky-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_amazon_badge}
                              onChange={(e) =>
                                merged.allIds.forEach(id => handleChecklistChange(id, 'check_amazon_badge', e.target.checked))
                              }
                              className="h-3 w-3 rounded border-sky-400 bg-slate-900 text-sky-400 focus:ring-sky-400"
                            />
                            <span>Amazon Badge</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-200 border border-rose-500/60 hover:bg-rose-500/20 hover:border-rose-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_cleaning}
                              onChange={(e) =>
                                merged.allIds.forEach(id => handleChecklistChange(id, 'check_cleaning', e.target.checked))
                              }
                              className="h-3 w-3 rounded border-rose-400 bg-slate-900 text-rose-400 focus:ring-rose-400"
                            />
                            <span>Cleaning</span>
                          </label>
                        </div>
                      </td>

                      {/* Damaged quantity — applies to ALL underlying rows */}
                      <td className="px-3 py-2 text-center border-r border-slate-800">
                        <input
                          type="number"
                          min={0}
                          value={item.damaged_quantity ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            merged.allIds.forEach(id => handleDamagedQtyChange(id, val));
                          }}
                          className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </td>

                      {/* Offline Sell quantity */}
                      <td className="px-3 py-2 text-center border-r border-slate-800">
                        <input
                          type="number"
                          min={0}
                          value={item.offline_sell_qty ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            merged.allIds.forEach(id => handleOfflineSellQtyChange(id, val));
                          }}
                          className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </td>

                      {/* Action — sends ALL underlying seller rows to restock */}
                      {visibleColumns.action && (
                        <td
                          style={{ width: columnWidths.action }}
                          className="px-3 py-2 text-center"
                        >
                          <button
                            onClick={() => handleMoveToRestock(merged.allIds)}
                            disabled={!anyChecklist}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${anyChecklist
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              }`}
                          >
                            → To Restock
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Count - STICKY AT BOTTOM */}
          <div className="flex-none border-t border-slate-800 bg-slate-950 px-3 sm:px-4 py-2 sm:py-3">
            <div className="text-xs sm:text-sm text-slate-400">
              Showing {filteredItems.length} of {items.length} items
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-6">
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
          <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-semibold flex-1 text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/70 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}

      <GenericRollbackModal
        open={rollbackOpen}
        onClose={() => setRollbackOpen(false)}
        onSuccess={() => { fetchCheckingData(); if (onCountsChange) onCountsChange(); }}
        direction="DISTRIBUTION_TO_CHECKING"
        sellerId={sellerId}
        sellerTag=""
        sourceTableName={getIndiaTrackingTableName('RESTOCK', sellerId)}
        targetTableName="india_box_checking"
      />
      <GenericRollbackModal
        open={listingErrorRollbackOpen}
        onClose={() => setListingErrorRollbackOpen(false)}
        onSuccess={() => { fetchCheckingData(); if (onCountsChange) onCountsChange(); }}
        direction="LISTING_ERROR_TO_CHECKING"
        sellerId={sellerId}
        sellerTag=""
        sourceTableName={`india_listing_error_seller_${sellerId}_error`}
        targetTableName="india_box_checking"
      />
    </div>
  );
}
