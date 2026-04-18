'use client';

import { useState, useMemo, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, Plus, Trash2, Copy, Search, X,
  LayoutGrid, List, Cog, Loader2, ChevronRight, ChevronDown, Pencil,
} from 'lucide-react';
import PageTransition from '@/components/layout/PageTransition';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabaseClient';

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
  product_number: number;
  sku: string;
};

const generateSku = (productNumber: number, asin: string, packOf: number): string => {
  const base = `${productNumber}- ${asin}`;
  return packOf > 1 ? `${base}-${packOf}` : base;
};

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function SkuGeneratorPage() {
  const { loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState<'grouped' | 'flat'>('grouped');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    asin: '',
    brand: '',
    name: '',
    pack_of: 1,
    product_number: 0,
    multi_listing: 'A',
  });
  const [formBarcodes, setFormBarcodes] = useState<string[]>(['']);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const loadProducts = useCallback(async () => {
    setDataLoading(true);
    const { data, error } = await supabase
      .from('sku_catalog')
      .select('*')
      .order('product_number', { ascending: true });
    if (error) {
      showToast(`Load failed: ${error.message}`, 'error');
    } else if (data) {
      setProducts(data.map((row: any) => {
        let parsedBarcodes: string[] = [];
        if (Array.isArray(row.barcodes)) {
          parsedBarcodes = row.barcodes.filter((b: any) => typeof b === 'string' && b.trim());
        } else if (typeof row.barcodes === 'string') {
          try {
            const arr = JSON.parse(row.barcodes);
            if (Array.isArray(arr)) parsedBarcodes = arr.filter((b: any) => typeof b === 'string' && b.trim());
          } catch { /* ignore */ }
        }
        if (parsedBarcodes.length === 0) {
          parsedBarcodes = [row.barcode_1, row.barcode_2].filter(Boolean);
        }
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
        };
      }));
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleBarcodeChange = (index: number, value: string) => {
    setFormBarcodes(prev => prev.map((b, i) => i === index ? value : b));
    const trimmed = value.trim();
    if (!trimmed) {
      // Only clear product_number if no other barcode matches
      const otherFilled = formBarcodes.some((b, i) => i !== index && b.trim());
      if (!otherFilled) {
        setForm(prev => ({ ...prev, product_number: 0 }));
      }
      return;
    }
    const matchingProduct = products.find(p =>
      p.barcodes.some(b => b.trim() === trimmed)
    );
    if (matchingProduct) {
      setFormBarcodes(prev => {
        // Replace at index with this value, then merge any missing barcodes from the matched product
        const updated = prev.map((b, i) => i === index ? value : b);
        const existing = new Set(updated.map(b => b.trim()).filter(Boolean));
        for (const b of matchingProduct.barcodes) {
          if (b.trim() && !existing.has(b.trim())) updated.push(b);
        }
        return updated;
      });
      setForm(prev => ({
        ...prev,
        brand: prev.brand || matchingProduct.brand,
        product_number: matchingProduct.product_number,
      }));
    } else {
      const maxProductNumber = products.reduce((max, p) => Math.max(max, p.product_number), 0);
      setForm(prev => ({
        ...prev,
        product_number: maxProductNumber + 1,
      }));
    }
  };

  const addBarcodeInput = () => setFormBarcodes(prev => [...prev, '']);
  const removeBarcodeInput = (index: number) => setFormBarcodes(prev => prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index));

  const previewSku = useMemo(() => {
    if (!form.asin || !form.product_number) return '';
    return generateSku(form.product_number, form.asin, form.pack_of);
  }, [form]);

  const handleAddProduct = async () => {
    if (!form.asin.trim()) return showToast('ASIN is required', 'error');
    const cleanedBarcodes = formBarcodes.map(b => b.trim()).filter(Boolean);
    if (cleanedBarcodes.length === 0) return showToast('At least one barcode is required', 'error');
    if (!form.product_number) return showToast('Product Number missing', 'error');

    const sku = generateSku(form.product_number, form.asin.trim(), form.pack_of);
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
        pack_of: form.pack_of || null,
        product_number: form.product_number,
        sku,
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
    }]);
    setForm({
      asin: '', brand: '', name: '',
      pack_of: 1, product_number: 0, multi_listing: 'A',
    });
    setFormBarcodes(['']);
    showToast(`Added ${sku}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('sku_catalog').delete().eq('id', id);
    if (error) {
      showToast(`Delete failed: ${error.message}`, 'error');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handlePackChange = async (id: string, newPackOf: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const safePack = Math.max(1, newPackOf || 1);
    if (safePack === product.pack_of) return;
    const newSku = generateSku(product.product_number, product.asin, safePack);
    const { error } = await supabase
      .from('sku_catalog')
      .update({ pack_of: safePack, sku: newSku })
      .eq('id', id);
    if (error) {
      showToast(`Pack update failed: ${error.message}`, 'error');
      return;
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, pack_of: safePack, sku: newSku } : p));
    showToast(`Updated pack → ${newSku}`);
  };

  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku).then(() => showToast(`Copied: ${sku}`)).catch(() => showToast('Copy failed', 'error'));
  };

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const parsed: Product[] = result.data.map((row) => {
          const asin = (row['ASIN'] || row['asin'] || '').trim();
          const brand = (row['Brand Name'] || row['brand'] || '').trim();
          const name = (row['Name'] || row['name'] || '').trim();
          const barcode1 = (row['Barcode 1'] || row['barcode_1'] || '').trim();
          const barcode2 = (row['Barcode 2'] || row['barcode_2'] || '').trim();
          const packOf = parseInt(row['Pack of'] || row['pack_of'] || '1', 10) || 1;
          const productNumber = parseInt(row['Product Number'] || row['product_number'] || row['No'] || '0', 10) || 0;
          const sku = (row['SKU'] || row['sku'] || '').trim() || generateSku(productNumber, asin, packOf);
          const barcodes = [barcode1, barcode2].filter(Boolean);
          return {
            id: newId(),
            asin, brand, name,
            multi_listing: 'A',
            barcode_1: barcode1, barcode_2: barcode2,
            barcodes,
            pack_of: packOf, product_number: productNumber, sku,
          };
        }).filter(p => p.asin && p.product_number);

        const rows = parsed.map(p => ({
          asin: p.asin,
          brand: p.brand || null,
          product_name: p.name || null,
          multi_listing: p.multi_listing,
          barcode_1: p.barcode_1 || null,
          barcode_2: p.barcode_2 || null,
          barcodes: p.barcodes,
          pack_of: p.pack_of || null,
          product_number: p.product_number,
          sku: p.sku,
        }));

        let failed = 0;
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await supabase.from('sku_catalog').upsert(batch, { onConflict: 'sku' });
          if (error) {
            console.error('Batch error:', error);
            failed += batch.length;
          }
        }

        await loadProducts();
        setUploading(false);
        if (failed > 0) {
          showToast(`Imported ${rows.length - failed}/${rows.length} (${failed} failed)`, 'error');
        } else {
          showToast(`Imported ${rows.length} products`);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: () => { setUploading(false); showToast('CSV parse failed', 'error'); },
    });
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(products.map((p, i) => ({
      No: i + 1,
      ASIN: p.asin,
      'Brand Name': p.brand,
      Name: p.name,
      'Multi Listing': p.multi_listing,
      'Barcode 1': p.barcode_1,
      'Barcode 2': p.barcode_2,
      'Pack of': p.pack_of,
      'Product Number': p.product_number,
      SKU: p.sku,
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sku-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.asin.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.barcode_1.toLowerCase().includes(q) ||
      p.barcode_2.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<number, Product[]>();
    for (const p of filteredProducts) {
      const arr = map.get(p.product_number) || [];
      arr.push(p);
      map.set(p.product_number, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredProducts]);

  const stats = useMemo(() => ({
    total: products.length,
    groups: new Set(products.map(p => p.product_number)).size,
    brands: new Set(products.map(p => p.brand).filter(Boolean)).size,
    packs: products.filter(p => p.pack_of > 1).length,
  }), [products]);

  return (
    <PageTransition>
      <div className="h-screen flex flex-col bg-[#111111] text-gray-100">
        {/* Header */}
        <div className="flex-none px-4 sm:px-6 pt-4 sm:pt-6 pb-5 border-b border-white/[0.1]">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Cog className="w-5 h-5 text-orange-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">SKU Generator</h1>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm pl-1">
            Format: <span className="font-mono text-orange-400">{'{ProductNumber}- {ASIN}[-{PackOf}]'}</span>
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-4">
            <StatPill label="Products" value={stats.total} color="text-white" />
            <StatPill label="Groups" value={stats.groups} color="text-orange-300" />
            <StatPill label="Brands" value={stats.brands} color="text-emerald-300" />
            <StatPill label="Packs" value={stats.packs} color="text-cyan-300" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex-none px-4 sm:px-6 pt-4 pb-4 flex flex-wrap items-center gap-3 border-b border-white/[0.1]">
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

          <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
            <button
              onClick={() => setView('grouped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${view === 'grouped' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grouped
            </button>
            <button
              onClick={() => setView('flat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${view === 'flat' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}
            >
              <List className="w-3.5 h-3.5" /> Flat
            </button>
          </div>

          {view === 'grouped' && (
            <div className="flex items-center gap-1 bg-[#1a1a1a] rounded-xl border border-white/[0.1] p-1">
              <button
                onClick={() => setExpandedGroups(new Set(groups.map(([num]) => num)))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-100 transition"
                title="Expand all groups"
              >
                Expand All
              </button>
              <button
                onClick={() => setExpandedGroups(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-100 transition"
                title="Collapse all groups"
              >
                Collapse All
              </button>
            </div>
          )}

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

            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Pack Of</label>
              <input
                type="number"
                min={1}
                value={form.pack_of}
                onChange={e => setForm(p => ({ ...p, pack_of: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                className="w-full px-3 py-2 bg-[#111111] border border-white/[0.1] rounded-lg text-sm text-white font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Product #</label>
              <input
                type="number"
                value={form.product_number || ''}
                onChange={e => setForm(p => ({ ...p, product_number: parseInt(e.target.value, 10) || 0 }))}
                placeholder="auto"
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

          {previewSku && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-gray-500 uppercase tracking-wider">Preview:</span>
              <span className="font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded">{previewSku}</span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 py-4">
          {dataLoading || authLoading ? (
            <div className="flex flex-col items-center justify-center p-16">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              <p className="mt-4 text-gray-500 text-sm">Loading SKU catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Cog className="w-12 h-12 opacity-30" />
              <p className="text-sm">Upload a CSV or add a product to get started</p>
            </div>
          ) : view === 'grouped' ? (
            <div className="space-y-3">
              {groups.map(([num, items]) => {
                const isExpanded = expandedGroups.has(num);
                const aListing = items[0];
                return (
                  <div key={num} className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
                    <button
                      onClick={() => {
                        setExpandedGroups(prev => {
                          const next = new Set(prev);
                          if (next.has(num)) next.delete(num); else next.add(num);
                          return next;
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-[#111111] border-b border-white/[0.1] flex items-center gap-3 hover:bg-[#181818] transition text-left"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-orange-400 shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                      <span className="font-mono text-orange-400 font-bold text-sm">GROUP #{num}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300 text-sm">{aListing.brand || '—'}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300 text-sm truncate max-w-md">{aListing.name || '—'}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500 text-xs ml-auto">{items.length} listing{items.length > 1 ? 's' : ''}</span>
                    </button>
                    {isExpanded && (
                      <ProductTable items={items} onCopy={handleCopySku} onDelete={handleDelete} onPackChange={handlePackChange} showProductNumber={false} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
              <ProductTable items={filteredProducts} onCopy={handleCopySku} onDelete={handleDelete} onPackChange={handlePackChange} showProductNumber={true} />
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-xl text-sm font-medium shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-600/90 border-emerald-500 text-white' : 'bg-rose-600/90 border-rose-500 text-white'}`}>
            {toast.message}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] rounded-lg border border-white/[0.1]">
      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2 py-1.5 text-sm bg-[#1a1a1a] border border-white/[0.1] rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 placeholder-slate-600 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function ProductTable({ items, onCopy, onDelete, onPackChange, showProductNumber }: { items: Product[]; onCopy: (sku: string) => void; onDelete: (id: string) => void; onPackChange: (id: string, packOf: number) => void; showProductNumber: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#111111] text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            {showProductNumber && <th className="px-3 py-2 text-left font-medium">Product#</th>}
            <th className="px-3 py-2 text-left font-medium">ASIN</th>
            <th className="px-3 py-2 text-left font-medium">Brand</th>
            <th className="px-3 py-2 text-left font-medium">Product Name</th>
            <th className="px-3 py-2 text-center font-medium">Pack</th>
            <th className="px-3 py-2 text-left font-medium">Barcode</th>
            <th className="px-3 py-2 text-left font-medium">SKU</th>
            <th className="px-3 py-2 text-center font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => {
            return (
              <tr key={p.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                {showProductNumber && <td className="px-3 py-2 font-mono text-orange-400 font-bold">#{p.product_number}</td>}
                <td className="px-3 py-2 font-mono text-gray-100">{p.asin}</td>
                <td className="px-3 py-2 text-gray-200">{p.brand || '—'}</td>
                <td className="px-3 py-2 text-gray-300 max-w-xs truncate" title={p.name}>{p.name || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <PackEdit value={p.pack_of} onSave={(n) => onPackChange(p.id, n)} />
                </td>
                <td className="px-3 py-2 font-mono text-gray-400 text-xs">
                  {p.barcodes.length === 0 ? (
                    <span>—</span>
                  ) : p.barcodes.length <= 3 ? (
                    p.barcodes.map((b, i) => (
                      <div key={i} className={i === 0 ? 'text-xs text-gray-400' : 'text-[10px] text-gray-500 mt-0.5'}>{b}</div>
                    ))
                  ) : (
                    <>
                      <div className="text-xs text-gray-400">{p.barcodes[0]}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{p.barcodes[1]}</div>
                      <div className="text-[10px] text-orange-400 mt-0.5 cursor-help" title={p.barcodes.slice(2).join('\n')}>
                        +{p.barcodes.length - 2} more
                      </div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded text-xs">{p.sku}</span>
                    <button
                      onClick={() => onCopy(p.sku)}
                      className="text-gray-500 hover:text-orange-400 transition"
                      title="Copy SKU"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PackEdit({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

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
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="group/pack font-mono text-gray-300 hover:text-orange-400 hover:bg-white/[0.05] px-2 py-1 rounded transition inline-flex items-center gap-1.5 cursor-pointer"
      title="Click to edit pack size"
    >
      <span>{value > 1 ? `×${value}` : '—'}</span>
      <Pencil className="w-3 h-3 opacity-30 group-hover/pack:opacity-80 transition-opacity" />
    </button>
  );
}
