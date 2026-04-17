'use client';

import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { FLIPKART_SELLER_TAG_MAPPING, FlipkartSellerTag } from '@/lib/utils';
import { SELLER_STYLES } from '@/components/shared/SellerTag';
import UploadedInvoiceModal from './UploadedInvoiceModal';


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
  sns_active?: boolean | null;
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
  const [restockRollbackItems, setRestockRollbackItems] = useState<any[]>([]);
  const [restockRollbackLoading, setRestockRollbackLoading] = useState(false);
  const [restockRollbackSelected, setRestockRollbackSelected] = useState<Set<string>>(new Set());
  const [restockRollbackSearch, setRestockRollbackSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [checkingTab, setCheckingTab] = useState<'checking' | 'damaged' | 'offline_sell'>('checking');
  const [recentlySentAsins, setRecentlySentAsins] = useState<Set<string>>(new Set());
  const [partyFilter, setPartyFilter] = useState('');
  const [offlineDateFilter, setOfflineDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [offlineDateStart, setOfflineDateStart] = useState('');
  const [offlineDateEnd, setOfflineDateEnd] = useState('');

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
    localStorage.removeItem('flipkart_checking_table_column_widths');
  }, []);

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

  // Fetch data from flipkart_checking table
  useEffect(() => {
    fetchCheckingData();
  }, []);

  // Refresh when other tabs trigger changes
  useEffect(() => {
    if (refreshKey) fetchCheckingData();
  }, [refreshKey]);

  useEffect(() => {
    if (rollbackOpen) { fetchAllRestockItems(); setRestockRollbackSelected(new Set()); setRestockRollbackSearch(''); }
  }, [rollbackOpen]);

  const fetchCheckingData = async () => {
    try {
      setLoading(true);

      // ✅ Recursive fetch to handle 1000+ rows
      let allData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const tableName = 'flipkart_box_checking';
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
      console.error('Error fetching checking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Filter by search query AND tab
  const filteredItems = items.filter((item) => {
    // Tab filter: action_status
    const status = item.action_status;
    if (checkingTab === 'checking' && (status === 'damaged' || status === 'offline_sell' || status === 'pending_restock')) return false;
    if (checkingTab === 'damaged' && status !== 'damaged') return false;
    if (checkingTab === 'offline_sell' && status !== 'offline_sell') return false;

    // Date filter for offline sell tab
    if (checkingTab === 'offline_sell') {
      const itemDate = (item as any).offline_sold_at ? new Date((item as any).offline_sold_at) : null;
      if (offlineDateFilter === 'today') {
        if (!itemDate || itemDate.toDateString() !== new Date().toDateString()) return false;
      } else if (offlineDateFilter === 'week') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (!itemDate || itemDate < weekAgo) return false;
      } else if (offlineDateFilter === 'month') {
        const now = new Date();
        if (!itemDate || itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false;
      } else if (offlineDateFilter === 'all' && (offlineDateStart || offlineDateEnd)) {
        if (!itemDate) return false;
        if (offlineDateStart && itemDate < new Date(offlineDateStart)) return false;
        if (offlineDateEnd) {
          const endDate = new Date(offlineDateEnd);
          endDate.setHours(23, 59, 59, 999);
          if (itemDate > endDate) return false;
        }
      }
    }
    // Party filter for offline sell tab
    if (checkingTab === 'offline_sell' && partyFilter) {
      const p = (item as any).party || '';
      if (!p.toLowerCase().includes(partyFilter.toLowerCase())) return false;
    }

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

      // Update database
      const tableName = 'flipkart_box_checking';
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

  // Move items to Distribution
  const handleMoveToRestock = async (itemIds: string[]) => {
    try {
      if (itemIds.length === 0) {
        setToast({ message: 'No items selected', type: 'error' });
        return;
      }

      const checkingTableName = 'flipkart_box_checking';

      const { data: itemsToMove, error: fetchError } = await supabase
        .from(checkingTableName)
        .select('*')
        .in('id', itemIds);

      if (fetchError) throw fetchError;
      if (!itemsToMove || itemsToMove.length === 0) {
        setToast({ message: 'No items found to move', type: 'error' });
        return;
      }

      const now = new Date().toISOString();

      // Get damaged & offline from representative item (set at ASIN level)
      const representative = itemsToMove[0];
      const damagedQty = representative.damaged_quantity || 0;
      const offlineSellQty = representative.offline_sell_qty || 0;

      // Group items by seller_tag
      const bySeller: Record<string, any[]> = {};
      itemsToMove.forEach((item: any) => {
        const tag = (item.seller_tag as FlipkartSellerTag) || 'GR';
        if (!bySeller[tag]) bySeller[tag] = [];
        bySeller[tag].push(item);
      });

      // Calculate total qty across all sellers
      const sellerEntries = Object.entries(bySeller).map(([tag, items]) => {
        const qty = items.reduce((sum: number, i: any) => sum + (i.actual_quantity ?? i.buying_quantity ?? 0), 0);
        return { tag, items, qty };
      });
      const totalQty = sellerEntries.reduce((sum, s) => sum + s.qty, 0);
      const remaining = Math.max(totalQty - damagedQty - offlineSellQty, 0);

      // Proportionally distribute remaining among sellers
      let distributed = 0;
      const sellerAllocations = sellerEntries.map((s, idx) => {
        if (totalQty === 0) return { ...s, allocated: 0 };
        const share = Math.floor((s.qty / totalQty) * remaining);
        distributed += share;
        return { ...s, allocated: share };
      });
      // Distribute rounding remainder to sellers with largest qty first
      let leftover = remaining - distributed;
      const sortedByQty = [...sellerAllocations].sort((a, b) => b.qty - a.qty);
      for (let i = 0; leftover > 0 && i < sortedByQty.length; i++) {
        sortedByQty[i].allocated += 1;
        leftover--;
      }

      // Insert proportional pending rows to restock per seller
      for (const seller of sellerAllocations) {
        const resolvedSellerId = FLIPKART_SELLER_TAG_MAPPING[seller.tag as FlipkartSellerTag] || sellerId;

        const item = seller.items[0]; // representative for this seller
        const restockRow = {
          marketplace: 'flipkart',
          seller_id: resolvedSellerId,
          ops_type: 'restock',
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
          buying_quantity: seller.allocated,
          status: 'pending',
          sns_active: item.sns_active ?? false,
          journey_id: item.journey_id ?? null,
          journey_number: item.journey_number ?? null,
        };

        const { error: insertError } = await supabase
          .from('tracking_ops')
          .insert([restockRow]);
        if (insertError) throw insertError;

        // Copy to unified listing_errors table — dual-write: pending + funnel-specific
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
          seller_link: (item as any).seller_link ?? null,
          sns_active: item.sns_active ?? false,
          journey_id: item.journey_id ?? null,
          journey_number: item.journey_number ?? null,
        };

        // Insert pending row
        const { error: pendingError } = await supabase
          .from('listing_errors')
          .upsert({
            ...listingPayload,
            marketplace: 'flipkart',
            seller_id: resolvedSellerId,
            error_status: 'pending',
          }, { onConflict: 'marketplace,seller_id,asin,error_status' });
        if (pendingError) console.error('Failed to copy pending row to listing_errors:', pendingError);

        // Also insert funnel-specific row (high_demand or dropshipping)
        const funnelStatus = (funnelStr === 'RS' || funnelStr === 'HD' || funnelStr === 'LD' || funnelStr === '1' || funnelStr === '2')
          ? 'high_demand'
          : 'dropshipping';
        const { error: funnelError } = await supabase
          .from('listing_errors')
          .upsert({
            ...listingPayload,
            marketplace: 'flipkart',
            seller_id: resolvedSellerId,
            error_status: funnelStatus,
          }, { onConflict: 'marketplace,seller_id,asin,error_status' });
        if (funnelError) console.error('Failed to copy funnel row to listing_errors:', funnelError);
      }

      // Mark original checking rows as pending_restock (preserve them)
      const { error: deleteError } = await supabase
        .from(checkingTableName)
        .update({ action_status: 'pending_restock' })
        .in('id', itemIds);
      if (deleteError) throw deleteError;

      // Insert back damaged/offline rows into checking
      const baseKeep = {
        asin: representative.asin,
        sku: representative.sku,
        product_name: representative.product_name,
        brand: representative.brand,
        origin_india: representative.origin_india ?? false,
        origin_china: representative.origin_china ?? false,
        origin_us: representative.origin_us ?? false,
        funnel: representative.funnel,
        buying_price: representative.buying_price,
        product_weight: representative.product_weight,
        seller_tag: representative.seller_tag,
        tracking_details: representative.tracking_details,
        delivery_date: representative.delivery_date,
      };

      const keepRows: any[] = [];
      if (damagedQty > 0) {
        keepRows.push({ ...baseKeep, buying_quantity: damagedQty, actual_quantity: damagedQty, action_status: 'damaged' });
      }
      if (offlineSellQty > 0) {
        keepRows.push({ ...baseKeep, buying_quantity: offlineSellQty, actual_quantity: offlineSellQty, action_status: 'offline_sell', offline_sold_at: new Date().toISOString() });
      }
      if (keepRows.length > 0) {
        const { error: keepError } = await supabase.from(checkingTableName).insert(keepRows);
        if (keepError) console.error('Failed to keep damaged/offline in checking:', keepError);
      }

      // Update local state
      setItems(prev => {
        const filtered = prev.filter(i => !itemIds.includes(i.id));
        // Add the kept rows to local state
        const newLocalRows = keepRows.map((r, idx) => ({ ...r, id: `temp-${Date.now()}-${idx}` }));
        return [...filtered, ...newLocalRows];
      });
      await onCountsChange?.();
      // Re-fetch to get proper IDs from DB
      fetchCheckingData();

      setRecentlySentAsins(new Set(itemsToMove.map((i: any) => i.asin)));

      const sellerTags = sellerAllocations.map(s => s.tag).join(', ');
      const msg = `✅ ${representative.asin} → Restock (${remaining} qty distributed to ${sellerTags})${damagedQty > 0 ? ` | ${damagedQty} damaged kept` : ''}${offlineSellQty > 0 ? ` | ${offlineSellQty} offline kept` : ''}`;
      setToast({ message: msg, type: 'success' });
      setTimeout(() => setToast(null), 5000);

      logBatchActivity(
        itemsToMove.map((item: any) => ({
          asin: item.asin,
          details: { from: 'checking', seller_tag: item.seller_tag },
        })),
        {
          action: 'move',
          marketplace: 'flipkart',
          page: 'tracking',
          table_name: 'restock (multi-seller)',
        },
      );
    } catch (error: any) {
      console.error('Error moving to restock:', error);
      setToast({ message: `Failed to move items: ${error.message}`, type: 'error' });
    }
  };

  const handleSendToRechecking = async (itemIds: string[]) => {
    try {
      if (itemIds.length === 0) return;
      const itemsToRecheck = items.filter(i => itemIds.includes(i.id));
      const asins = [...new Set(itemsToRecheck.map(i => i.asin))];

      for (const asin of asins) {
        const recheckedItem = itemsToRecheck.find(i => i.asin === asin);
        if (!recheckedItem) continue;
        const recheckedQty = recheckedItem.buying_quantity ?? recheckedItem.actual_quantity ?? 0;

        // Check if there are already restored rows (action_status = null) for this ASIN
        const { data: existingRows } = await supabase
          .from('flipkart_box_checking')
          .select('*')
          .eq('asin', asin)
          .is('action_status', null);

        // Also check for pending_restock rows
        const { data: pendingRows } = await supabase
          .from('flipkart_box_checking')
          .select('*')
          .eq('asin', asin)
          .eq('action_status', 'pending_restock');

        if (existingRows && existingRows.length > 0) {
          // Rows already restored (other tab was rechecked first) — add qty proportionally
          const currentTotal = existingRows.reduce((sum: number, r: any) => sum + (r.actual_quantity ?? r.buying_quantity ?? 0), 0);
          let distributed = 0;
          const allocations = existingRows.map((row: any) => {
            const sellerQty = row.actual_quantity ?? row.buying_quantity ?? 0;
            const share = Math.floor((sellerQty / currentTotal) * recheckedQty);
            distributed += share;
            return { id: row.id, currentQty: sellerQty, share };
          });
          let leftover = recheckedQty - distributed;
          allocations.sort((a, b) => b.currentQty - a.currentQty);
          for (let i = 0; leftover > 0 && i < allocations.length; i++) {
            allocations[i].share += 1;
            leftover--;
          }

          for (const alloc of allocations) {
            const newQty = alloc.currentQty + alloc.share;
            await supabase
              .from('flipkart_box_checking')
              .update({ buying_quantity: newQty, actual_quantity: newQty, damaged_quantity: null, offline_sell_qty: null })
              .eq('id', alloc.id);
          }

          // Also restore pending_restock rows if any still exist (cleanup)
          if (pendingRows && pendingRows.length > 0) {
            await supabase.from('flipkart_box_checking').delete().in('id', pendingRows.map((r: any) => r.id));
          }
        } else if (pendingRows && pendingRows.length > 0) {
          // First recheck — restore pending_restock rows with proportional quantities
          const originalTotal = pendingRows.reduce((sum: number, r: any) => sum + (r.actual_quantity ?? r.buying_quantity ?? 0), 0);
          let distributed = 0;
          const allocations = pendingRows.map((row: any) => {
            const sellerQty = row.actual_quantity ?? row.buying_quantity ?? 0;
            const share = Math.floor((sellerQty / originalTotal) * recheckedQty);
            distributed += share;
            return { id: row.id, originalQty: sellerQty, share };
          });
          let leftover = recheckedQty - distributed;
          allocations.sort((a, b) => b.originalQty - a.originalQty);
          for (let i = 0; leftover > 0 && i < allocations.length; i++) {
            allocations[i].share += 1;
            leftover--;
          }

          for (const alloc of allocations) {
            await supabase
              .from('flipkart_box_checking')
              .update({
                action_status: null,
                buying_quantity: alloc.share,
                actual_quantity: alloc.share,
                damaged_quantity: recheckedItem.action_status === 'damaged' ? alloc.share : null,
                offline_sell_qty: recheckedItem.action_status === 'offline_sell' ? alloc.share : null,
              })
              .eq('id', alloc.id);
          }
        }

        // Delete the damaged/offline row
        await supabase
          .from('flipkart_box_checking')
          .delete()
          .in('id', itemIds.filter(id => items.find(i => i.id === id)?.asin === asin));
      }

      setToast({ message: `✅ ${asins.join(', ')} sent back to Checking with all sellers`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
      fetchCheckingData();
    } catch (error: any) {
      setToast({ message: `Failed: ${error.message}`, type: 'error' });
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

      const tableName = 'flipkart_box_checking';
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;

    } catch (error: any) {
      console.error('Error updating field:', error);
      setToast({ message: `Failed to update: ${error.message}`, type: 'error' });
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
        .from('flipkart_box_checking')
        .update({ [field]: checked })
        .eq('id', itemId);

      if (error) throw error;
    } catch (e: any) {
      console.error('Checklist update failed', e);
      setToast({ message: `Failed to update checklist: ${e.message}`, type: 'error' });
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
        .from('flipkart_box_checking')
        .update({ offline_sell_qty: value })
        .eq('id', itemId);
      if (error) throw error;
    } catch (e: any) {
      console.error('Offline sell qty update failed', e);
      setToast({ message: `Failed to update offline sell qty: ${e.message}`, type: 'error' });
    }
  };

  // ✅ Update damaged quantity
  const handlePartyChange = async (itemId: string, value: string) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, party: value } as any : it));
    const { error } = await supabase.from('flipkart_box_checking').update({ party: value }).eq('id', itemId);
    if (error) console.error('Failed to update party:', error);
  };

  const handleDamagedQtyChange = async (itemId: string, value: number | null) => {
    try {
      setItems(prev =>
        prev.map(it =>
          it.id === itemId ? { ...it, damaged_quantity: value } : it
        )
      );

      const { error } = await supabase
        .from('flipkart_box_checking')
        .update({ damaged_quantity: value })
        .eq('id', itemId);

      if (error) throw error;
    } catch (e: any) {
      console.error('Damaged qty update failed', e);
      setToast({ message: `Failed to update damaged qty: ${e.message}`, type: 'error' });
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
      setToast({ message: 'No items selected', type: 'error' });
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


  const displayItems = useMemo(() => {
    return filteredItems;
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-400">Loading checking data...</div>
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

  // ============================================
  // ROLLBACK FROM ALL RESTOCK + LISTING ERROR
  // ============================================
  const fetchAllRestockItems = async () => {
    setRestockRollbackLoading(true);
    try {
      const allItems: any[] = [];
      const { data, error } = await supabase
        .from('tracking_ops')
        .select('*')
        .eq('marketplace', 'flipkart')
        .eq('ops_type', 'restock')
        .in('seller_id', [1, 2, 3, 4, 5, 6])
        .order('created_at', { ascending: false });
      if (!error && data) {
        data.forEach((item: any) => allItems.push({ ...item, _sellerId: item.seller_id }));
      }
      setRestockRollbackItems(allItems);
    } catch (err) {
      console.error('Failed to fetch restock items:', err);
    } finally {
      setRestockRollbackLoading(false);
    }
  };


  const handleRestockRollback = async () => {
    if (restockRollbackSelected.size === 0) return;
    if (!confirm(`Rollback ${restockRollbackSelected.size} item(s) from Restock & Listing Errors → Checking?`)) return;
    try {
      const selectedItems = restockRollbackItems.filter(i => restockRollbackSelected.has(i.id));
      // Insert back into checking
      const checkingRows = selectedItems.map(item => ({
        asin: item.asin, sku: item.sku, product_name: item.product_name,
        seller_tag: item.seller_tag, funnel: item.funnel,
        buying_price: item.buying_price, buying_quantity: item.buying_quantity,
        actual_quantity: item.buying_quantity, product_weight: item.product_weight,
        origin_india: item.origin_india ?? false, origin_china: item.origin_china ?? false,
        origin_us: item.origin_us ?? false, tracking_details: item.tracking_details,
        delivery_date: item.delivery_date,
        journey_id: item.journey_id ?? null,
        sns_active: item.sns_active ?? false,
        journey_number: item.journey_number ?? null,
      }));
      const { error: insertError } = await supabase.from('flipkart_box_checking').insert(checkingRows);
      if (insertError) throw insertError;
      // Delete from tracking_ops (restock rows) by ids
      const restockIds = selectedItems.map(i => i.id);
      if (restockIds.length > 0) {
        const { error } = await supabase.from('tracking_ops').delete().in('id', restockIds);
        if (error) throw error;
      }
      // Delete from unified listing_errors table for these ASINs
      const asins = [...new Set(selectedItems.map((i: any) => i.asin))];
      const sellerIds = [...new Set(selectedItems.map((i: any) => i._sellerId))];
      for (const sid of sellerIds) {
        for (const suffix of ['pending', 'high_demand', 'dropshipping', 'error']) {
          await supabase
            .from('listing_errors')
            .delete()
            .eq('marketplace', 'flipkart')
            .eq('seller_id', sid)
            .eq('error_status', suffix)
            .in('asin', asins);
        }
      }
      // Clean up pending_restock rows
      await supabase.from('flipkart_box_checking').delete().in('asin', asins).eq('action_status', 'pending_restock');

      setToast({ message: `✅ ${selectedItems.length} item(s) rolled back to Checking (restock + listing errors cleaned)`, type: 'success' });
      setTimeout(() => setToast(null), 4000);
      setRollbackOpen(false);
      fetchCheckingData();
      if (onCountsChange) onCountsChange();
    } catch (err: any) {
      setToast({ message: `Rollback failed: ${err.message}`, type: 'error' });
    }
  };

  const checkingCount = new Set(items.filter(i => !i.action_status).map(i => i.asin)).size;
  const damagedCount = new Set(items.filter(i => i.action_status === 'damaged').map(i => i.asin)).size;
  const offlineSellCount = new Set(items.filter(i => i.action_status === 'offline_sell').map(i => i.asin)).size;

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar & Hide Columns */}
      <div className="flex-none px-4 sm:px-6 pt-6 pb-6 flex gap-4 items-center flex-wrap">

        {/* Tabs */}
        <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
          {([
            { id: 'checking' as const, label: 'Checking', count: checkingCount },
            { id: 'damaged' as const, label: 'Damaged', count: damagedCount },
            { id: 'offline_sell' as const, label: 'Offline Sell', count: offlineSellCount },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setCheckingTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${checkingTab === tab.id
                ? tab.id === 'damaged' ? 'bg-rose-600 text-white shadow-lg'
                  : tab.id === 'offline_sell' ? 'bg-cyan-600 text-white shadow-lg'
                    : 'bg-orange-500 text-white shadow-lg'
                : 'text-gray-500 hover:text-gray-200'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search by Box, Invoice, ASIN or Product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-0 max-w-sm px-4 sm:px-6 py-2 sm:py-2.5 text-sm bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder:text-gray-500"
        />

        {checkingTab === 'offline_sell' && (
          <>
            <div className="flex items-center bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
              {(['all', 'today', 'week', 'month'] as const).map(opt => (
                <button key={opt} onClick={() => setOfflineDateFilter(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${offlineDateFilter === opt ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-200'}`}>
                  {opt === 'all' ? 'All' : opt === 'today' ? 'Today' : opt === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>
            {offlineDateFilter === 'all' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={offlineDateStart}
                  onChange={(e) => setOfflineDateStart(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-cyan-500 text-gray-100"
                />
                <span className="text-gray-500 text-xs">to</span>
                <input
                  type="date"
                  value={offlineDateEnd}
                  onChange={(e) => setOfflineDateEnd(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-cyan-500 text-gray-100"
                />
                {(offlineDateStart || offlineDateEnd) && (
                  <button
                    onClick={() => { setOfflineDateStart(''); setOfflineDateEnd(''); }}
                    className="text-gray-500 hover:text-cyan-400 text-xs px-1"
                  >✕</button>
                )}
              </div>
            )}
            <input
              type="text"
              placeholder="Filter by party..."
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="max-w-[180px] px-3 py-2 text-sm bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-cyan-500 text-gray-100 placeholder:text-gray-500"
            />
          </>
        )}

        {/* Hide Columns Button */}
        <div className="relative">
          <button
            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap"
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
        {/* ⏪ Rollback from Distribution */}
        {checkingTab === 'checking' && (
        <button
          onClick={() => setRollbackOpen(true)}
          className="px-4 sm:px-6 py-2 sm:py-2.5 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs sm:text-sm font-semibold hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 whitespace-nowrap"
        >
          ⏪ Rollback from Restock & Listing Errors
        </button>
        )}
      </div>

      {/* Table Wrapper - Same as page.tsx */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] h-full flex flex-col">
          {/* Table Scroll Container */}
          <div className="flex-1 overflow-y-auto">
            <table
              className="w-full divide-y divide-white/[0.06]"
              style={{ minWidth: '1100px' }}   // or just omit style={}
            >
              <thead className="bg-[#111111] sticky top-0 z-10">
                <tr>
                  {/* Sr. No */}
                  {visibleColumns.sr && (
                    <th
                      style={{ width: columnWidths.sr }}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                    >
                      Sr
                    </th>
                  )}

                  {/* SKU */}
                  {visibleColumns.expand && (
                    <th
                      style={{ width: columnWidths.expand }}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                    >
                      SKU
                    </th>
                  )}

                  {visibleColumns.product_name && (
                    <th
                      style={{ width: columnWidths.product_name }}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                    >
                      Product
                    </th>
                  )}

                  <th
                    style={{ width: columnWidths.asin }}
                    className="px-3 py-3 text-left text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                  >
                    ASIN
                  </th>

                  <th
                    style={{ width: 220 }}
                    className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                  >
                    Seller Tag
                  </th>

                  {visibleColumns.weight && (
                    <th
                      style={{ width: columnWidths.weight }}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                    >
                      Weight
                    </th>
                  )}

                  {visibleColumns.qty && (
                    <th
                      style={{ width: columnWidths.qty }}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]"
                    >
                      Qty
                    </th>
                  )}

                  {/* Checklist column */}
                  {checkingTab === 'checking' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                    Checklist
                  </th>
                  )}

                  {/* Damaged Qty column */}
                  {checkingTab === 'checking' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                    Damaged Qty
                  </th>
                  )}

                  {/* Offline Sell column */}
                  {checkingTab === 'checking' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-cyan-400 uppercase border-r border-white/[0.1]">
                    Offline Sell
                  </th>
                  )}

                  {/* Qty column for damaged/offline tabs */}
                  {checkingTab !== 'checking' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                    Quantity
                  </th>
                  )}
                  {checkingTab === 'offline_sell' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-cyan-400 uppercase border-r border-white/[0.1]">
                    Party
                  </th>
                  )}
                  {checkingTab === 'offline_sell' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase border-r border-white/[0.1]">
                    Date
                  </th>
                  )}

                  {checkingTab !== 'checking' && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase">Action</th>
                  )}

                  {visibleColumns.action && checkingTab === 'checking' && (
                    <th
                      style={{ width: columnWidths.action }}
                      className="px-3 py-3 text-center text-xs font-semibold text-gray-400 uppercase"
                    >
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {displayItems.map((item, index) => {
                  const anyChecklist = hasAnyChecklist(item);
                  return (
                    <tr key={item.id} className="bg-[#1a1a1a] hover:bg-[#111111]/60">
                      {/* SR NO */}
                      {visibleColumns.sr && (
                        <td
                          style={{ width: columnWidths.sr }}
                          className="px-3 py-2 text-center text-sm text-gray-300 border-r border-white/[0.1]"
                        >
                          {index + 1}
                        </td>
                      )}

                      {/* SKU column */}
                      {visibleColumns.expand && (
                        <td
                          style={{ width: columnWidths.expand }}
                          className="px-3 py-2 text-sm font-mono text-gray-300 border-r border-white/[0.1]"
                        >
                          {item.sku || '-'}
                        </td>
                      )}

                      {/* Product name */}
                      {visibleColumns.product_name && (
                        <td
                          style={{ width: columnWidths.product_name }}
                          className="px-3 py-2 text-sm text-gray-300 border-r border-white/[0.1]"
                        >
                          <div className="flex items-center">
                            <span className="truncate max-w-[180px]" title={item.product_name || ''}>{item.product_name || '-'}</span>
                            {item.sns_active && <span className="ml-1 px-1.5 py-0.5 bg-teal-900/50 text-teal-300 text-[10px] rounded font-medium flex-shrink-0">S&S</span>}
                          </div>
                        </td>
                      )}

                      {/* ASIN */}
                      <td
                        style={{ width: columnWidths.asin }}
                        className="px-3 py-2 text-sm font-mono border-r border-white/[0.1]"
                      >
                        {item.asin ? (
                          <a href={`https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:text-orange-400 underline">
                            {item.asin}
                          </a>
                        ) : '-'}
                      </td>

                      {/* Seller Tag */}
                      <td
                        style={{ width: 220 }}
                        className="px-3 py-2 text-center border-r border-white/[0.1]"
                      >
                        <div className="flex flex-wrap gap-1.5 justify-center items-center">
                          <div className="flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SELLER_STYLES[item.seller_tag || ''] || 'bg-[#1a1a1a] text-white'}`}>
                              {item.seller_tag || '??'}
                            </span>
                            <input
                              type="number"
                              className="w-14 bg-[#111111] border border-white/[0.1] rounded px-1 py-0.5 text-xs text-white text-center"
                              value={item.actual_quantity ?? item.buying_quantity ?? 0}
                              onChange={(e) => {
                                const newVal = e.target.value === '' ? null : parseInt(e.target.value);
                                handleEditField(item.id, 'actual_quantity', newVal);
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Weight */}
                      {visibleColumns.weight && (
                        <td
                          style={{ width: columnWidths.weight }}
                          className="px-3 py-2 text-center border-r border-white/[0.1]"
                        >
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={item.product_weight ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              handleEditField(item.id, 'product_weight', val);
                            }}
                            className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </td>
                      )}

                      {/* Qty */}
                      {visibleColumns.qty && (
                        <td
                          style={{ width: columnWidths.qty }}
                          className="px-3 py-2 text-center border-r border-white/[0.1] text-sm text-gray-100 font-bold"
                        >
                          {item.actual_quantity ?? item.buying_quantity ?? 0}
                        </td>
                      )}

                      {/* Checklist */}
                      {checkingTab === 'checking' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <div className="inline-flex flex-wrap items-center justify-center gap-2">
                          <label className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-200 border border-emerald-500/60 hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_mrp_label}
                              onChange={(e) =>
                                handleChecklistChange(item.id, 'check_mrp_label', e.target.checked)
                              }
                              className="h-3 w-3 rounded border-emerald-400 bg-[#111111] text-emerald-400 focus:ring-emerald-400"
                            />
                            <span>MRP label</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] text-amber-200 border border-amber-500/60 hover:bg-amber-500/20 hover:border-amber-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_gelatin}
                              onChange={(e) =>
                                handleChecklistChange(item.id, 'check_gelatin', e.target.checked)
                              }
                              className="h-3 w-3 rounded border-amber-400 bg-[#111111] text-amber-400 focus:ring-amber-400"
                            />
                            <span>Gelatin</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1 text-[11px] text-sky-200 border border-sky-500/60 hover:bg-sky-500/20 hover:border-sky-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_amazon_badge}
                              onChange={(e) =>
                                handleChecklistChange(item.id, 'check_amazon_badge', e.target.checked)
                              }
                              className="h-3 w-3 rounded border-sky-400 bg-[#111111] text-sky-400 focus:ring-sky-400"
                            />
                            <span>Amazon Badge</span>
                          </label>

                          <label className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] text-rose-200 border border-rose-500/60 hover:bg-rose-500/20 hover:border-rose-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!item.check_cleaning}
                              onChange={(e) =>
                                handleChecklistChange(item.id, 'check_cleaning', e.target.checked)
                              }
                              className="h-3 w-3 rounded border-rose-400 bg-[#111111] text-rose-400 focus:ring-rose-400"
                            />
                            <span>Cleaning</span>
                          </label>
                        </div>
                      </td>
                      )}

                      {/* Damaged quantity */}
                      {checkingTab === 'checking' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <input
                          type="number"
                          min={0}
                          value={item.damaged_quantity ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            handleDamagedQtyChange(item.id, val);
                          }}
                          className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </td>
                      )}

                      {/* Offline Sell quantity */}
                      {checkingTab === 'checking' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <input
                          type="number"
                          min={0}
                          value={item.offline_sell_qty ?? ''}
                          onChange={e => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            handleOfflineSellQtyChange(item.id, val);
                          }}
                          className="w-20 px-2 py-1 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </td>
                      )}

                      {/* Quantity for damaged/offline tabs */}
                      {checkingTab !== 'checking' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${checkingTab === 'damaged' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'}`}>
                          {item.buying_quantity ?? item.actual_quantity ?? 0}
                        </span>
                      </td>
                      )}
                      {checkingTab === 'offline_sell' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1]">
                        <input
                          type="text"
                          value={(item as any).party || ''}
                          onChange={(e) => handlePartyChange(item.id, e.target.value)}
                          placeholder="Enter party..."
                          className="w-32 px-2 py-1.5 bg-[#111111] border border-white/[0.1] rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder:text-gray-500"
                        />
                      </td>
                      )}
                      {checkingTab === 'offline_sell' && (
                      <td className="px-6 py-4 text-center border-r border-white/[0.1] text-xs text-gray-300">
                        {(item as any).offline_sold_at ? new Date((item as any).offline_sold_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      )}

                      {checkingTab !== 'checking' && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleSendToRechecking([item.id])}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-400 transition-colors"
                        >
                          ↩ Recheck
                        </button>
                      </td>
                      )}

                      {/* Action */}
                      {visibleColumns.action && checkingTab === 'checking' && (
                        <td
                          style={{ width: columnWidths.action }}
                          className="px-3 py-2 text-center"
                        >
                          <button
                            onClick={() => handleMoveToRestock([item.id])}
                            disabled={!anyChecklist}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${anyChecklist
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-[#1a1a1a] text-gray-500 cursor-not-allowed'
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
          <div className="flex-none border-t border-white/[0.1] bg-[#111111] px-4 sm:px-6 py-2 sm:py-3">
            <div className="text-xs sm:text-sm text-gray-300">
              Showing {displayItems.length} items
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
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-md p-4 sm:p-6">
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

      {rollbackOpen && (
        <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[#111111] border-b border-white/[0.1] px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Rollback: Restock → Checking</h2>
                <p className="text-sm text-gray-300">Items from <span className="text-amber-400">all sellers</span> — also removes from listing errors</p>
                {recentlySentAsins.size > 0 && (
                  <p className="text-xs text-amber-400 mt-1">⚡ Recently sent items are highlighted</p>
                )}
              </div>
              <button onClick={() => setRollbackOpen(false)} className="text-gray-400 hover:text-white p-2 hover:bg-[#111111] rounded-lg text-xl">✕</button>
            </div>
            <div className="px-6 py-4 border-b border-white/[0.1]">
              <input type="text" placeholder="Search by ASIN, Product Name, Seller Tag..." value={restockRollbackSearch} onChange={(e) => setRestockRollbackSearch(e.target.value)} className="w-full pl-4 pr-4 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg focus:outline-none focus:border-orange-500 text-gray-100 placeholder:text-gray-500" />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {restockRollbackLoading ? (
                <div className="flex items-center justify-center h-64 text-gray-400">Loading from all restock tables...</div>
              ) : (() => {
                const filtered = restockRollbackItems.filter(i => { if (!restockRollbackSearch) return true; const q = restockRollbackSearch.toLowerCase(); return i.asin?.toLowerCase().includes(q) || i.product_name?.toLowerCase().includes(q) || i.seller_tag?.toLowerCase().includes(q); }).sort((a, b) => { const aRecent = recentlySentAsins.has(a.asin) ? 0 : 1; const bRecent = recentlySentAsins.has(b.asin) ? 0 : 1; return aRecent - bRecent; });
                return filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-gray-500">No items found in Restock</div>
                ) : (
                  <table className="w-full"><thead className="bg-[#111111] border-b border-white/[0.1] sticky top-0"><tr>
                    <th className="px-6 py-4 text-left w-12"><input type="checkbox" checked={filtered.length > 0 && filtered.every(i => restockRollbackSelected.has(i.id))} onChange={(e) => { if (e.target.checked) setRestockRollbackSelected(new Set(filtered.map(i => i.id))); else setRestockRollbackSelected(new Set()); }} className="w-5 h-5 accent-indigo-600" /></th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">ASIN</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">Product Name</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Seller</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Qty</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-400">Status</th>
                  </tr></thead><tbody className="divide-y divide-white/[0.06]">
                    {filtered.map(item => (
                      <tr key={item.id} className={`cursor-pointer ${recentlySentAsins.has(item.asin) ? 'bg-amber-900/30 hover:bg-amber-900/50 border-l-2 border-l-amber-500' : 'hover:bg-white/[0.05]'}`} onClick={() => { const s = new Set(restockRollbackSelected); if (s.has(item.id)) s.delete(item.id); else s.add(item.id); setRestockRollbackSelected(s); }}>
                        <td className="px-6 py-4"><input type="checkbox" checked={restockRollbackSelected.has(item.id)} readOnly className="w-5 h-5 accent-indigo-600" /></td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-100">{item.asin}</td>
                        <td className="px-6 py-4 text-sm text-gray-300"><div className="truncate max-w-[250px]">{item.product_name || '-'}</div></td>
                        <td className="px-6 py-4 text-center text-sm text-gray-300">{item.seller_tag || '-'}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-300">{item.buying_quantity || '-'}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-300">{item.status || '-'}</td>
                      </tr>))}
                  </tbody></table>
                );
              })()}
            </div>
            <div className="bg-[#111111] border-t border-white/[0.1] px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-300">{restockRollbackSelected.size > 0 ? <span className="text-amber-400 font-semibold">{restockRollbackSelected.size} selected</span> : `${restockRollbackItems.length} items available`}</div>
              <div className="flex gap-3">
                <button onClick={() => setRollbackOpen(false)} className="px-6 py-2.5 bg-[#111111] border border-white/[0.1] rounded-lg text-gray-500 hover:bg-[#1a1a1a]">Cancel</button>
                <button onClick={handleRestockRollback} disabled={restockRollbackSelected.size === 0} className={`px-8 py-2.5 rounded-lg font-semibold text-white ${restockRollbackSelected.size === 0 ? 'bg-[#111111] text-gray-500 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-500'}`}>⏪ Rollback {restockRollbackSelected.size > 0 ? `(${restockRollbackSelected.size})` : ''}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}