'use client';

import { useState, useMemo, useRef, useEffect, useCallback, ChangeEvent } from 'react';
import Papa from 'papaparse';
import {
  Upload, Download, Plus, Trash2, Copy, Search, X,
  LayoutGrid, List, Cog, Loader2,
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
  pack_of: number;
  product_number: number;
  sku: string;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ML_COLORS: Record<string, string> = {
  A: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  B: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  C: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  D: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  E: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  F: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  G: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  H: 'bg-lime-500/20 text-lime-300 border-lime-500/30',
};
const defaultMlColor = 'bg-slate-500/20 text-slate-300 border-slate-500/30';

const generateSku = (productNumber: number, asin: string, multiListing: string, packOf: number): string => {
  const base = `${productNumber}- ${asin}-${multiListing}`;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    asin: '',
    brand: '',
    name: '',
    barcode_1: '',
    barcode_2: '',
    pack_of: 1,
    product_number: 0,
    multi_listing: 'A',
  });

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
      setProducts(data.map((row: any) => ({
        id: row.id,
        asin: row.asin,
        brand: row.brand || '',
        name: row.product_name || '',
        multi_listing: row.multi_listing,
        barcode_1: row.barcode_1 || '',
        barcode_2: row.barcode_2 || '',
        pack_of: row.pack_of || 1,
        product_number: row.product_number,
        sku: row.sku,
      })));
    }
    setDataLoading(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleBarcodeChange = (value: string) => {
    const trimmed = value.trim();
    setForm(prev => ({ ...prev, barcode_1: value }));
    if (!trimmed) {
      setForm(prev => ({ ...prev, barcode_1: value, product_number: 0, multi_listing: 'A' }));
      return;
    }
    const matchingGroup = products.filter(p => p.barcode_1.trim() === trimmed);
    if (matchingGroup.length > 0) {
      const productNumber = matchingGroup[0].product_number;
      const usedLetters = new Set(matchingGroup.map(p => p.multi_listing));
      const nextLetter = ALPHABET.find(l => !usedLetters.has(l)) || 'A';
      setForm(prev => ({
        ...prev,
        barcode_1: value,
        brand: prev.brand || matchingGroup[0].brand,
        product_number: productNumber,
        multi_listing: nextLetter,
      }));
    } else {
      const maxProductNumber = products.reduce((max, p) => Math.max(max, p.product_number), 0);
      setForm(prev => ({
        ...prev,
        barcode_1: value,
        product_number: maxProductNumber + 1,
        multi_listing: 'A',
      }));
    }
  };

  const previewSku = useMemo(() => {
    if (!form.asin || !form.product_number) return '';
    return generateSku(form.product_number, form.asin, form.multi_listing, form.pack_of);
  }, [form]);

  const handleAddProduct = async () => {
    if (!form.asin.trim()) return showToast('ASIN is required', 'error');
    if (!form.barcode_1.trim()) return showToast('Barcode 1 is required', 'error');
    if (!form.product_number) return showToast('Product Number missing', 'error');

    const sku = generateSku(form.product_number, form.asin.trim(), form.multi_listing, form.pack_of);
    setAdding(true);
    const { data: inserted, error } = await supabase
      .from('sku_catalog')
      .insert({
        asin: form.asin.trim(),
        brand: form.brand.trim() || null,
        product_name: form.name.trim() || null,
        multi_listing: form.multi_listing,
        barcode_1: form.barcode_1.trim() || null,
        barcode_2: form.barcode_2.trim() || null,
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
      pack_of: inserted.pack_of || 1,
      product_number: inserted.product_number,
      sku: inserted.sku,
    }]);
    setForm({
      asin: '', brand: '', name: '', barcode_1: '', barcode_2: '',
      pack_of: 1, product_number: 0, multi_listing: 'A',
    });
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
          const multiListing = (row['Multi Listing'] || row['multi_listing'] || 'A').trim().toUpperCase() || 'A';
          const barcode1 = (row['Barcode 1'] || row['barcode_1'] || '').trim();
          const barcode2 = (row['Barcode 2'] || row['barcode_2'] || '').trim();
          const packOf = parseInt(row['Pack of'] || row['pack_of'] || '1', 10) || 1;
          const productNumber = parseInt(row['Product Number'] || row['product_number'] || row['No'] || '0', 10) || 0;
          const sku = (row['SKU'] || row['sku'] || '').trim() || generateSku(productNumber, asin, multiListing, packOf);
          return {
            id: newId(),
            asin, brand, name,
            multi_listing: multiListing,
            barcode_1: barcode1, barcode_2: barcode2,
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

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#111111]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

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
            Format: <span className="font-mono text-orange-400">{'{ProductNumber}- {ASIN}-{MultiListing}[-{PackOf}]'}</span>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2">
            <FormInput label="Barcode 1*" value={form.barcode_1} onChange={handleBarcodeChange} placeholder="Scan/type" mono />
            <FormInput label="ASIN*" value={form.asin} onChange={v => setForm(p => ({ ...p, asin: v.toUpperCase() }))} placeholder="B0..." mono />
            <FormInput label="Brand" value={form.brand} onChange={v => setForm(p => ({ ...p, brand: v }))} placeholder="Brand" />
            <FormInput label="Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Product name" />
            <FormInput label="Barcode 2" value={form.barcode_2} onChange={v => setForm(p => ({ ...p, barcode_2: v }))} placeholder="Optional" mono />
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Pack Of</label>
              <input
                type="number"
                min={1}
                value={form.pack_of}
                onChange={e => setForm(p => ({ ...p, pack_of: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                className="w-full px-2 py-1.5 text-sm bg-[#1a1a1a] border border-white/[0.1] rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Product #</label>
              <input
                type="number"
                value={form.product_number || ''}
                onChange={e => setForm(p => ({ ...p, product_number: parseInt(e.target.value, 10) || 0 }))}
                className="w-full px-2 py-1.5 text-sm bg-[#1a1a1a] border border-white/[0.1] rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 font-mono"
                placeholder="auto"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">ML</label>
              <select
                value={form.multi_listing}
                onChange={e => setForm(p => ({ ...p, multi_listing: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm bg-[#1a1a1a] border border-white/[0.1] rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-gray-100 font-mono"
              >
                {ALPHABET.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <button
              onClick={handleAddProduct}
              disabled={adding}
              className={`self-end px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border shadow-lg ${adding ? 'bg-orange-700 text-orange-200 border-orange-600 cursor-wait' : 'bg-orange-500 text-white hover:bg-orange-400 border-orange-400/50 shadow-orange-900/20'}`}
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
          {dataLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm">Loading SKU catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Cog className="w-12 h-12 opacity-30" />
              <p className="text-sm">Upload a CSV or add a product to get started</p>
            </div>
          ) : view === 'grouped' ? (
            <div className="space-y-4">
              {groups.map(([num, items]) => (
                <div key={num} className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
                  <div className="px-4 py-2.5 bg-[#111111] border-b border-white/[0.1] flex items-center gap-3">
                    <span className="font-mono text-orange-400 font-bold text-sm">GROUP #{num}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-300 text-sm">{items[0].brand || '—'}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500 text-xs">{items.length} listing{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <ProductTable items={items} onCopy={handleCopySku} onDelete={handleDelete} showProductNumber={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
              <ProductTable items={filteredProducts} onCopy={handleCopySku} onDelete={handleDelete} showProductNumber={true} />
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

function ProductTable({ items, onCopy, onDelete, showProductNumber }: { items: Product[]; onCopy: (sku: string) => void; onDelete: (id: string) => void; showProductNumber: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#111111] text-gray-500 text-[11px] uppercase tracking-wider">
          <tr>
            {showProductNumber && <th className="px-3 py-2 text-left font-medium">Product#</th>}
            <th className="px-3 py-2 text-left font-medium">ASIN</th>
            <th className="px-3 py-2 text-left font-medium">Brand</th>
            <th className="px-3 py-2 text-left font-medium">Product Name</th>
            <th className="px-3 py-2 text-center font-medium">ML</th>
            <th className="px-3 py-2 text-center font-medium">Pack</th>
            <th className="px-3 py-2 text-left font-medium">Barcode</th>
            <th className="px-3 py-2 text-left font-medium">SKU</th>
            <th className="px-3 py-2 text-center font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {items.map(p => {
            const mlColor = ML_COLORS[p.multi_listing] || defaultMlColor;
            return (
              <tr key={p.id} className="border-t border-white/[0.05] hover:bg-white/[0.02]">
                {showProductNumber && <td className="px-3 py-2 font-mono text-orange-400 font-bold">#{p.product_number}</td>}
                <td className="px-3 py-2 font-mono text-gray-100">{p.asin}</td>
                <td className="px-3 py-2 text-gray-200">{p.brand || '—'}</td>
                <td className="px-3 py-2 text-gray-300 max-w-xs truncate" title={p.name}>{p.name || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono font-bold text-xs border ${mlColor}`}>
                    {p.multi_listing}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-mono text-gray-300">{p.pack_of > 1 ? `×${p.pack_of}` : '—'}</td>
                <td className="px-3 py-2 font-mono text-gray-400 text-xs">{p.barcode_1}</td>
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
