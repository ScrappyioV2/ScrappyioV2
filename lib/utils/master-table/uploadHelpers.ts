import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

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
 * UPDATE-ONLY FLOW (NEW — SAFE)
 * ============================================================================
 */

export async function bulkUpdateAsinRemarkMonthlyUnit(
  rows: Array<{
    asin: string;
    remark?: string | null;
    monthly_unit?: number | null;
  }>,
  tableName: string
) {
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (!row.asin) continue;

    // ✅ IMPORTANT: Fetch existing data to compare
    const { data: existing, error: fetchError } = await supabase
      .from(tableName)
      .select('remark, monthly_unit')
      .eq('asin', row.asin)
      .single();

    // Skip if ASIN doesn't exist
    if (fetchError || !existing) {
      skippedCount++;
      continue;
    }

    // Skip if both values unchanged
    const remarkUnchanged = existing.remark === row.remark;
    const monthlyUnitUnchanged = existing.monthly_unit === row.monthly_unit;

    if (remarkUnchanged && monthlyUnitUnchanged) {
      skippedCount++;
      continue;
    }

    // Update only changed fields
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (row.remark !== undefined) payload.remark = row.remark;
    if (row.monthly_unit !== undefined) payload.monthly_unit = row.monthly_unit;

    const { error: updateError } = await supabase
      .from(tableName)
      .update(payload)
      .eq('asin', row.asin);

    if (updateError) {
      console.error(`Update failed for ASIN ${row.asin}:`, updateError);
      continue;
    }

    updatedCount++;
  }

  return { 
    updatedCount, 
    skippedCount,
    message: `✅ Updated: ${updatedCount} | ⏭️ Skipped: ${skippedCount}`
  };
}
