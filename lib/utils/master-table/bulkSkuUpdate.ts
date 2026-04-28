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
  const rawRows = rows.map((row) => {
    const asin = (row.asin ?? row.ASIN ?? '').toString().replace(/\?/g, '').trim();
    const rawSku = (row.sku ?? row.SKU ?? '').toString();
    const sku = rawSku.replace(/\?/g, '').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
    return { asin, sku };
  });

  let filteredRows = rawRows.filter((r) => r.asin !== '');
  const emptySkuRowCount = filteredRows.filter((r) => r.sku === '').length;
  filteredRows = filteredRows.filter((r) => r.sku !== '');
  const inputCount = filteredRows.length;

  const asinCounts = new Map<string, number>();
  for (const r of filteredRows) asinCounts.set(r.asin, (asinCounts.get(r.asin) || 0) + 1);
  const duplicateAsins = new Set<string>();
  asinCounts.forEach((count, asin) => { if (count > 1) duplicateAsins.add(asin); });
  const duplicateAsinCount = duplicateAsins.size;
  const effectiveRows = filteredRows.filter((r) => !duplicateAsins.has(r.asin));
  const effectiveAsinCount = effectiveRows.length;

  if (effectiveRows.length === 0) {
    return { inputCount, effectiveAsinCount, duplicateAsinCount, updatedCount: 0, emptySkuRowCount };
  }

  onProgress?.(5);

  // Step 1: Clear staging table
  await supabase.from('sku_staging').delete().neq('asin', '');

  // Step 2: Upsert into staging table in batches (fast, no function call)
  const BATCH_SIZE = 5000;
  for (let i = 0; i < effectiveRows.length; i += BATCH_SIZE) {
    const chunk = effectiveRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('sku_staging').upsert(chunk, { onConflict: 'asin' });
    if (error) throw error;
    onProgress?.(5 + Math.round((i / effectiveRows.length) * 45));
  }

  onProgress?.(50);

  // Step 3: Apply to each table individually (stays under Kong 60s per call)
  const tables = [
    'sku_catalog',
    'india_master_sellers',
    'brand_checking',
    'seller_products',
    'listing_errors',
    'tracking_ops',
    'india_admin_validation',
    'india_validation_main_file',
    'india_purchases',
    'india_box_checking',
    'india_inbound_tracking',
    'india_purchase_copies',
    'india_purchase_sns',
  ];

  let updatedCount = 0;
  for (let i = 0; i < tables.length; i++) {
    const { data, error } = await supabase.rpc('apply_sku_staging_to', { target_table: tables[i] });
    if (error) throw error;
    updatedCount += (data as any)?.updated ?? 0;
    onProgress?.(50 + Math.round(((i + 1) / tables.length) * 45));
  }

  // Cleanup staging
  await supabase.rpc('apply_sku_staging_cleanup');
  onProgress?.(100);

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


  const BATCH_SIZE = 10000;
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