import { supabase } from '@/lib/supabaseClient';
import Papa from 'papaparse';


export interface SkuUploadResult {
  inputCount: number;
  effectiveAsinCount: number;
  duplicateAsinCount: number;
  updatedCount: number;
  emptySkuRowCount: number;
}


export async function bulkUpdateIndiaSkuFromFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<SkuUploadResult> {
  const text = await file.text();


  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });


  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    throw new Error('Failed to parse CSV – check format');
  }


  const rows = parsed.data;


  // Normalize and pick asin / sku by header name
  const rawRows = rows.map((row) => {
    const asin = (row.asin ?? row.ASIN ?? '').toString()
      .replace(/\?/g, '')   // ✅ FIX: Remove '?' encoding artifacts
      .trim();


    const rawSku = (row.sku ?? row.SKU ?? '').toString();
    const sku = rawSku
      .replace(/\?/g, '')          // ✅ FIX: Remove '?' encoding artifacts
      .replace(/\s*-\s*/g, '-')    // "test-  1" -> "test-1"
      .replace(/\s+/g, ' ')        // collapse any remaining multiple spaces
      .trim();


    return { asin, sku };
  });


  // Drop rows with empty asin
  let filteredRows = rawRows.filter((r) => r.asin !== '');


  // Count and drop rows with empty sku
  const emptySkuRowCount = filteredRows.filter((r) => r.sku === '').length;
  filteredRows = filteredRows.filter((r) => r.sku !== '');


  const inputCount = filteredRows.length;


  // Duplicate ASIN handling (unchanged)
  const asinCounts = new Map<string, number>();
  for (const r of filteredRows) {
    asinCounts.set(r.asin, (asinCounts.get(r.asin) || 0) + 1);
  }


  const duplicateAsins = new Set<string>();
  asinCounts.forEach((count, asin) => {
    if (count > 1) duplicateAsins.add(asin);
  });


  const duplicateAsinCount = duplicateAsins.size;
  const effectiveRows = filteredRows.filter((r) => !duplicateAsins.has(r.asin));
  const effectiveAsinCount = effectiveRows.length;


  if (effectiveRows.length === 0) {
    return {
      inputCount,
      effectiveAsinCount,
      duplicateAsinCount,
      updatedCount: 0,
      emptySkuRowCount,
    };
  }


  const BATCH_SIZE = 10000;
  let updatedCount = 0;
  let processed = 0;


  for (let i = 0; i < effectiveRows.length; i += BATCH_SIZE) {
    const chunk = effectiveRows.slice(i, i + BATCH_SIZE);


    const { data: rpcData, error } = await supabase.rpc(
      'bulk_update_india_sku_batched',
      { batchdata: chunk }  // ✅ FIX: Removed unused 'batchsize' param
    );


    if (error) throw error;


    if (rpcData && typeof rpcData === 'object' && 'updated_count' in rpcData) {
      updatedCount += (rpcData as any).updated_count;
    }


    processed += chunk.length;
    onProgress?.(Math.round((processed / effectiveRows.length) * 100));
  }


  return {
    inputCount,
    effectiveAsinCount,
    duplicateAsinCount,
    updatedCount,
    emptySkuRowCount,
  };
}


export async function bulkUpdateFlipkartSkuFromFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<SkuUploadResult> {
  const text = await file.text();


  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });


  if (parsed.errors.length) {
    console.error('CSV parse errors:', parsed.errors);
    throw new Error('Failed to parse CSV – check format');
  }


  const rows = parsed.data;


  const rawRows = rows.map((row) => {
    const asin = (row.asin ?? row.ASIN ?? '').toString()
      .replace(/\?/g, '')
      .trim();


    const rawSku = (row.sku ?? row.SKU ?? '').toString();
    const sku = rawSku
      .replace(/\?/g, '')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();


    return { asin, sku };
  });


  let filteredRows = rawRows.filter((r) => r.asin !== '');


  const emptySkuRowCount = filteredRows.filter((r) => r.sku === '').length;
  filteredRows = filteredRows.filter((r) => r.sku !== '');


  const inputCount = filteredRows.length;


  const asinCounts = new Map<string, number>();
  for (const r of filteredRows) {
    asinCounts.set(r.asin, (asinCounts.get(r.asin) || 0) + 1);
  }


  const duplicateAsins = new Set<string>();
  asinCounts.forEach((count, asin) => {
    if (count > 1) duplicateAsins.add(asin);
  });


  const duplicateAsinCount = duplicateAsins.size;
  const effectiveRows = filteredRows.filter((r) => !duplicateAsins.has(r.asin));
  const effectiveAsinCount = effectiveRows.length;


  if (effectiveRows.length === 0) {
    return {
      inputCount,
      effectiveAsinCount,
      duplicateAsinCount,
      updatedCount: 0,
      emptySkuRowCount,
    };
  }


  const BATCH_SIZE = 1000;
  let updatedCount = 0;
  let processed = 0;


  for (let i = 0; i < effectiveRows.length; i += BATCH_SIZE) {
    const chunk = effectiveRows.slice(i, i + BATCH_SIZE);


    const { data: rpcData, error } = await supabase.rpc(
      'bulk_update_flipkart_sku_batched',
      { batchdata: chunk }
    );


    if (error) throw error;


    if (rpcData && typeof rpcData === 'object' && 'updated_count' in rpcData) {
      updatedCount += (rpcData as any).updated_count;
    }


    processed += chunk.length;
    onProgress?.(Math.round((processed / effectiveRows.length) * 100));
  }


  return {
    inputCount,
    effectiveAsinCount,
    duplicateAsinCount,
    updatedCount,
    emptySkuRowCount,
  };
}