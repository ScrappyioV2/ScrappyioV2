import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient';


export interface UploadResult {
  data: any[]
  errors: string[]
}


const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};


/**
 * Parse CSV file
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
        })
      },
      error: (error: any) => {
        resolve({
          data: [],
          errors: [error.message],
        })
      },
    })
  })
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export const parseExcel = async (file: File): Promise<UploadResult> => {
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    return {
      data: jsonData,
      errors: [],
    }
  } catch (error: any) {
    return {
      data: [],
      errors: [error.message || 'Failed to parse Excel file'],
    }
  }
}

/**
 * Detect file type and parse accordingly
 */
export const parseFile = async (file: File): Promise<UploadResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'csv':
      return parseCSV(file)
    case 'xlsx':
    case 'xls':
      return parseExcel(file)
    default:
      return {
        data: [],
        errors: [`Unsupported file type: ${extension}`],
      }
  }
}

export async function filterDuplicateASINs(
  products: any[],
  tableName: string
) {
  const asins = products.map(p => p.asin).filter(Boolean);

  if (asins.length === 0) {
    return { newProducts: [], duplicateCount: 0 };
  }

  const existingASINs = new Set<string>();
  const BATCH_SIZE = 500;

  for (let i = 0; i < asins.length; i += BATCH_SIZE) {
    const batch = asins.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from(tableName)
      .select('asin')
      .in('asin', batch);

    if (error) {
      console.error('Duplicate check failed:', error);
      continue; // fail-safe: do not block upload
    }

    (data || []).forEach(row => {
      if (row?.asin) existingASINs.add(row.asin);
    });
  }

  const newProducts = products.filter(
    p => p.asin && !existingASINs.has(p.asin)
  );

  return {
    newProducts,
    duplicateCount: products.length - newProducts.length,
  };
}

