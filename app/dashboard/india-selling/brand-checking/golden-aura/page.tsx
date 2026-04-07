'use client';

import { useActivityLogger } from '@/lib/hooks/useActivityLogger';
import { useAuth } from '@/lib/hooks/useAuth'
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Toast from '@/components/Toast';
import RejectModal from '../../../../components/RejectModal';
import FunnelBadge from '../../../../components/FunnelBadge';
import BotControlPanel from '@/components/india-selling/BotControlPanel';
import { generateAmazonLink , ensureAbsoluteUrl } from '@/lib/utils';
import { batchCheckPipeline, PipelineResult } from '@/lib/utils/pipelineCheck';
import {
  Search,
  RotateCcw,
  LayoutList,
  Columns,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter
} from 'lucide-react';

interface ProductRow {
  id: string;
  asin: string;
  product_name: string | null;
  brand: string | null;
  funnel: string | null;
  monthly_unit: number | null;
  product_link: string | null;
  amz_link: string | null;
  working?: boolean;
  reason?: string | null;
  remark?: string | null;
  sku?: string | null;
}

type CategoryTab = 'high_demand' | 'dropshipping' | 'not_approved' | 'reject';

// ✅ 1. UPDATE: Defined larger default widths for better layout
const DEFAULT_WIDTHS: Record<string, number> = {
  asin: 120,
  product_name: 200,
  sku: 80,
  brand: 100,
  funnel: 90,
  monthly_unit: 90,
  product_link: 85,
  amz_link: 85,
  reason: 150,
  remark: 120,
};

export default function GoldenAuraPage() {
  const [activeTab, setActiveTab] = useState<CategoryTab>(() => {
    if (typeof window === 'undefined') return 'high_demand';
    return (localStorage.getItem(`scrappy_tab_${window.location.pathname}`) as CategoryTab) || 'high_demand';
  });
  useEffect(() => { localStorage.setItem(`scrappy_tab_${window.location.pathname}`, activeTab); }, [activeTab]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const { logActivity } = useActivityLogger();

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    asin: true,
    product_name: true,
    sku: true,
    brand: true,
    funnel: true,
    monthly_unit: true,
    product_link: true,
    amz_link: true,
    reason: true,
    remark: true,
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [isMoveToDropdownOpen, setIsMoveToDropdownOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const rowsPerPage = 100;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ✅ 2. UPDATE: Initialize widths with DEFAULT_WIDTHS
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('golden_aura_column_widths');
      if (saved) {
        return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
      }
    }
    return DEFAULT_WIDTHS;
  });

  // ✅ 3. ADD: Resize Logic Ref
  const resizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  // Column order state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('goldenaura_column_order');
      if (saved) {
        const parsedOrder = JSON.parse(saved);
        // ✅ Add remark if it's missing from saved order
        if (!parsedOrder.includes('remark')) {
          parsedOrder.push('remark');
        }
        if (!parsedOrder.includes('sku')) {
          parsedOrder.splice(parsedOrder.indexOf('product_name') + 1, 0, 'sku');
        }
        return parsedOrder;
      }
      return Object.keys(DEFAULT_WIDTHS);
    }
    return Object.keys(DEFAULT_WIDTHS);
  });

  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // Roll back state
  const [movementHistory, setMovementHistory] = useState<{
    [key: string]: {
      product: ProductRow;
      fromTable: string;
      toTable: string;
    } | null;
  }>({});

  // Reject Modal State
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    product: ProductRow | null;
  }>({
    isOpen: false,
    product: null,
  });
  // ✅ ADD THIS - Remark Modal State
  const [selectedRemark, setSelectedRemark] = useState<string | null>(null);
  const [editingRemarkText, setEditingRemarkText] = useState('');
  const [editingRemarkProductId, setEditingRemarkProductId] = useState<string | null>(null);
  const [blockedAsins, setBlockedAsins] = useState<Map<string, PipelineResult>>(new Map());


  const SELLER_ID = 1;

  const SELLER_CODE_MAP: Record<number, string> = {
    1: 'GR',
    2: 'RR',
    3: 'UB',
    4: 'VV',
    5: "DE",
    6: "CV",
    7: "MV",
    8: "KL",
  };

  // ✅ 4. ADD: Resize Handlers
  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { key, startX: e.pageX, startWidth: columnWidths[key] || 100 };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizeRef.current) return;
    const { key, startX, startWidth } = resizeRef.current;
    const newWidth = Math.max(80, startWidth + (e.pageX - startX));
    setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
  };

  const handleMouseUp = () => {
    if (resizeRef.current) localStorage.setItem('golden_aura_column_widths', JSON.stringify(columnWidths));
    resizeRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const sanitizeSearchTerm = (term: string): string => {
    return term.replace(/'/g, "''").trim();
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Ctrl+Z keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        e.key === 'z' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        handleRollBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movementHistory, activeTab]);

  // Fetch products
  useEffect(() => {
    fetchProducts(false);
  }, [activeTab, currentPage, debouncedSearch]);

  useEffect(() => {
    const currentTable = `india_seller_${SELLER_ID}_${activeTab}`;

    const channel = supabase
      .channel(`sync-${currentTable}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: currentTable },
        (payload) => {
          setProducts(prev => prev.filter(p => p.id !== payload.old.id));
          setTotalCount(prev => Math.max(0, prev - 1));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: currentTable },
        () => {
          fetchProducts(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const fetchProducts = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const tableName = `india_seller_${SELLER_ID}_${activeTab}`;
      const start = (currentPage - 1) * rowsPerPage;
      const end = start + rowsPerPage - 1;

      let query = supabase.from(tableName).select('*', { count: 'exact' });

      if (debouncedSearch.trim()) {
        // ✅ Limit search to 100 characters to prevent 400 errors
        const searchTerm = sanitizeSearchTerm(debouncedSearch).substring(0, 100);

        // Show warning if search was truncated
        if (debouncedSearch.length > 100) {
          setToast({
            message: 'Search query too long - truncated to 100 characters',
            type: 'warning',
          });
        }

        query = query.or(
          `asin.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,funnel.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query
        .range(start, end)
        .order('id', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        setToast({
          message: 'Search failed. Try using simpler keywords.',
          type: 'error',
        });
        setProducts([]);
        setTotalCount(0);
        return;
      }

      setProducts(data || []);
      setTotalCount(count || 0);
        if (data && data.length > 0) {
          const asins = data.map((p: any) => p.asin);
          const pipelineMap = await batchCheckPipeline(asins);
          setBlockedAsins(pipelineMap);
        }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      setToast({
        message: error?.message || 'Error loading products',
        type: 'error',
      });
      setProducts([]);
      setTotalCount(0);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // ✅ NEW FUNCTION - Fetch last movement from database
  const fetchLastMovementHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('india_seller_1_golden_aura_movement_history')
        .select('*')
        .eq('from_table', `india_seller_${SELLER_ID}_${activeTab}`)
        .order('moved_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching movement history:', error);
        return;
      }

      if (data) {
        // Populate movementHistory state with the last movement
        const product: ProductRow = {
          id: '', // Not needed for rollback
          asin: data.asin,
          product_name: data.product_name,
          brand: data.brand,
          funnel: data.funnel,
          monthly_unit: data.monthly_unit,
          product_link: data.product_link,
          amz_link: data.amz_link,
          remark: data.remark,
        };

        setMovementHistory((prev) => ({
          ...prev,
          [`india_seller_${SELLER_ID}_${activeTab}`]: {
            product,
            fromTable: data.from_table,
            toTable: data.to_table,
          },
        }));
      } else {
        // No history found - clear undo for this tab
        setMovementHistory((prev) => ({
          ...prev,
          [`india_seller_${SELLER_ID}_${activeTab}`]: null,
        }));
      }
    } catch (error) {
      console.error('Exception fetching movement history:', error);
    }
  };

  const saveToHistory = async (product: ProductRow, fromTable: string, toTable: string) => {
    try {
      const { error } = await supabase
        .from(`india_seller_1_golden_aura_movement_history`)
        .insert({
          asin: product.asin,
          product_name: product.product_name,
          brand: product.brand,
          funnel: product.funnel,
          monthly_unit: product.monthly_unit,
          product_link: product.product_link,
          amz_link: product.amz_link,
          remark: product.remark,
          sku: product.sku,
          from_table: fromTable,
          to_table: toTable,
        });

      if (error) throw error;

      setMovementHistory((prev) => ({
        ...prev,
        [fromTable]: { product, fromTable, toTable },
      }));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const moveProduct = async (
    product: ProductRow,
    action: 'approved' | 'not_approved' | 'reject',
    reason?: string
  ) => {
    setProcessingId(product.id);
    setProducts(prev => prev.filter(p => p.id !== product.id));
    try {
      let targetTable: string;
      let dataToInsert: any;
      const { id, working, reason: oldReason, ...productData } = product;
      const currentTable = `india_seller_${SELLER_ID}_${activeTab}`;

      if (action === 'approved') {
        const pipelineInfo = blockedAsins.get(product.asin);
        if (pipelineInfo && pipelineInfo.location && pipelineInfo.location !== 'validation') {
          if (!pipelineInfo.can_merge) {
            setProducts(prev => [...prev, product]);
            setToast({ message: `ASIN ${product.asin} is in ${pipelineInfo.stage_label} (${pipelineInfo.seller_tags}). Cannot approve until current journey completes.`, type: 'error' });
            setProcessingId(null);
            return;
          }
        }
        targetTable = `india_validation_main_file`;
        const SELLER_CODE = SELLER_CODE_MAP[SELLER_ID];

        // Atomic upsert — handles race conditions when multiple sellers approve same ASIN
        const { error: rpcError } = await supabase.rpc('approve_to_validation', {
          p_asin: product.asin,
          p_product_name: product.product_name || null,
          p_brand: product.brand || null,
          p_seller_code: SELLER_CODE,
          p_funnel: product.funnel || null,
          p_india_link: product.product_link || null,
          p_amz_link: product.amz_link || null,
          p_remark: product.remark || null,
          p_sku: product.sku || null,
        });

        if (rpcError) {
          throw new Error(`Failed to insert into validation: ${rpcError.message}`);
        }

        // Verify the row exists before deleting from brand checking
        const { data: verifyRow } = await supabase
          .from('india_validation_main_file')
          .select('id')
          .eq('asin', product.asin)
          .maybeSingle();

        if (!verifyRow) {
          throw new Error(`Validation insert verification failed for ${product.asin}`);
        }

        // Only delete from brand checking AFTER confirmed success
        await Promise.all([
          saveToHistory(product, currentTable, targetTable),
          supabase.from(currentTable).delete().eq('asin', product.asin),
        ]);
        setToast({ message: `Product moved to Validation Main File!`, type: 'success' });
        await supabase.from(`india_brand_checking_seller_${SELLER_ID}`).update({ approval_status: 'approved' }).eq('asin', product.asin);
        logActivity({
          action: 'approve',
          marketplace: 'india',
          page: 'brand-checking',
          table_name: currentTable,
          asin: product.asin,
          details: { funnel: product.funnel, seller_id: SELLER_ID, seller_name: 'golden-aura', target: 'india_validation_main_file' }
        });

      } else if (action === 'not_approved') {
        targetTable = `india_seller_${SELLER_ID}_not_approved`;
        dataToInsert = productData;

        const { error: insertError } = await supabase.from(targetTable).insert(dataToInsert);
        if (insertError) throw insertError;

        await Promise.all([
          saveToHistory(product, currentTable, targetTable),
          supabase.from(currentTable).delete().eq('asin', product.asin),
        ]);
        setToast({ message: `Product moved to Not Approved!`, type: 'success' });
        await supabase.from(`india_brand_checking_seller_${SELLER_ID}`).update({ approval_status: 'not_approved' }).eq('asin', product.asin);
        logActivity({
          action: 'not_approve',
          marketplace: 'india',
          page: 'brand-checking',
          table_name: currentTable,
          asin: product.asin,
          details: { funnel: product.funnel, seller_id: SELLER_ID, seller_name: 'golden-aura', target: targetTable }
        });

      } else if (action === 'reject') {
        targetTable = `india_seller_${SELLER_ID}_reject`;
        dataToInsert = { ...productData, reason: reason || 'No reason provided' };

        const { error: insertError } = await supabase.from(targetTable).insert(dataToInsert);
        if (insertError) throw insertError;

        await Promise.all([
          saveToHistory(product, currentTable, targetTable),
          supabase.from(currentTable).delete().eq('asin', product.asin),
        ]);
        setToast({ message: `Product rejected!`, type: 'success' });
        await supabase.from(`india_brand_checking_seller_${SELLER_ID}`).update({ approval_status: 'not_approved' }).eq('asin', product.asin);
        logActivity({
          action: 'reject',
          marketplace: 'india',
          page: 'brand-checking',
          table_name: currentTable,
          asin: product.asin,
          details: { funnel: product.funnel, seller_id: SELLER_ID, seller_name: 'golden-aura', reason: reason, target: targetTable }
        });
      }
    } catch (err: any) {
      setProducts(prev => [...prev, product]);
      console.error('Move product error:', err);
      setToast({ message: `Error: ${err.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRollBack = async () => {
    const currentTable = `india_seller_${SELLER_ID}_${activeTab}`;
    const lastMovement = movementHistory[currentTable];

    if (!lastMovement) {
      setToast({ message: 'No recent movement to roll back from this tab', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { product, fromTable, toTable } = lastMovement;

      // ✅ NEW: Check if product already exists in destination table
      const { data: existingProduct, error: checkError } = await supabase
        .from(fromTable)
        .select('asin')
        .eq('asin', product.asin)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingProduct) {
        // Product already exists - clear history and show message
        setToast({
          message: `Cannot undo: Product "${product.product_name}" already exists in the destination table`,
          type: 'warning',
        });

        // Clear movement history since it's no longer valid
        setMovementHistory((prev) => ({ ...prev, [currentTable]: null }));

        // Delete the invalid history entry from database
        await supabase
          .from(`india_seller_${SELLER_ID}_golden_aura_movement_history`) // Change table name per seller
          .delete()
          .eq('asin', product.asin)
          .eq('from_table', fromTable)
          .eq('to_table', toTable)
          .order('moved_at', { ascending: false })
          .limit(1);

        setLoading(false);
        return;
      }

      // Product doesn't exist - proceed with rollback
      const { error: insertError } = await supabase.from(fromTable).insert({
        asin: product.asin,
        product_name: product.product_name,
        brand: product.brand,
        funnel: product.funnel,
        monthly_unit: product.monthly_unit,
        product_link: product.product_link,
        amz_link: product.amz_link,
        remark: product.remark,
        sku: product.sku,
      });

      if (insertError) throw insertError;

      // If rolling back from validation, only remove this seller's tag (don't delete other sellers' data)
      if (toTable === 'india_validation_main_file') {
        const SELLER_CODE = SELLER_CODE_MAP[SELLER_ID];
        const { data: valRow } = await supabase
          .from('india_validation_main_file')
          .select('id, seller_tag')
          .eq('asin', product.asin)
          .maybeSingle();

        if (valRow) {
          const tags = valRow.seller_tag?.split(',').map((t: string) => t.trim()).filter((t: string) => t !== SELLER_CODE) || [];
          if (tags.length === 0) {
            const { error: deleteError } = await supabase.from(toTable).delete().eq('id', valRow.id);
            if (deleteError) throw deleteError;
          } else {
            const { error: updateError } = await supabase
              .from('india_validation_main_file')
              .update({
                seller_tag: tags.join(','),
                no_of_seller: tags.length
              })
              .eq('id', valRow.id);
            if (updateError) throw updateError;
          }
        }
      } else {
        const { error: deleteError } = await supabase.from(toTable).delete().eq('asin', product.asin);
        if (deleteError) throw deleteError;
      }

      await supabase
        .from(`india_seller_${SELLER_ID}_golden_aura_movement_history`) // Change table name per seller
        .delete()
        .eq('asin', product.asin)
        .eq('from_table', fromTable)
        .eq('to_table', toTable)
        .order('moved_at', { ascending: false })
        .limit(1);

      setToast({ message: `Rolled back: ${product.product_name}`, type: 'success' });
      await supabase.from(`india_brand_checking_seller_${SELLER_ID}`).update({ approval_status: 'pending' }).eq('asin', product.asin);
      logActivity({
        action: 'rollback',
        marketplace: 'india',
        page: 'brand-checking',
        table_name: fromTable,
        asin: product.asin,
        details: { from: toTable, to: fromTable, seller_id: SELLER_ID, seller_name: 'golden-aura' }
      });
      setMovementHistory((prev) => ({ ...prev, [currentTable]: null }));
      fetchProducts(true);
    } catch (error: any) {
      console.error('Error rolling back:', error);
      setToast({
        message: error?.message || 'Rollback failed',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };


  // ✅ NEW FUNCTION: Move products from Reject to other tabs
  const handleMoveFromReject = async (targetTab: 'high_demand' | 'dropshipping' | 'not_approved') => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Please select products to move', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const selectedProducts = products.filter((p) => selectedIds.has(p.id));
      const targetTable = `india_seller_${SELLER_ID}_${targetTab}`;
      const rejectTable = `india_seller_${SELLER_ID}_reject`;

      let movedCount = 0;
      let skippedCount = 0;
      const skippedAsins: string[] = [];

      for (const product of selectedProducts) {
        // Check if ASIN already exists in target table
        const { data: existing, error: checkError } = await supabase
          .from(targetTable)
          .select('asin')
          .eq('asin', product.asin)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking existing product:', checkError);
          continue;
        }

        if (existing) {
          // Skip if already exists
          skippedCount++;
          skippedAsins.push(product.asin);
          continue;
        }

        // Prepare data (remove reject-specific fields)
        const { id, reason, working, ...productData } = product;

        // Insert into target table
        const { error: insertError } = await supabase
          .from(targetTable)
          .insert(productData);

        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }

        // Delete from reject table
        const { error: deleteError } = await supabase
          .from(rejectTable)
          .delete()
          .eq('asin', product.asin);

        if (deleteError) {
          console.error('Delete error:', deleteError);
          continue;
        }

        movedCount++;
        logActivity({
          action: 'move',
          marketplace: 'india',
          page: 'brand-checking',
          table_name: `india_seller_${SELLER_ID}_reject`,
          asin: product.asin,
          details: { from: 'reject', to: targetTab, seller_id: SELLER_ID, seller_name: 'golden-aura' }
        });
      }

      // Show result
      // Show result
      if (movedCount > 0) {
        setToast({
          message: `Successfully moved ${movedCount} product(s) to ${targetTab.replace('_', ' ')}`,
          type: 'success',
        });
      }

      if (skippedCount > 0) {
        setToast({
          message: `Skipped ${skippedCount} product(s) - already exists in target table. ASINs: ${skippedAsins.slice(0, 3).join(', ')}${skippedAsins.length > 3 ? '...' : ''}`,
          type: 'warning',
        });
      }

      // ✅ NEW: Clear movement history for target table since products moved back
      // This prevents undo conflicts when products return to their original table
      const targetTableKey = `india_seller_${SELLER_ID}_${targetTab}`;
      if (movementHistory[targetTableKey]) {
        setMovementHistory((prev) => ({
          ...prev,
          [targetTableKey]: null,
        }));
      }

      // Clear selection and refresh
      setSelectedIds(new Set());
      setIsMoveToDropdownOpen(false);
      await fetchProducts(true);


    } catch (error: any) {
      console.error('Move from reject error:', error);
      setToast({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };


  const PaginationControls = () => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    return (
      <div className="sticky bottom-0 z-40 bg-[#111111] border-t border-white/[0.1] p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="text-xs sm:text-sm text-gray-300">
            Showing <span className="text-gray-100 font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{' '}
            <span className="text-gray-100 font-medium">{Math.min(currentPage * rowsPerPage, totalCount)}</span> of{' '}
            <span className="text-white font-bold">{totalCount}</span> products
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg font-mono flex items-center">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#1a1a1a] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleDragStart = (columnName: string) => setDraggedColumn(columnName);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetColumn: string) => {
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null); return;
    }
    const newOrder = [...columnOrder];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    const targetIndex = newOrder.indexOf(targetColumn);
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedColumn);
    setColumnOrder(newOrder);
    localStorage.setItem('golden_aura_column_order', JSON.stringify(newOrder));
    setDraggedColumn(null);
  };

  const handleRemarkSave = async (productId: string, newRemark: string | null) => {
    try {
      const currentTable = `india_seller_${SELLER_ID}_${activeTab}`;
      const { error } = await supabase.from(currentTable).update({ remark: newRemark }).eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, remark: newRemark } : p));
    } catch (err: any) { console.error('Failed to update remark:', err); }
  };

  const handleRejectConfirm = (reason: string) => {
    if (rejectModal.product) moveProduct(rejectModal.product, 'reject', reason);
    setRejectModal({ isOpen: false, product: null });
  };

  const handleSelectAll = (checked: boolean) => {
    checked ? setSelectedIds(new Set(products.map((p) => p.id))) : setSelectedIds(new Set());
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    checked ? newSelected.add(id) : newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  // ✅ 5. UPDATE: Enhanced Column Header (Center align + Resize)
  const renderColumnHeader = (columnKey: string, displayName: string) => {
    if (!visibleColumns[columnKey as keyof typeof visibleColumns]) return null;
    return (
      <th
        key={columnKey}
        draggable
        onDragStart={() => handleDragStart(columnKey)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(columnKey)}
        // Added 'relative' and 'text-center'
        className="relative px-4 py-4 text-center text-xs font-bold uppercase tracking-wider bg-[#111111] text-gray-400 border-r border-white/[0.1] cursor-move hover:bg-[#111111] transition-colors select-none group"
        style={{ width: columnWidths[columnKey], minWidth: 60, maxWidth: columnWidths[columnKey] }}
      >
        <div className="flex items-center justify-center gap-2">
          {displayName}
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={(e) => startResize(columnKey, e)}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-white/[0.08] z-10"
          onClick={(e) => e.stopPropagation()}
        />
      </th>
    );
  };

  const currentTable = `india_seller_${SELLER_ID}_${activeTab}`;
  const hasRollback = !!movementHistory[currentTable];

  // Tab Styles
  const tabStyles = (tabName: CategoryTab, colorClass: string, label: string) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-300 relative overflow-hidden group ${activeTab === tabName
        ? `bg-orange-500 text-white font-semibold shadow-sm`
        : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a]'
        }`}
    >
      <span className="relative z-10 flex items-center gap-2">
        {label}
      </span>
      {false && (
        <div className={`absolute inset-0 opacity-10 ${colorClass.replace('text-', 'bg-')}`} />
      )}
    </button>
  );
  // ------------------------------------------------------------------
  // ✅ FIX: 2. Main Dashboard Return (Outside the loading check)
  // ------------------------------------------------------------------
  return (
    <>
      <div className="min-h-screen bg-[#111111] text-gray-100 font-sans selection:bg-orange-500/20">

        {/* HEADER */}
        <div className="sticky top-0 z-50 bg-[#1a1a1a] border-b border-white/[0.1] pb-4 pt-4 sm:pt-6 px-4 sm:px-6 lg:px-6">
          <div className="max-w-[1920px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <LayoutList className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Golden Aura Listing</h1>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 pl-[3.25rem]">
                  Review and process listing errors and approvals
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-gray-300 bg-[#111111] px-3 py-1.5 rounded-lg border border-white/[0.1]">
                <span>TOTAL: <span className="text-white font-bold">{totalCount}</span></span>
                <span className="w-px h-3 bg-[#1a1a1a] mx-2" />
                <span>SELECTED: <span className="text-orange-500 font-bold">{selectedIds.size}</span></span>
              </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-4 sm:mb-6 p-1 bg-[#1a1a1a] rounded-2xl border border-white/[0.1] shadow-lg shadow-black/20 w-full sm:w-fit overflow-x-auto scrollbar-none">
              {tabStyles('high_demand', 'text-emerald-400', 'Restock')}
              {tabStyles('dropshipping', 'text-amber-400', 'Dropshipping')}
              {tabStyles('not_approved', 'text-rose-400', 'Not Approved')}
              {tabStyles('reject', 'text-gray-400', 'Reject')}
              {(activeTab === 'high_demand' || activeTab === 'dropshipping') && (
                <BotControlPanel
                  products={products}
                  moveProduct={moveProduct}
                  sellerName="Golden Aura"
                />
              )}
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 bg-[#1a1a1a] p-3 rounded-xl border border-white/[0.1] mb-2">
              <div className="flex gap-3 w-full md:w-auto">
                <div className="relative">
                  <button
                    onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#111111] text-gray-500 rounded-lg hover:bg-[#1a1a1a] border border-white/[0.1] flex items-center gap-2 text-xs sm:text-sm font-medium transition-colors"
                  >
                    <Columns className="w-4 h-4" /> Columns
                  </button>
                  {isColumnDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsColumnDropdownOpen(false)} />
                      <div className="absolute top-full left-0 mt-2 bg-[#111111] border border-white/[0.1] rounded-xl shadow-xl p-3 z-20 w-56 animate-in fade-in zoom-in-95 duration-200">
                        {Object.keys(visibleColumns).map((col) => (
                          <label key={col} className="flex items-center gap-3 p-2 hover:bg-white/[0.05]/10 rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={visibleColumns[col as keyof typeof visibleColumns]}
                              onChange={() => toggleColumn(col as keyof typeof visibleColumns)}
                              className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50"
                            />
                            <span className="text-sm text-gray-300 capitalize">{col.replace('_', ' ')}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 items-center w-full md:w-auto">
                <div className="relative w-full md:w-72 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search by ASIN, Name, Brand, SKU..."
                    value={searchQuery}
                    onChange={(e) => {                              // ← CHANGED THIS
                      const value = e.target.value;                 // ← Get the typed text
                      if (value.length > 100) {                     // ← Check if too long
                        setToast({                                  // ← Show warning toast
                          message: 'Search query too long. Please use shorter keywords.',
                          type: 'warning',
                        });
                        return;                                     // ← Stop here, don't update search
                      }
                      setSearchQuery(value);                        // ← Update search if OK
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#111111]..."
                  />

                </div>

                {/* ✅ NEW: Move To Button (only on Reject tab) */}
                {activeTab === 'reject' && (
                  <div className="relative">
                    <button
                      onClick={() => setIsMoveToDropdownOpen(!isMoveToDropdownOpen)}
                      disabled={selectedIds.size === 0}
                      className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium transition-all ${selectedIds.size > 0
                        ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-900/20'
                        : 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                        }`}
                    >
                      <ArrowUpDown className="w-4 h-4" /> Move To
                    </button>

                    {/* Dropdown Menu */}
                    {isMoveToDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsMoveToDropdownOpen(false)} />
                        <div className="absolute top-full right-0 mt-2 bg-[#111111] border border-white/[0.1] rounded-xl shadow-xl p-2 z-20 w-48 animate-in fade-in zoom-in-95 duration-200">
                          <button onClick={() => handleMoveFromReject('high_demand')} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-lg transition-colors flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                            Restock
                          </button>
                          <button
                            onClick={() => handleMoveFromReject('dropshipping')}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                            Dropshipping
                          </button>
                          <button
                            onClick={() => handleMoveFromReject('not_approved')}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors flex items-center gap-2"
                          >
                            <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                            Not Approved
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={handleRollBack}
                  disabled={!hasRollback}
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg flex items-center gap-2 text-xs sm:text-sm font-medium transition-all ${hasRollback
                    ? 'bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/10'
                    : 'bg-[#111111] text-gray-500 cursor-not-allowed border border-white/[0.1]'
                    }`}
                >
                  <RotateCcw className="w-4 h-4" /> Undo
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-6 pb-4 sm:pb-6">
          <div className="bg-[#111111] rounded-2xl border border-white/[0.1] overflow-hidden shadow-xl shadow-black/20">
            {loading ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-4">
                <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
                <span className="text-sm font-medium tracking-wide animate-pulse">LOADING DATA...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-3">
                <Filter className="w-12 h-12 text-gray-500" />
                <p className="text-lg font-medium text-gray-400">No items found in {activeTab.replace('_', ' ')}</p>
                <p className="text-sm text-gray-300">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="relative h-[calc(100vh-380px)] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <table className="w-full border-collapse text-left" ref={tableRef}>
                  <thead className="sticky top-0 z-30 bg-[#111111] border-b border-white/[0.1] shadow-md">
                    <tr>
                      <th className="p-4 bg-[#111111] border-r border-white/[0.1] text-center sticky left-0 z-20" style={{ width: '60px' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === products.length && products.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                        />
                      </th>
                      {columnOrder.map((col) => {
                        const columnNames: Record<string, string> = {
                          asin: 'ASIN', product_name: 'Product Name', sku: 'SKU', brand: 'Brand', funnel: 'Funnel',
                          monthly_unit: 'Monthly Unit', product_link: 'Product Link', amz_link: 'AMZ Link', reason: 'Reason', remark: 'Remark',
                        };
                        if (col === 'reason' && activeTab !== 'reject') return null;

                        return renderColumnHeader(col, columnNames[col]);
                      })}
                      {activeTab !== 'reject' && (
                        <th className="p-4 text-center font-bold text-xs uppercase tracking-wider text-gray-400 bg-[#111111]" style={{ width: '220px' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {products.map((product, index) => {
                    const pipelineInfo = blockedAsins.get(product.asin);
                    const isBlockedInPipeline = pipelineInfo && pipelineInfo.location && pipelineInfo.location !== 'validation' && !pipelineInfo.can_merge;
                    const isInPipeline = pipelineInfo && pipelineInfo.location && pipelineInfo.location !== 'validation';
                    return (
                      <tr key={product.id} className={`group transition-colors ${isBlockedInPipeline ? 'bg-orange-900/20 hover:bg-orange-900/30' : isInPipeline ? 'bg-amber-900/10 hover:bg-amber-900/20' : 'hover:bg-white/[0.05]'} ${selectedIds.has(product.id) ? 'bg-orange-500/10' : ''}`}>
                        <td className="p-3 text-center bg-[#1a1a1a] sticky left-0 z-10 border-r border-white/[0.1] group-hover:bg-white/[0.05] transition-colors" style={{ width: '60px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(product.id)}
                            onChange={(e) => handleSelectRow(product.id, e.target.checked)}
                            className="rounded border-white/[0.1] bg-[#111111] text-orange-500 focus:ring-orange-500/50 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        {columnOrder.map((col) => {
                          if (col === 'reason' && activeTab !== 'reject') return null;
                          if (!visibleColumns[col as keyof typeof visibleColumns]) return null;

                          return (
                            <td
                              key={col}
                              className={`px-4 py-3 text-sm border-r border-white/[0.1] ${col === 'product_name' ? 'text-left' : 'text-center'
                                } ${col === 'product_link' || col === 'amz_link' ? '' : 'truncate'}`}
                              style={{ width: columnWidths[col], maxWidth: columnWidths[col] }}
                            >
                              {/* ✅ ADD DEBUG LOG */}
                              {col === 'product_link' || col === 'amz_link' ? (
                                <>
                                  {product[col as keyof ProductRow] ? (
                                    <a
                                      href={ensureAbsoluteUrl(String(product[col as keyof ProductRow]))}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-500 hover:bg-orange-400 hover:text-white transition-all text-xs font-medium border border-orange-500/20"
                                    >
                                      View Link
                                    </a>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </>
                              ) : col === 'funnel' ? (
                                <FunnelBadge funnel={product.funnel} />
                              ) : col === 'sku' ? (
                                <span className="font-mono text-gray-300 text-[10px]">
                                  {product.sku || '-'}
                                </span>
                              ) : col === 'remark' ? (
                                product.remark ? (
                                  <button
                                    onClick={() => { setSelectedRemark(product.remark || ' '); setEditingRemarkText(product.remark || ''); setEditingRemarkProductId(product.id); }}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    View
                                  </button>
                                ) : (
                                  <button onClick={() => { setSelectedRemark(' '); setEditingRemarkText(''); setEditingRemarkProductId(product.id); }} className="text-gray-500 hover:text-gray-500 text-xs cursor-pointer">+ Add</button>
                                )

                              ) : col === 'reason' ? (
                                <span className="text-rose-400" title={product.reason || 'No reason'}>
                                  {product.reason || 'No reason'}
                                </span>
                              ) : col === 'product_name' ? (
                                <span className="text-gray-100 font-medium" title={product.product_name || '-'}>
                                  {product.product_name}
                                </span>
                              ) : col === 'asin' ? (
                                <div>
                                  <span className="text-gray-400" title={String(product.asin || '-')}>
                                    {String(product.asin || '-')}
                                  </span>
                              {isBlockedInPipeline && (
                                <div className="text-[10px] text-orange-400 mt-0.5">{pipelineInfo!.stage_label} ({pipelineInfo!.seller_tags})</div>
                              )}
                              {isInPipeline && !isBlockedInPipeline && (
                                <div className="text-[10px] text-amber-400 mt-0.5">{pipelineInfo!.stage_label} ({pipelineInfo!.seller_tags})</div>
                              )}
                                </div>
                              ) : (
                                <span className="text-gray-400" title={String(product[col as keyof ProductRow] || '-')}>
                                  {String(product[col as keyof ProductRow] || '-')}
                                </span>
                              )}
                            </td>
                          );

                        })}
                        {activeTab !== 'reject' && (
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => moveProduct(product, 'approved')}
                                disabled={processingId === product.id}
                                className="px-3 py-1.5 bg-green-600 border border-green-700 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all text-xs font-bold"
                              >
                                {processingId === product.id ? '...' : 'Approve'}
                              </button>
                              {activeTab !== 'not_approved' && (
                                <button
                                  onClick={() => moveProduct(product, 'not_approved')}
                                  disabled={processingId === product.id}
                                  className="px-3 py-1.5 bg-amber-500 border border-amber-600 text-black rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-all text-xs font-bold"
                                >
                                  Not Appr.
                                </button>
                              )}
                              <button
                                onClick={() => setRejectModal({ isOpen: true, product })}
                                disabled={processingId === product.id}
                                className="px-3 py-1.5 bg-red-600 border border-red-700 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all text-xs font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && products.length > 0 && <PaginationControls />}
        </div>

        <RejectModal
          isOpen={rejectModal.isOpen}
          productName={rejectModal.product?.product_name || 'Unknown Product'}
          onClose={() => setRejectModal({ isOpen: false, product: null })}
          onConfirm={handleRejectConfirm}
        />

        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        {/* ✅ ADD THIS - Remark Modal */}
        {selectedRemark && (
          <div className="fixed inset-0 bg-[#111111] z-50 flex items-center justify-center p-4" onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}>
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 sm:p-6 pb-0">
                <h3 className="text-xl font-bold text-white">Remark Details</h3>
                <button
                  onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                  className="text-gray-400 hover:text-white text-2xl transition-colors p-2 hover:bg-[#111111] rounded-lg"
                >
                  ×
                </button>
              </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="bg-[#1a1a1a]/50 rounded-xl p-5 border border-white/[0.1]">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/[0.1]">
                      <div className="w-2 h-2 rounded-full bg-orange-400"></div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Validation Remark</span>
                    </div>
                    <textarea
                      value={editingRemarkText}
                      onChange={(e) => setEditingRemarkText(e.target.value)}
                      className="w-full bg-transparent text-gray-100 text-sm leading-relaxed resize-none focus:outline-none min-h-[100px] placeholder:text-gray-500"
                      placeholder="Enter remark..."
                      rows={4}
                    />
                    <div className="mt-4 pt-3 border-t border-white/[0.1] flex items-center justify-between text-xs text-gray-300">
                      <span>{editingRemarkText.length} characters</span>
                      <span>{editingRemarkText.split('\n').length} lines</span>
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-[#1a1a1a]/50 border-t border-white/[0.1] flex items-center justify-between">
                  <div className="text-xs text-gray-300">
                    Press <kbd className="px-2 py-1 bg-[#1a1a1a] rounded text-gray-500">Esc</kbd> to close
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (() => { try { navigator.clipboard?.writeText(editingRemarkText); } catch { const t = document.createElement('textarea'); t.value = editingRemarkText; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } })()}
                      className="px-4 py-2 bg-[#1a1a1a] hover:bg-gray-200 text-gray-100 rounded-lg font-medium transition-colors text-sm"
                    >
                      Copy
                    </button>
                    {editingRemarkText.trim() !== (selectedRemark || '').trim() && editingRemarkProductId && (
                      <button
                        onClick={async () => {
                          if (!editingRemarkProductId) return;
                          await handleRemarkSave(editingRemarkProductId, editingRemarkText.trim() || null);
                          setSelectedRemark(null);
                          setEditingRemarkText('');
                          setEditingRemarkProductId(null);
                        }}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm shadow-lg shadow-emerald-900/20"
                      >
                        Save
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedRemark(null); setEditingRemarkText(''); setEditingRemarkProductId(null); }}
                      className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
            </div>
          </div>
        )}
      </div>

    </>
  )
}
//app\dashboard\india-selling\brand-checking\golden-aura\page.tsx