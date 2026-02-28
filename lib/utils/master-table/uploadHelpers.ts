import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabaseClient";

/* ============================================================================
 * Types
 * ============================================================================
 */

export interface UploadResult {
  data: any[];
  errors: string[];
}

/* ============================================================================
 * File Parsing Helpers
 * ============================================================================
 */

export const parseCSV = (file: File): Promise<UploadResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        resolve({
          data: results.data,
          errors: results.errors.map((e: any) => e.message),
        });
      },
      error: (error: any) => {
        resolve({
          data: [],
          errors: [error.message],
        });
      },
    });
  });
};

export const parseExcel = async (file: File): Promise<UploadResult> => {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    return {
      data: XLSX.utils.sheet_to_json(worksheet),
      errors: [],
    };
  } catch (error: any) {
    return {
      data: [],
      errors: [error.message || "Failed to parse Excel file"],
    };
  }
};

export const parseFile = async (file: File): Promise<UploadResult> => {
  const ext = file.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "csv":
      return parseCSV(file);
    case "xlsx":
    case "xls":
      return parseExcel(file);
    default:
      return {
        data: [],
        errors: [`Unsupported file type: ${ext}`],
      };
  }
};

/* ============================================================================
 * DUPLICATE CHECK (INSERT FLOW — UNCHANGED)
 * ============================================================================
 */

export async function filterDuplicateASINs(
  products: any[],
  tableName: string
) {
  const asins = products.map((p) => p.asin).filter(Boolean);

  if (asins.length === 0) {
    return { newProducts: [], duplicateCount: 0 };
  }

  const existingASINs = new Set<string>();
  const BATCH_SIZE = 500;

  for (let i = 0; i < asins.length; i += BATCH_SIZE) {
    const batch = asins.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from(tableName)
      .select("asin")
      .in("asin", batch);

    if (error) {
      console.error("Duplicate ASIN check failed:", error);
      continue;
    }

    data?.forEach((row: any) => {
      if (row?.asin) existingASINs.add(row.asin);
    });
  }

  const newProducts = products.filter(
    (p) => p.asin && !existingASINs.has(p.asin)
  );

  return {
    newProducts,
    duplicateCount: products.length - newProducts.length,
  };
}

/* ============================================================================
 * UPDATE-ONLY FLOW (BATCHED VERSION)
 * ============================================================================
 */

/**
 * ✅ BATCHED VERSION - Handles 100k+ records safely
 * Updates master + syncs to all 24 tables
 * Progress tracking included
 */
export async function bulkUpdateAsinRemarkMonthlyUnit(
  rows: Array<{ asin: string; remark?: string | null; monthly_unit?: number | null; sku?: string | null }>,
  tableName: string,
  onProgress?: (current: number, total: number) => void
) {
  if (!rows || rows.length === 0) {
    return { updatedCount: 0, skippedCount: 0 };
  }

  // ✅ Determine RPC function based on table
  let rpcFunctionName = '';

  if (tableName === 'flipkart_master_sellers') {
    rpcFunctionName = 'bulkupdateflipkartasinremarkmonthlyunitbatched';
  } else if (tableName === 'india_master_sellers') {
    rpcFunctionName = 'bulk_update_india_asin_remark_monthly_unit_batched';
  } else if (tableName === 'usa_master_sellers') {
    rpcFunctionName = 'bulk_update_usa_asin_remark_monthly_unit_batched';
  } else if (tableName === 'uk_master_sellers') {
    rpcFunctionName = 'bulk_update_uk_asin_remark_monthly_unit_batched';
  } else if (tableName === 'uae_master_sellers') {
    rpcFunctionName = 'bulk_update_uae_asin_remark_monthly_unit_batched';
  } else {
    console.error('Unknown table name:', tableName);
    return { updatedCount: 0, skippedCount: 0 };
  }

  // ✅ FRONTEND BATCHING: Split into chunks to avoid timeout
  const FRONTEND_BATCH_SIZE = 5000; // Each RPC call handles max 5k records
  const totalRecords = rows.length;
  const numBatches = Math.ceil(totalRecords / FRONTEND_BATCH_SIZE);

  let totalUpdated = 0;
  let totalSkipped = 0;

  console.log(`🔄 Frontend batching: ${totalRecords} records in ${numBatches} RPC call(s)`);
  console.log('🔍 First normalized row:', JSON.stringify(rows[0]));
  console.log('🔍 First batchData row:', JSON.stringify({
    asin: rows[0].asin,
    remark: rows[0].remark || null,
    monthly_unit: rows[0].monthly_unit || null
  }));
  console.log('🔍 All keys in row[0]:', Object.keys(rows[0]));

  // Process each frontend batch
  for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
    const start = batchIndex * FRONTEND_BATCH_SIZE;
    const end = Math.min(start + FRONTEND_BATCH_SIZE, totalRecords);
    const batchRows = rows.slice(start, end);

    // Format data for this batch
    const batchData = batchRows.map(row => ({
      asin: row.asin,
      remark: row.remark || null,
      monthly_unit: row.monthly_unit || null,
      sku: row.sku || null,
    }));

    console.log(`🔄 RPC call ${batchIndex + 1}/${numBatches}: ${batchData.length} records`);

    try {
      // ✅ Call batched RPC for this chunk
      const { data, error } = await supabase.rpc(rpcFunctionName, {
        batchdata: batchData,
        batchsize: 500
      });

      if (error) {
        console.error(`❌ RPC call ${batchIndex + 1}/${numBatches} failed:`, error);
        totalSkipped += batchRows.length;
        continue;
      }

      const batchUpdated = data?.updatedcount || 0;
      totalUpdated += batchUpdated;
      totalSkipped += (batchRows.length - batchUpdated);

      console.log(`✅ RPC call ${batchIndex + 1}/${numBatches}: ${batchUpdated} updated`);

      // Report progress
      if (onProgress) {
        onProgress(end, totalRecords);
      }

      // Small delay between RPC calls
      if (batchIndex < numBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err: any) {
      console.error(`❌ Exception in RPC call ${batchIndex + 1}/${numBatches}:`, err);
      totalSkipped += batchRows.length;
    }
  }

  console.log(`✅ Complete: ${totalUpdated} updated, ${totalSkipped} skipped`);

  return {
    updatedCount: totalUpdated,
    skippedCount: totalSkipped,
    message: `✅ ${totalUpdated.toLocaleString()} records updated and synced to all 24 tables`
  };
}
