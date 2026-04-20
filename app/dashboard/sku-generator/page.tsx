'use client';

import { useState, useMemo, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, Plus, Trash2, Search, X,
  Cog, Loader2, ChevronRight, ChevronDown, Pencil, RefreshCw,
  Inbox as InboxIcon, Package, Check,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';
import ConfirmDialog from '@/components/ConfirmDialog';

type Product = {
  id: string;
  asin: string;
  brand: string;
  name: string;
  multi_listing: string;
  barcode_1: string;
  barcode_2: string;
  barcodes: string[];
  pack_of: number;
  product_number: number | null;
  sku: string | null;
  group_id: number | null;
};

type Group = {
  id: number;
  name: string;
};

let cachedProducts: Product[] | null = null;
let cachedGroups: Group[] | null = null;

const PAGE_SIZE = 50;

export default function SkuGeneratorPage() {
  const { loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>(cachedProducts || []);
  const [groups, setGroups] = useState<Group[]>(cachedGroups || []);
  const [activeTab, setActiveTab] = useState<'inbox' | 'groups'>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [inboxPage, setInboxPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [addProductsToGroup, setAddProductsToGroup] = useState<number | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dataLoading, setDataLoading] = useState(!cachedProducts);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    asin: '', brand: '', name: '', pack_of: 1, product_number: 0, multi_listing: 'A',
  });
  const [formBarcodes, setFormBarcodes] = useState<string[]>(['']);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadProducts = useCallback(async (silent = false) => {
    if (!silent && !cachedProducts) setDataLoading(true);
    const { data, error } = await supabase
      .from('sku_catalog')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      if (!silent) showToast(`Load failed: ${error.message}`, 'error');
    } else if (data) {
      const mapped: Product[] = data.map((row: any) => {
        let parsedBarcodes: string[] = [];
        if (Array.isArray(row.barcodes)) {
          parsedBarcodes = row.barcodes.filter((b: any) => typeof b === 'string' && b.trim());
        } else if (typeof row.barcodes === 'string') {
          try {
            const arr = JSON.parse(row.barcodes);
            if (Array.isArray(arr)) parsedBarcodes = arr.filter((b: any) => typeof b === 'string' && b.trim());
          } catch { /* ignore */ }
        }
        if (parsedBarcodes.length === 0) parsedBarcodes = [row.barcode_1, row.barcode_2].filter(Boolean);
        return {
          id: row.id,
          asin: row.asin,
          brand: row.brand || '',
          name: row.product_name || '',
          multi_listing: row.multi_listing,
          barcode_1: row.barcode_1 || '',
          barcode_2: row.barcode_2 || '',
          barcodes: parsedBarcodes,
          pack_of: row.pack_of || 1,
          product_number: row.product_number,
          sku: row.sku,
          group_id: row.group_id ?? null,
        };
      });
      cachedProducts = mapped;
      setProducts(mapped);
    }
    if (!silent) setDataLoading(false);
  }, []);

  const loadGroups = useCallback(async () => {
    const { data, error } = await supabase
      .from('sku_groups')
      .select('id, name')
      .order('id', { ascending: true });
    if (!error && data) {
      const mapped = data.map((g: any) => ({ id: g.id, name: g.name }));
      cachedGroups = mapped;
      setGroups(mapped);
    }
  }, []);

  useEffect(() => {
    if (cachedProducts) {
      setProducts(cachedProducts);
      setDataLoading(false);
      loadProducts(true);
    } else {
      loadProducts();
    }
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (!dataLoading) cachedProducts = products; }, [products, dataLoading]);
  useEffect(() => { cachedGroups = groups; }, [groups]);
  useEffect(() => { setInboxPage(1); }, [searchQuery, activeTab]);

  const handleBarcodeChange = (index: number, value: string) => {
    setFormBarcodes(prev => prev.map((b, i) => i === index ? value : b));
    const trimmed = value.trim();
    if (!trimmed) return;
    const matchingProduct = products.find(p => p.barcodes.some(b => b.trim() === trimmed));
    if (matchingProduct) {
      setForm(prev => ({
        ...prev,
        brand: prev.brand || matchingProduct.brand,
        asin: prev.asin || matchingProduct.asin,
        name: prev.name || matchingProduct.name,
      }));
    }
  };

  const addBarcodeInput = () => setFormBarcodes(prev => [...prev, '']);
  const removeBarcodeInput = (index: number) =>
    setFormBarcodes(prev => prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index));

  const handleAddProduct = async () => {
    if (!form.asin.trim()) return showToast('ASIN is required', 'error');
    const cleanedBarcodes = formBarcodes.map(b => b.trim()).filter(Boolean);
    if (cleanedBarcodes.length === 0) return showToast('At least one barcode is required', 'error');

    setAdding(true);
    const { data: inserted, error } = await supabase
      .from('sku_catalog')
      .insert({
        asin: form.asin.trim(),
        brand: form.brand.trim() || null,
        product_name: form.name.trim() || null,
        multi_listing: form.multi_listing,
        barcode_1: cleanedBarcodes[0] || null,
        barcode_2: cleanedBarcodes[1] || null,
        barcodes: cleanedBarcodes,
        pack_of: form.pack_of > 1 ? form.pack_of : null,
        product_number: form.product_number || null,
        sku: null,
        group_id: null,
      })
      .select()
      .single();
    setAdding(false);

    if (error || !inserted) {
      showToast(`Error: ${error?.message || 'insert failed'}`, 'error');
      return;
    }

    setProducts(prev => [...prev, {
      id: inserted.id,
      asin: inserted.asin,
      brand: inserted.brand || '',
      name: inserted.product_name || '',
      multi_listing: inserted.multi_listing,
      barcode_1: inserted.barcode_1 || '',
      barcode_2: inserted.barcode_2 || '',
      barcodes: Array.isArray(inserted.barcodes) ? inserted.barcodes : cleanedBarcodes,
      pack_of: inserted.pack_of || 1,
      product_number: inserted.product_number,
      sku: inserted.sku,
      group_id: inserted.group_id ?? null,
    }]);
    setForm({ asin: '', brand: '', name: '', pack_of: 1, product_number: 0, multi_listing: 'A' });
    setFormBarcodes(['']);
    showToast(`Added ${inserted.asin}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('sku_catalog').delete().eq('id', id);
    if (error) {
      showToast(`Delete failed: ${error.message}`, 'error');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSyncMaster = async () => {
    setSyncing(true);
    try {
      const { data: masterRows, error: masterErr } = await supabase
        .from('india_master_sellers')
        .select('asin, brand, product_name, pack_of, upc, ean');
      if (masterErr) throw masterErr;
      if (!masterRows) {
        showToast('Master returned no data', 'error');
        setSyncing(false);
        return;
      }

      const { data: existingRows } = await supabase.from('sku_catalog').select('asin');
      const existingAsins = new Set((existingRows || []).map((r: any) => r.asin));

      const newAsins = masterRows.filter((r: any) =>
        r.asin && r.asin.trim() && r.asin.trim() !== '-' && r.asin.trim() !== 'Blank' && !existingAsins.has(r.asin.trim())
      );

      const uniqueNew = new Map<string, any>();
      for (const row of newAsins) {
        const asin = row.asin.trim();
        if (!uniqueNew.has(asin)) uniqueNew.set(asin, row);
      }

      if (uniqueNew.size === 0) {
        showToast('Already in sync — no new ASINs found');
        setSyncing(false);
        return;
      }

      const insertRows: any[] = [];
      for (const [asin, row] of uniqueNew) {
        const packOf = row.pack_of && row.pack_of > 1 ? row.pack_of : null;
        insertRows.push({
          asin,
          brand: row.brand || null,
          product_name: row.product_name || null,
          multi_listing: 'A',
          barcode_1: row.upc || null,
          barcode_2: row.ean || null,
          barcodes: [row.upc, row.ean].filter(Boolean),
          pack_of: packOf,
          group_id: null,
          sku: null,
        });
      }

      let failed = 0;
      for (let i = 0; i < insertRows.length; i += 500) {
        const batch = insertRows.slice(i, i + 500);
        const { error } = await supabase
          .from('sku_catalog')
          .upsert(batch, { onConflict: 'asin', ignoreDuplicates: true });
        if (error) {
          console.error('Sync batch error:', error);
          failed += batch.length;
        }
      }

      await loadProducts();
      if (failed > 0) {
        showToast(`Synced ${insertRows.length - failed}/${insertRows.length} (${failed} failed)`, 'error');
      } else {
        showToast(`Synced ${insertRows.length} new products from master`);
      }
    } catch (err: any) {
      showToast('Sync failed: ' + (err?.message || 'Unknown error'), 'error');
    }
    setSyncing(false);
  };

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = result.data.map((row) => {
          const asin = (row['ASIN'] || row['asin'] || '').trim();
          const brand = (row['Brand Name'] || row['brand'] || '').trim();
          const name = (row['Name'] || row['name'] || '').trim();
          const barcode1 = (row['Barcode 1'] || row['barcode_1'] || '').trim();
          const barcode2 = (row['Barcode 2'] || row['barcode_2'] || '').trim();
          const packOf = parseInt(row['Pack of'] || row['pack_of'] || '1', 10) || 1;
          const sku = (row['SKU'] || row['sku'] || '').trim() || null;
          const barcodes = [barcode1, barcode2].filter(Boolean);
          return { asin, brand, name, barcode1, barcode2, barcodes, packOf, sku };
        }).filter(p => p.asin && p.asin !== '-' && p.asin !== 'Blank');

        const insertRows = rows.map(p => ({
          asin: p.asin,
          brand: p.brand || null,
          product_name: p.name || null,
          multi_listing: 'A',
          barcode_1: p.barcode1 || null,
          barcode_2: p.barcode2 || null,
          barcodes: p.barcodes,
          pack_of: p.packOf > 1 ? p.packOf : null,
          sku: p.sku,
          group_id: null,
        }));

        let failed = 0;
        for (let i = 0; i < insertRows.length; i += 500) {
          const batch = insertRows.slice(i, i + 500);
          const { error } = await supabase
            .from('sku_catalog')
            .upsert(batch, { onConflict: 'asin', ignoreDuplicates: true });
          if (error) {
            console.error('Batch error:', error);
            failed += batch.length;
          }
        }

        await loadProducts();
        setUploading(false);
        if (failed > 0) {
          showToast(`Imported ${insertRows.length - failed}/${insertRows.length} (${failed} failed)`, 'error');
        } else {
          showToast(`Imported ${insertRows.length} products`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: () => { setUploading(false); showToast('CSV parse failed', 'error'); },
    });
  };

  const handleExportCsv = () => {
    const groupNameById = new Map(groups.map(g => [g.id, g.name]));
    const csv = Papa.unparse(products.map((p, i) => ({
      No: i + 1,
      ASIN: p.asin,
      'Brand Name': p.brand,
      Name: p.name,
      'Barcode 1': p.barcode_1,
      'Barcode 2': p.barcode_2,
      'Pack of': p.pack_of,
      SKU: p.sku || '',
      Group: p.group_id ? groupNameById.get(p.group_id) || '' : '',
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sku-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateGroup = async (
    name: string,
    items: { id: string; sku: string; barcodes: string[]; pack_of: number }[]
  ) => {
    if (!name.trim()) return showToast('Group name is required', 'error');
    if (items.length === 0) return showToast('No products selected', 'error');

    const { data: newGroup, error: groupErr } = await supabase
      .from('sku_groups')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (groupErr || !newGroup) {
      showToast(`Failed to create group: ${groupErr?.message || 'unknown'}`, 'error');
      return;
    }

    let failed = 0;
    for (const it of items) {
      const safePack = it.pack_of > 1 ? it.pack_of : null;
      const cleanBarcodes = it.barcodes.map(b => b.trim()).filter(Boolean);
      const { error } = await supabase
        .from('sku_catalog')
        .update({
          group_id: newGroup.id,
          sku: it.sku.trim() || null,
          barcode_1: cleanBarcodes[0] || null,
          barcode_2: cleanBarcodes[1] || null,
          barcodes: cleanBarcodes,
          pack_of: safePack,
        })
        .eq('id', it.id);
      if (error) failed++;
    }

    setGroups(prev => [...prev, { id: newGroup.id, name: newGroup.name }]);
    setProducts(prev => prev.map(p => {
      const it = items.find(x => x.id === p.id);
      if (!it) return p;
      const cleanBarcodes = it.barcodes.map(b => b.trim()).filter(Boolean);
      return {
        ...p,
        group_id: newGroup.id,
        sku: it.sku.trim() || null,
        barcode_1: cleanBarcodes[0] || '',
        barcode_2: cleanBarcodes[1] || '',
        barcodes: cleanBarcodes,
        pack_of: it.pack_of > 0 ? it.pack_of : 1,
      };
    }));
    setSelectedIds(new Set());
    setShowCreateGroup(false);
    setExpandedGroups(prev => new Set([...prev, newGroup.id]));

    if (failed > 0) {
      showToast(`Group created — ${failed} products failed to update`, 'error');
    } else {
      showToast(`Created group "${name}" with ${items.length} products`);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    const { error: updErr } = await supabase
      .from('sku_catalog')
      .update({ group_id: null })
      .eq('group_id', groupId);
    if (updErr) {
      showToast(`Failed to ungroup products: ${updErr.message}`, 'error');
      return;
    }

    const { error: delErr } = await supabase.from('sku_groups').delete().eq('id', groupId);
    if (delErr) {
      showToast(`Failed to delete group: ${delErr.message}`, 'error');
      return;
    }

    setGroups(prev => prev.filter(g => g.id !== groupId));
    setProducts(prev => prev.map(p => p.group_id === groupId ? { ...p, group_id: null } : p));
    setConfirmDeleteGroup(null);
    showToast('Group deleted');
  };

  const handleRemoveFromGroup = async (productId: string) => {
    const { error } = await supabase
      .from('sku_catalog')
      .update({ group_id: null })
      .eq('id', productId);
    if (error) return showToast(`Failed: ${error.message}`, 'error');
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, group_id: null } : p));
    showToast('Removed from group');
  };

  const handleUpdateGroupName = async (groupId: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const current = groups.find(g => g.id === groupId);
    if (!current || current.name === trimmed) return;
    const { error } = await supabase
      .from('sku_groups')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', groupId);
    if (error) return showToast(`Rename failed: ${error.message}`, 'error');
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: trimmed } : g));
  };

  const handleUpdateProduct = async (
    productId: string,
    patch: Partial<{ sku: string; barcode_1: string; pack_of: number }>
  ) => {
    const update: any = {};
    if (patch.sku !== undefined) update.sku = patch.sku.trim() || null;
    if (patch.barcode_1 !== undefined) update.barcode_1 = patch.barcode_1.trim() || null;
    if (patch.pack_of !== undefined) update.pack_of = patch.pack_of > 1 ? patch.pack_of : null;

    const { error } = await supabase.from('sku_catalog').update(update).eq('id', productId);
    if (error) return showToast(`Update failed: ${error.message}`, 'error');

    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      const next = { ...p };
      if (patch.sku !== undefined) next.sku = patch.sku.trim() || null;
      if (patch.barcode_1 !== undefined) {
        const trimmed = patch.barcode_1.trim();
        next.barcode_1 = trimmed;
        next.barcodes = trimmed
          ? [trimmed, ...p.barcodes.filter(b => b !== p.barcode_1)]
          : p.barcodes.filter(b => b !== p.barcode_1);
      }
      if (patch.pack_of !== undefined) next.pack_of = patch.pack_of > 0 ? patch.pack_of : 1;
      return next;
    }));
  };

  const handleAddProductsToGroup = async (groupId: number, productIds: string[]) => {
    if (productIds.length === 0) return;
    const { error } = await supabase
      .from('sku_catalog')
      .update({ group_id: groupId })
      .in('id', productIds);
    if (error) return showToast(`Failed to add: ${error.message}`, 'error');
    setProducts(prev => prev.map(p => productIds.includes(p.id) ? { ...p, group_id: groupId } : p));
    setAddProductsToGroup(null);
    showToast(`Added ${productIds.length} product${productIds.length > 1 ? 's' : ''} to group`);
  };

  const matchesSearch = useCallback((p: Product) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.asin.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      p.barcode_1.toLowerCase().includes(q) ||
      p.barcode_2.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const inboxProducts = useMemo(
    () => products.filter(p => p.group_id === null && matchesSearch(p)),
    [products, matchesSearch]
  );
  const inboxPaged = useMemo(
    () => inboxProducts.slice(0, inboxPage * PAGE_SIZE),
    [inboxProducts, inboxPage]
  );

  const groupedProducts = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const p of products) {
      if (p.group_id === null) continue;
      const arr = map.get(p.group_id) || [];
      arr.push(p);
      map.set(p.group_id, arr);
    }
    return map;
  }, [products]);

  const visibleGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(g => {
      if (g.name.toLowerCase().includes(q)) return true;
      const items = groupedProducts.get(g.id) || [];
      return items.some(matchesSearch);
    });
  }, [groups, groupedProducts, searchQuery, matchesSearch]);

  const stats = useMemo(() => ({
    total: products.length,
    inbox: products.filter(p => p.group_id === null).length,
    groups: groups.length,
    brands: new Set(products.map(p => p.brand).filter(Boolean)).size,
  }), [products, groups]);

  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.has(p.id)),
    [products, selectedIds]
  );
  const ungroupedForAdd = useMemo(
    () => products.filter(p => p.group_id === null),
    [products]
  );

  const allInboxSelected = inboxProducts.length > 0 && inboxProducts.every(p => selectedIds.has(p.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allInboxSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const p of inboxProducts) next.delete(p.id);
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        for (const p of inboxProducts) next.add(p.id);
        return next;
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#111111] text-gray-100">
      {/* Header */}
      <div className="flex-none px-4 sm:px-6 pt-4 sm:pt-6 pb-5 border-b border-white/[0.1]">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <Cog className="w-5 h-5 text-orange-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">SKU Generator</h1>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <StatPill label="Total" value={stats.total} color="text-white" />
          <StatPill label="Inbox" value={stats.inbox} color="text-cyan-300" />
          <StatPill label="Groups" value={stats.groups} color="text-orange-300" />
          <StatPill label="Brands" value={stats.brands} color="text-emerald-300" />
        </div>
      </div>

      {/* Add form */}
      <div className="flex-none px-4 sm:px-6 py-4 border-b border-white/[0.1] bg-[#0d0d0d]">
        <div className="flex items-end gap-2 p-4 bg-[#0a0a0a] rounded-xl border border-white/[0.05]">
          {formBarcodes.map((b, i) => (
            <div key={i} className="flex-1 min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {i === 0 ? `Barcode${formBarcodes.length > 1 ? ' 1' : ''} *` : `Barcode ${i + 1}`}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={b}
                  onChange={e => handleBarcodeChange(i, e.target.value)}
                  placeholder="Barcode"
                  className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white placeholder-slate-600 font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
                {formBarcodes.length > 1 && (
                  <button
                    onClick={() => removeBarcodeInput(i)}
                    className="p-1 text-gray-500 hover:text-rose-400 transition shrink-0"
                    title="Remove barcode"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            onClick={addBarcodeInput}
            className="mb-0.5 p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/30 border-dashed rounded-lg transition shrink-0"
            title="Add barcode"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">ASIN *</label>
            <input
              type="text"
              value={form.asin}
              onChange={e => setForm(p => ({ ...p, asin: e.target.value.toUpperCase() }))}
              placeholder="B0..."
              className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white placeholder-slate-600 font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
              placeholder="Brand"
              className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Product name"
              className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="w-24">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Pack Of</label>
            <input
              type="number"
              min={1}
              value={form.pack_of}
              onChange={e => setForm(p => ({ ...p, pack_of: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
              className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="w-24">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Product #</label>
            <input
              type="number"
              value={form.product_number || ''}
              onChange={e => setForm(p => ({ ...p, product_number: parseInt(e.target.value, 10) || 0 }))}
              placeholder="optional"
              className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white font-mono placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <button
            onClick={handleAddProduct}
            disabled={adding}
            className={`shrink-0 px-4 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border shadow-lg ${adding ? 'bg-orange-700 text-orange-200 border-orange-600 cursor-wait' : 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400/50 shadow-orange-900/20'}`}
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Tabs + Toolbar */}
      <div className="flex-none px-4 sm:px-6 pt-4 pb-4 flex flex-wrap items-center gap-3 border-b border-white/[0.1]">
        <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${activeTab === 'inbox' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
          >
            <InboxIcon className="w-3.5 h-3.5" /> Inbox <span className="text-[10px] opacity-80">({stats.inbox})</span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${activeTab === 'groups' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
          >
            <Package className="w-3.5 h-3.5" /> Groups <span className="text-[10px] opacity-80">({stats.groups})</span>
          </button>
        </div>

        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search ASIN, brand, SKU, barcode..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-[#1a1a1a] border border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-gray-100 placeholder-slate-600"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border shadow-lg ${uploading ? 'bg-cyan-800 text-cyan-200 border-cyan-700 cursor-wait' : 'bg-cyan-600 text-white hover:bg-cyan-500 border-cyan-500/50 shadow-cyan-900/20'}`}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>

        <button
          onClick={handleExportCsv}
          disabled={products.length === 0}
          className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border shadow-lg ${products.length === 0 ? 'bg-[#1a1a1a] text-gray-600 border-white/[0.05] cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500 border-purple-500/50 shadow-purple-900/20'}`}
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>

        <button
          onClick={handleSyncMaster}
          disabled={syncing}
          className={`px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border shadow-lg ${syncing ? 'bg-emerald-800 text-emerald-200 border-emerald-700 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-500/50 shadow-emerald-900/20'}`}
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} {syncing ? 'Syncing...' : 'Sync Master'}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 pb-24">
        {dataLoading || authLoading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            <p className="mt-4 text-gray-500 text-sm">Loading SKU catalog...</p>
          </div>
        ) : activeTab === 'inbox' ? (
          <InboxTable
            products={inboxPaged}
            totalCount={inboxProducts.length}
            selectedIds={selectedIds}
            allSelected={allInboxSelected}
            onToggleAll={toggleSelectAll}
            onToggleOne={toggleSelect}
            onDelete={handleDelete}
            onLoadMore={() => setInboxPage(p => p + 1)}
          />
        ) : (
          <GroupsView
            groups={visibleGroups}
            groupedProducts={groupedProducts}
            expandedGroups={expandedGroups}
            onToggleExpand={(id) => setExpandedGroups(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
            onRenameGroup={handleUpdateGroupName}
            onRequestDeleteGroup={(id) => setConfirmDeleteGroup(id)}
            onRemoveFromGroup={handleRemoveFromGroup}
            onUpdateProduct={handleUpdateProduct}
            onAddProducts={(id) => setAddProductsToGroup(id)}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {/* Floating selection bar */}
      {activeTab === 'inbox' && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 bg-[#1a1a1a] border border-orange-500/30 rounded-xl shadow-2xl">
          <span className="text-sm text-gray-200">{selectedIds.size} selected</span>
          <span className="text-gray-500">—</span>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
          >
            <Package className="w-3.5 h-3.5" /> Create Group
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-gray-500 hover:text-gray-200"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateGroup && (
        <CreateGroupModal
          products={selectedProducts}
          onClose={() => setShowCreateGroup(false)}
          onSave={handleCreateGroup}
          onUnselect={(id) => setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          })}
        />
      )}
      {addProductsToGroup !== null && (
        <AddProductsModal
          ungroupedProducts={ungroupedForAdd}
          onClose={() => setAddProductsToGroup(null)}
          onAdd={(ids) => handleAddProductsToGroup(addProductsToGroup, ids)}
        />
      )}
      {confirmDeleteGroup !== null && (
        <ConfirmDialog
          title="Delete group?"
          message="Products in this group will return to the Inbox."
          confirmText="Delete"
          onCancel={() => setConfirmDeleteGroup(null)}
          onConfirm={() => handleDeleteGroup(confirmDeleteGroup)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-500 text-white' : 'bg-rose-600/90 border-rose-500 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded-lg border border-white/[0.1]">
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function InboxTable({
  products, totalCount, selectedIds, allSelected,
  onToggleAll, onToggleOne, onDelete, onLoadMore,
}: {
  products: Product[];
  totalCount: number;
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}) {
  if (products.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 py-16">
        <InboxIcon className="w-12 h-12 opacity-30" />
        <p className="text-sm">Inbox is empty</p>
      </div>
    );
  }
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#111111] text-gray-500 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 accent-orange-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium">ASIN</th>
              <th className="px-3 py-2 text-left font-medium">Brand</th>
              <th className="px-3 py-2 text-left font-medium">Product Name</th>
              <th className="px-3 py-2 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => onToggleOne(p.id)}
                    className="w-4 h-4 accent-orange-500 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-gray-100">{p.asin}</td>
                <td className="px-3 py-2 text-gray-200">{p.brand || '—'}</td>
                <td className="px-3 py-2 text-gray-300 max-w-xl truncate" title={p.name}>{p.name || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => onDelete(p.id)}
                    className="text-gray-500 hover:text-rose-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length < totalCount && (
        <button
          onClick={onLoadMore}
          className="w-full py-3 text-sm text-gray-500 hover:text-orange-500 hover:bg-white/[0.02] border-t border-white/[0.05] transition"
        >
          Load more ({totalCount - products.length} remaining)
        </button>
      )}
    </div>
  );
}

function GroupsView({
  groups, groupedProducts, expandedGroups,
  onToggleExpand, onRenameGroup, onRequestDeleteGroup,
  onRemoveFromGroup, onUpdateProduct, onAddProducts, searchQuery,
}: {
  groups: Group[];
  groupedProducts: Map<number, Product[]>;
  expandedGroups: Set<number>;
  onToggleExpand: (id: number) => void;
  onRenameGroup: (id: number, name: string) => void;
  onRequestDeleteGroup: (id: number) => void;
  onRemoveFromGroup: (productId: string) => void;
  onUpdateProduct: (id: string, patch: Partial<{ sku: string; barcode_1: string; pack_of: number }>) => void;
  onAddProducts: (groupId: number) => void;
  searchQuery: string;
}) {
  if (groups.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3 py-16">
        <Package className="w-12 h-12 opacity-30" />
        <p className="text-sm">{searchQuery ? 'No groups match your search' : 'No groups yet — create one from the Inbox'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map(g => {
        const items = groupedProducts.get(g.id) || [];
        const isExpanded = expandedGroups.has(g.id);
        return (
          <div key={g.id} className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-2.5 bg-[#111111] border-b border-white/[0.1] flex items-center gap-3">
              <button
                onClick={() => onToggleExpand(g.id)}
                className="text-gray-400 hover:text-orange-400 transition shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <GroupNameEdit name={g.name} onSave={(n) => onRenameGroup(g.id, n)} />
              <span className="text-gray-500 text-xs ml-auto">{items.length} product{items.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => onRequestDeleteGroup(g.id)}
                className="text-gray-500 hover:text-rose-400 transition shrink-0"
                title="Delete group"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {isExpanded && (
              <>
                <GroupProductsTable
                  items={items}
                  onRemoveFromGroup={onRemoveFromGroup}
                  onUpdateProduct={onUpdateProduct}
                />
                <div className="px-4 py-2 bg-[#0d0d0d] border-t border-white/[0.05]">
                  <button
                    onClick={() => onAddProducts(g.id)}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Products
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupNameEdit({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => { setDraft(name); }, [name]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== name) onSave(draft.trim());
    else setDraft(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(name); }
        }}
        className="px-2 py-0.5 bg-[#1a1a1a] border border-orange-500 rounded text-sm text-white font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className="group/name flex items-center gap-1.5 text-orange-400 font-bold text-sm hover:text-orange-300 transition"
      title="Click to rename"
    >
      <span>{name}</span>
      <Pencil className="w-3 h-3 opacity-30 group-hover/name:opacity-80 transition-opacity" />
    </button>
  );
}

function GroupProductsTable({
  items, onRemoveFromGroup, onUpdateProduct,
}: {
  items: Product[];
  onRemoveFromGroup: (id: string) => void;
  onUpdateProduct: (id: string, patch: Partial<{ sku: string; barcode_1: string; pack_of: number }>) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#111111] text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            <th className="px-3 py-2 text-left font-medium">ASIN</th>
            <th className="px-3 py-2 text-left font-medium">Brand</th>
            <th className="px-3 py-2 text-left font-medium">Product Name</th>
            <th className="px-3 py-2 text-left font-medium">SKU</th>
            <th className="px-3 py-2 text-left font-medium">Barcode</th>
            <th className="px-3 py-2 text-center font-medium w-20">Pack</th>
            <th className="px-3 py-2 w-12 text-center"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
              <td className="px-3 py-2 font-mono text-gray-100">{p.asin}</td>
              <td className="px-3 py-2 text-gray-200">{p.brand || '—'}</td>
              <td className="px-3 py-2 text-gray-300 max-w-xs truncate" title={p.name}>{p.name || '—'}</td>
              <td className="px-3 py-2">
                <EditableText
                  value={p.sku || ''}
                  placeholder="—"
                  mono
                  accent
                  onSave={(v) => onUpdateProduct(p.id, { sku: v })}
                />
              </td>
              <td className="px-3 py-2">
                <EditableText
                  value={p.barcode_1}
                  placeholder="—"
                  mono
                  onSave={(v) => onUpdateProduct(p.id, { barcode_1: v })}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <EditableNumber
                  value={p.pack_of}
                  onSave={(n) => onUpdateProduct(p.id, { pack_of: n })}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  onClick={() => onRemoveFromGroup(p.id)}
                  className="text-gray-500 hover:text-rose-400 transition"
                  title="Remove from group"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableText({
  value, onSave, placeholder, mono, accent,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  accent?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(value); }
        }}
        className={`w-full px-2 py-1 text-xs bg-[#111111] border border-orange-500 rounded text-gray-100 ${mono ? 'font-mono' : ''} focus:outline-none focus:ring-1 focus:ring-orange-500`}
      />
    );
  }

  const display = value || placeholder || '—';
  const baseCls = accent
    ? 'font-mono text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded text-xs'
    : `text-xs ${mono ? 'font-mono' : ''} text-gray-200`;

  return (
    <button
      onClick={() => setEditing(true)}
      className={`group/cell inline-flex items-center gap-1.5 hover:bg-white/[0.05] rounded px-1 py-0.5 transition cursor-pointer max-w-full`}
      title="Click to edit"
    >
      <span className={baseCls}>{display}</span>
      <Pencil className="w-3 h-3 opacity-30 group-hover/cell:opacity-80 transition-opacity shrink-0" />
    </button>
  );
}

function EditableNumber({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    setEditing(false);
    const n = Math.max(1, parseInt(draft, 10) || 1);
    if (n !== value) onSave(n);
    setDraft(String(n));
  };

  if (editing) {
    return (
      <input
        type="number"
        min={1}
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setDraft(String(value)); }
        }}
        className="w-14 px-2 py-1 text-xs bg-[#111111] border border-orange-500 rounded text-gray-100 font-mono text-center focus:outline-none focus:ring-1 focus:ring-orange-500"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group/pack font-mono text-gray-300 hover:text-orange-400 hover:bg-white/[0.05] px-2 py-1 rounded transition inline-flex items-center gap-1.5 cursor-pointer"
      title="Click to edit"
    >
      <span>{value > 1 ? `×${value}` : '—'}</span>
      <Pencil className="w-3 h-3 opacity-30 group-hover/pack:opacity-80 transition-opacity" />
    </button>
  );
}

function CreateGroupModal({
  products, onClose, onSave, onUnselect,
}: {
  products: Product[];
  onClose: () => void;
  onSave: (name: string, items: { id: string; sku: string; barcodes: string[]; pack_of: number }[]) => Promise<void>;
  onUnselect: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState(() =>
    products.map(p => {
      const existing = (p.barcodes && p.barcodes.length > 0)
        ? p.barcodes
        : [p.barcode_1, p.barcode_2].filter(Boolean);
      return {
        id: p.id,
        asin: p.asin,
        product_name: p.name,
        sku: '',
        barcodes: existing.length > 0 ? [...existing] : [''],
        pack_of: p.pack_of || 1,
      };
    })
  );
  const [saving, setSaving] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    asin: string;
    product_name: string | null;
    barcode_1: string | null;
    barcode_2: string | null;
    barcodes: string[] | null;
    pack_of: number | null;
    sku: string | null;
  }>>([]);

  useEffect(() => {
    const q = addSearch.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const rowIds = new Set(rows.map(r => r.id));
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('sku_catalog')
        .select('id, asin, product_name, barcode_1, barcode_2, barcodes, pack_of, sku')
        .is('group_id', null)
        .or(`asin.ilike.%${q}%,product_name.ilike.%${q}%`)
        .limit(5);
      if (data) {
        setSearchResults(data.filter((r: any) => !rowIds.has(r.id)));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [addSearch, rows]);

  const removeProductFromModal = (id: string) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
    onUnselect(id);
  };

  const addProductToModal = (p: typeof searchResults[number]) => {
    if (rows.some(r => r.id === p.id)) return;
    const existing = Array.isArray(p.barcodes) && p.barcodes.length > 0
      ? p.barcodes
      : [p.barcode_1, p.barcode_2].filter(Boolean) as string[];
    setRows(prev => [...prev, {
      id: p.id,
      asin: p.asin,
      product_name: p.product_name || '',
      sku: '',
      barcodes: existing.length > 0 ? [...existing] : [''],
      pack_of: p.pack_of || 1,
    }]);
    setAddSearch('');
    setSearchResults([]);
  };

  const updateRow = (id: string, patch: Partial<{ sku: string; barcodes: string[]; pack_of: number }>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const updateBarcode = (id: string, idx: number, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = [...r.barcodes];
      updated[idx] = value;
      return { ...r, barcodes: updated };
    }));
  };

  const addBarcode = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, barcodes: [...r.barcodes, ''] } : r));
  };

  const removeBarcode = (id: string, idx: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = r.barcodes.filter((_, i) => i !== idx);
      return { ...r, barcodes: updated.length === 0 ? [''] : updated };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(name, rows.map(r => ({ id: r.id, sku: r.sku, barcodes: r.barcodes, pack_of: r.pack_of })));
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-[#111111] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/[0.1] flex items-center gap-3">
          <Package className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-white">Create Group</h2>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-white/[0.05]">
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Group Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Hair Care 2-Pack"
            autoFocus
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-white/[0.1] rounded-lg text-sm text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex-1 max-h-[85vh] overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead className="bg-[#0a0a0a] text-gray-500 text-[11px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium min-w-[120px]">ASIN</th>
                <th className="px-3 py-2 text-left font-medium min-w-[250px]">Product Name</th>
                <th className="px-3 py-2 text-left font-medium">SKU</th>
                <th className="px-3 py-2 text-left font-medium">Barcode</th>
                <th className="px-3 py-2 text-center font-medium w-24">Pack Of</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-white/[0.05]">
                  <td className="px-3 py-2 font-mono text-gray-400 bg-[#0a0a0a]/50 min-w-[120px]">{r.asin}</td>
                  <td className="px-3 py-2 text-gray-400 min-w-[250px] bg-[#0a0a0a]/50" title={r.product_name}>{r.product_name || '—'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={r.sku}
                      onChange={e => updateRow(r.id, { sku: e.target.value })}
                      placeholder="SKU"
                      className="w-full px-2 py-1 text-xs bg-[#0a0a0a] border border-orange-500/50 rounded text-orange-200 font-mono focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {r.barcodes.map((bc, bcIdx) => (
                        <div key={bcIdx} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={bc}
                            onChange={(e) => updateBarcode(r.id, bcIdx, e.target.value)}
                            placeholder="Barcode"
                            className="w-full bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:border-orange-500 outline-none"
                          />
                          {r.barcodes.length > 1 && (
                            <button
                              onClick={() => removeBarcode(r.id, bcIdx)}
                              className="text-red-400 hover:text-red-300 text-xs shrink-0"
                              title="Remove barcode"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addBarcode(r.id)}
                        className="text-orange-400 hover:text-orange-300 text-[10px] font-medium flex items-center gap-0.5 mt-0.5"
                      >
                        <Plus className="w-3 h-3" /> Add barcode
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      value={r.pack_of}
                      onChange={e => updateRow(r.id, { pack_of: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-16 px-2 py-1 text-xs bg-[#0a0a0a] border border-white/[0.1] rounded text-gray-100 font-mono text-center focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => removeProductFromModal(r.id)}
                      disabled={rows.length <= 1}
                      className="text-red-400 hover:text-red-300 disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Remove from group"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-white/5">
                <td colSpan={6} className="px-3 py-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={addSearch}
                      onChange={e => setAddSearch(e.target.value)}
                      placeholder="Search ASIN or product name to add..."
                      className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-gray-200 focus:border-orange-500 outline-none"
                    />
                    {addSearch.trim().length >= 2 && searchResults.length > 0 && (
                      <div className="mt-1 w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded shadow-lg overflow-hidden">
                        {searchResults.map(p => (
                          <button
                            key={p.id}
                            onClick={() => addProductToModal(p)}
                            className="w-full text-left px-3 py-2 hover:bg-orange-500/10 text-xs border-b border-white/5 last:border-0 transition"
                          >
                            <div className="font-mono text-gray-100">{p.asin}</div>
                            <div className="text-gray-400 truncate">{p.product_name || '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {addSearch.trim().length >= 2 && searchResults.length === 0 && (
                      <div className="mt-1 text-[11px] text-gray-500">No ungrouped products match.</div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.1] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/[0.1] rounded-lg hover:bg-white/[0.05] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border shadow-lg transition ${saving || !name.trim() ? 'bg-orange-700 text-orange-200 border-orange-600 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400/50 shadow-orange-900/20'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProductsModal({
  ungroupedProducts, onClose, onAdd,
}: {
  ungroupedProducts: Product[];
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return ungroupedProducts;
    const q = search.toLowerCase();
    return ungroupedProducts.filter(p =>
      p.asin.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.barcode_1.toLowerCase().includes(q)
    );
  }, [ungroupedProducts, search]);

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-[#111111] border border-white/[0.1] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/[0.1] flex items-center gap-3">
          <Plus className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-white">Add Products to Group</h2>
          <button onClick={onClose} className="ml-auto text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-white/[0.05]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ungrouped products by ASIN, brand, name, barcode..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#0a0a0a] border border-white/[0.1] rounded-lg text-white placeholder-slate-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {ungroupedProducts.length === 0 ? 'No ungrouped products available' : 'No matches'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.slice(0, 200).map(p => (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`border-t border-white/[0.05] cursor-pointer transition ${picked.has(p.id) ? 'bg-orange-500/10' : 'hover:bg-white/[0.02]'}`}
                  >
                    <td className="px-3 py-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => toggle(p.id)}
                        className="w-4 h-4 accent-orange-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-100">{p.asin}</td>
                    <td className="px-3 py-2 text-gray-300">{p.brand || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 truncate max-w-xs" title={p.name}>{p.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 200 && (
            <p className="text-xs text-gray-500 text-center py-3">Showing first 200 — refine search to find more</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.1] flex items-center justify-between gap-3">
          <span className="text-sm text-gray-400">{picked.size} selected</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-white/[0.1] rounded-lg hover:bg-white/[0.05] transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onAdd(Array.from(picked))}
              disabled={picked.size === 0}
              className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border shadow-lg transition ${picked.size === 0 ? 'bg-orange-700 text-orange-200 border-orange-600 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400/50 shadow-orange-900/20'}`}
            >
              <Check className="w-4 h-4" /> Add {picked.size > 0 && `(${picked.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
