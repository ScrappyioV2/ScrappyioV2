import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Normalize raw uploaded data for DB insertion
 */
const toSafeString = (value: any): string | null => {
  if (value === null || value === undefined) return null
  return String(value).trim() || null
}

/**
 * Extract numeric weight and unit from strings like "0.99 lb", "2.5 kg", etc.
 */
const parseWeight = (value: any): { weight: number | null; unit: string | null } => {
  if (!value) return { weight: null, unit: null };
  
  const str = String(value).trim().toLowerCase();
  
  // Match patterns like "0.99 lb", "2.5kg", "1.2 pounds", etc.
  const match = str.match(/^([\d.]+)\s*(lb|lbs|pound|pounds|kg|kilogram|kilograms|g|gram|grams|oz|ounce|ounces)?$/i);
  
  if (match) {
    const weight = parseFloat(match[1]);
    const unit = match[2] || 'lb'; // Default to lb if no unit specified
    
    // Normalize units
    const normalizedUnit = 
      ['lb', 'lbs', 'pound', 'pounds'].includes(unit.toLowerCase()) ? 'lb' :
      ['kg', 'kilogram', 'kilograms'].includes(unit.toLowerCase()) ? 'kg' :
      ['g', 'gram', 'grams'].includes(unit.toLowerCase()) ? 'g' :
      ['oz', 'ounce', 'ounces'].includes(unit.toLowerCase()) ? 'oz' :
      'lb';
    
    return { weight, unit: normalizedUnit };
  }
  
  // If it's just a number without unit
  const numValue = parseFloat(str);
  if (!isNaN(numValue)) {
    return { weight: numValue, unit: 'lb' };
  }
  
  return { weight: null, unit: null };
};

export const normalizeDataForDB = (rows: any[]) => {
  console.log('📥 Raw data received:', rows.length, 'rows');
  console.log('🔍 First row:', rows[0]);
  
  const normalized = rows
    .map((row) => {
      // Check if ASIN exists
      if (!row.asin && !row.ASIN) {
        console.log('⚠️ Row missing ASIN:', row);
        return null;
      }

      // Parse weight
      const weightData = parseWeight(row.weight || row.Weight);

      // Parse price - remove $ symbol if present
      const parsePrice = (value: any): number | null => {
        if (!value) return null;
        const str = String(value).replace(/[$,]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      // Parse monthly units - handle "Monthly Units Sold" column
      const parseMonthlyUnits = (row: any): number | null => {
        const value = row.monthly_unit || 
                      row['Monthly Units Sold'] || 
                      row['Monthly Unit'] ||
                      row['Monthly Units'];
        if (!value || value === '') return null;
        const num = parseFloat(String(value).replace(/[,]/g, ''));
        return isNaN(num) ? null : num;
      };

      // Parse monthly sales - handle "Monthly Revenue" column  
      const parseMonthlyRevenue = (row: any): number | null => {
        const value = row.monthly_sales || 
                      row['Monthly Revenue'] ||
                      row['Monthly Sales'];
        if (!value || value === '') return null;
        const str = String(value).replace(/[$,]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      // Parse sellers - handle "No. of Sellers" column
      const parseSellers = (row: any): number | null => {
        const value = row.seller || 
                      row['No. of Sellers'] ||
                      row['Sellers'] ||
                      row['No of Sellers'];
        if (!value || value === '') return null;
        const num = parseFloat(String(value));
        return isNaN(num) ? null : num;
      };

      // Parse BSR
      const parseBSR = (row: any): number | null => {
        const value = row.bsr || row.BSR;
        if (!value || value === '') return null;
        const num = parseFloat(String(value).replace(/[,]/g, ''));
        return isNaN(num) ? null : num;
      };

      return {
        asin: toSafeString(row.asin || row.ASIN),
        link: toSafeString(row.link || row.Link),
        product_name: toSafeString(row.product_name || row['Product Name']),
        brand: toSafeString(row.brand || row.Brand),
        seller: parseSellers(row),
        category: toSafeString(row.category || row.Category),
        dimensions: toSafeString(row.dimensions || row.Dimensions),
        weight: weightData.weight,
        weight_unit: weightData.unit,
        price: parsePrice(row.price || row.Price),
        monthly_unit: parseMonthlyUnits(row),
        monthly_sales: parseMonthlyRevenue(row),
        bsr: parseBSR(row),
        created_at: new Date().toISOString(),
      };
    })
    .filter((row) => row !== null && row.asin);

  console.log('✅ Normalized data:', normalized.length, 'rows');
  console.log('📦 First normalized row:', normalized[0]);
  
  return normalized;
}


/**
 * Filters out duplicate ASINs from the uploaded data by checking against existing database records
 */
export async function filterDuplicateASINs(
  products: any[],
  tableName: string,
  supabase: any
): Promise<{ newProducts: any[]; duplicateCount: number }> {
  try {
    console.log('🔍 Products received:', products.length);
    console.log('📦 First product:', products[0]);
    
    const uploadedASINs = products.map(product => product.asin).filter(Boolean);
    
    console.log('📋 Uploaded ASINs:', uploadedASINs.length);
    console.log('🏷️ First 5 ASINs:', uploadedASINs.slice(0, 5));
    
    if (uploadedASINs.length === 0) {
      console.log('⚠️ WARNING: No ASINs found!');
      return { newProducts: products, duplicateCount: 0 };
    }

    const batchSize = 100;
    const existingASINs = new Set<string>();

    for (let i = 0; i < uploadedASINs.length; i += batchSize) {
      const batch = uploadedASINs.slice(i, i + batchSize);
      
      console.log(`🔎 Checking batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(uploadedASINs.length / batchSize)}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('asin')
        .in('asin', batch);

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Existing ASINs in DB:', data?.length || 0);

      data?.forEach((record: any) => {
        if (record.asin) {
          existingASINs.add(record.asin);
        }
      });
    }

    console.log('📊 Total existing ASINs in database:', existingASINs.size);

    const newProducts = products.filter(product => !existingASINs.has(product.asin));
    const duplicateCount = products.length - newProducts.length;

    console.log('✨ New products to insert:', newProducts.length);
    console.log('🔄 Duplicate products skipped:', duplicateCount);

    return { newProducts, duplicateCount };
  } catch (error) {
    console.error('💥 Error in filterDuplicateASINs:', error);
    throw error;
  }
}
