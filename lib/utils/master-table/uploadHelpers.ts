import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type FileType = 'csv' | 'excel';

export interface ParsedData {
  data: any[];
  errors: string[];
}

/**
 * Detect file type from extension
 */
export const detectFileType = (file: File): FileType | null => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return 'csv';
  if (['xlsx', 'xls'].includes(extension || '')) return 'excel';
  return null;
};

/**
 * Parse CSV file
 */
export const parseCSV = (file: File): Promise<ParsedData> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          data: results.data,
          errors: results.errors.map((e) => e.message),
        });
      },
      error: (error) => {
        resolve({
          data: [],
          errors: [error.message],
        });
      },
    });
  });
};

/**
 * Parse Excel file
 */
export const parseExcel = (file: File): Promise<ParsedData> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        resolve({
          data: jsonData,
          errors: [],
        });
      } catch (error) {
        resolve({
          data: [],
          errors: ['Failed to parse Excel file'],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        data: [],
        errors: ['Failed to read file'],
      });
    };

    reader.readAsBinaryString(file);
  });
};

/**
 * Main upload parser
 */
export const parseUploadedFile = async (file: File): Promise<ParsedData> => {
  const fileType = detectFileType(file);

  if (!fileType) {
    return {
      data: [],
      errors: ['Unsupported file type. Please upload CSV or Excel files.'],
    };
  }

  if (fileType === 'csv') {
    return await parseCSV(file);
  } else {
    return await parseExcel(file);
  }
};

/**
 * Validate and normalize data for database insertion
 */
export const normalizeDataForDB = (data: any[]): any[] => {
  return data.map((row) => ({
    asin: row.ASIN || row.asin || '',
    link: row.Link || row.link || '',
    product_name: row['Product Name'] || row.product_name || '',
    brand: row.Brand || row.brand || '',
    price: parseFloat(row.Price || row.price || '0'),
    monthly_unit: parseFloat(row['Monthly Unit'] || row.monthly_unit || '0'),
    monthly_sales: parseFloat(row['Monthly Sales'] || row.monthly_sales || '0'),
    bsr: parseFloat(row.BSR || row.bsr || '0'),
    seller: parseFloat(row.Seller || row.seller || '0'),
    category: row.Category || row.category || '',
    dimensions: row.Dimensions || row.dimensions || '',
    weight: parseFloat(row.Weight || row.weight || '0'),
    weight_unit: row['Weight Unit'] || row.weight_unit || 'kg',
  }));
};

/**
 * Check for duplicate ASINs and filter them out
 */
/**
 * Check for duplicate ASINs and filter them out (with batching)
 */
export const filterDuplicateASINs = async (
  data: any[],
  tableName: string,
  supabaseClient: any
): Promise<{ newProducts: any[]; duplicateCount: number; duplicateASINs: string[] }> => {
  try {
    // Extract ASINs from uploaded data
    const uploadedASINs = data.map((row) => row.asin).filter(Boolean);

    if (uploadedASINs.length === 0) {
      return { newProducts: data, duplicateCount: 0, duplicateASINs: [] };
    }

    // Batch size - Supabase `.in()` can handle ~100-200 items safely
    const BATCH_SIZE = 100;
    const existingASINsSet = new Set<string>();

    // Check in batches
    for (let i = 0; i < uploadedASINs.length; i += BATCH_SIZE) {
      const batch = uploadedASINs.slice(i, i + BATCH_SIZE);
      
      const { data: existingProducts, error } = await supabaseClient
        .from(tableName)
        .select('asin')
        .in('asin', batch);

      if (error) throw error;

      // Add found ASINs to Set
      existingProducts?.forEach((product: any) => {
        existingASINsSet.add(product.asin);
      });
    }

    // Filter out duplicates
    const newProducts = data.filter((row) => !existingASINsSet.has(row.asin));
    const duplicateASINs = data
      .filter((row) => existingASINsSet.has(row.asin))
      .map((row) => row.asin);

    return {
      newProducts,
      duplicateCount: duplicateASINs.length,
      duplicateASINs,
    };
  } catch (error) {
    console.error('Error checking duplicates:', error);
    // Important: throw error instead of returning all data
    throw new Error('Failed to check for duplicate ASINs. Please try again.');
  }
};

