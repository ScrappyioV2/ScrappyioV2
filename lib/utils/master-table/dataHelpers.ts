'use client';

/* =========================
   DB COLUMN CONFIG
========================= */

const DB_COLUMNS = new Set([
  'asin',
  'link',
  'amz_link',
  'product_name',
  'remark',
  'brand',
  'price',
  'monthly_unit',
  'monthly_sales',
  'bsr',
  'seller',
  'category',
  'dimensions',
  'weight',
  'weight_unit',
  'sku',
  // Keepa category columns (Flipkart)
  'category_root',
  'category_sub',
  'category_child',
  'category_tree',
  'upc',
  'ean',
]);

const BLOCKED_COLUMNS = new Set([
  'id',
  'display_number',
  'created_at',
  'updated_at',
]);

const NUMERIC_COLUMNS = new Set([
  'price',
  'monthly_unit',
  'monthly_sales',
  'bsr',
  'seller',
]);

/* =========================
   HELPERS
========================= */

const normalizeHeaderToSnakeCase = (header: string) => {
  return header
    .trim()
    .toLowerCase()
    .replace(/[%]/g, '')
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const parseWeight = (value: any): { weight: number | null; unit: string } => {
  if (value === null || value === undefined || value === '') {
    return { weight: null, unit: 'kg' };
  }

  if (typeof value === 'number') {
    return { weight: value, unit: 'kg' };
  }

  if (typeof value !== 'string') {
    return { weight: null, unit: 'kg' };
  }

  const text = value.trim();

  // Extract number
  const numMatch = text.match(/[\d.]+/);
  if (!numMatch) {
    return { weight: null, unit: 'kg' };
  }

  const weight = parseFloat(numMatch[0]);

  // Extract unit (everything after the number, trimmed)
  const unitMatch = text.replace(/[\d.\s]+/, '').trim();
  const unit = unitMatch || 'kg'; // Use extracted unit or default to 'kg'

  return {
    weight: isNaN(weight) ? null : Number(weight.toFixed(3)),
    unit: unit,
  };
};



/* =========================
   MAIN NORMALIZER
========================= */

export const normalizeDataForDB = (rows: any[]) => {
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object') return null;

      const normalizedRow: any = {};

      Object.entries(row).forEach(([rawKey, value]) => {
        let dbKey = normalizeHeaderToSnakeCase(rawKey);

        // ---- ALIASES FROM JUNGLE SCOUT ----

        // Monthly Units
        if (dbKey === 'monthly_units') dbKey = 'monthly_unit';
        if (dbKey === 'monthly_units_sold') dbKey = 'monthly_unit';

        // Monthly Sales / Revenue
        if (dbKey === 'monthly_revenue') dbKey = 'monthly_sales';
        if (dbKey === 'monthly_sales') dbKey = 'monthly_sales';

        // Sellers count
        if (dbKey === 'seller_count') dbKey = 'seller';
        if (dbKey === 'sellers') dbKey = 'seller';
        if (dbKey === 'no_of_sellers') dbKey = 'seller';
        if (dbKey === 'no_of_seller') dbKey = 'seller';

        // Dimensions (keep as-is, just normalize)
        if (dbKey === 'dimension') dbKey = 'dimensions';
        if (dbKey === 'dimensions') dbKey = 'dimensions';
        if (dbKey === 'skus') dbKey = 'sku';

        // ---- ALIASES FROM KEEPA EXPORT ----

        // "Name" → product_name
        if (dbKey === 'name') dbKey = 'product_name';

        // "Categories: Root" → category_root (normalizeHeaderToSnakeCase gives "categories_root")
        if (dbKey === 'categories_root') dbKey = 'category_root';
        // "Categories: Sub" → category_sub
        if (dbKey === 'categories_sub') dbKey = 'category_sub';
        // "Categories: Tree" → category_tree
        if (dbKey === 'categories_tree') dbKey = 'category_tree';

        // ---- BARCODE ALIASES FROM KEEPA ----
        if (dbKey === 'product_codes_upc') dbKey = 'upc';
        if (dbKey === 'product_codes_ean') dbKey = 'ean';
        if (dbKey === 'product_codes_gtin') dbKey = 'ean'; // GTIN maps to EAN

        // Amazon link – single source of truth
        if (
          dbKey === 'link' ||
          dbKey === 'amazon_link' ||
          dbKey === 'product_url'
        ) {
          dbKey = 'amz_link';
        }

        if (BLOCKED_COLUMNS.has(dbKey)) return;
        if (!DB_COLUMNS.has(dbKey)) return;

        // WEIGHT (STRICT)
        if (dbKey === 'weight') {
          const parsed = parseWeight(value);
          normalizedRow.weight = parsed.weight;
          normalizedRow.weight_unit = parsed.unit;
          return;
        }

        // OTHER NUMERIC COLUMNS
        if (NUMERIC_COLUMNS.has(dbKey)) {
          const num = Number(
            typeof value === 'string'
              ? value.replace(/[^0-9.]/g, '')
              : value
          );
          normalizedRow[dbKey] = isNaN(num) ? null : num;
          return;
        }

        // TEXT COLUMNS
        normalizedRow[dbKey] =
          value === undefined || value === null
            ? null
            : String(value).trim();
      });

      // ASIN REQUIRED
      if (!normalizedRow.asin) return null;

      // DEFAULT UNIT
      if (!normalizedRow.weight_unit) {
        normalizedRow.weight_unit = 'kg';
      }

      // DERIVE category_child from category_tree if not explicitly set
      if (normalizedRow.category_tree && !normalizedRow.category_child) {
        const parts = normalizedRow.category_tree.split('›').map((s: string) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          normalizedRow.category_child = parts[parts.length - 1];
        }
      }

      // AUTO-GENERATE LINK IF EMPTY
      if (!normalizedRow.amz_link || normalizedRow.amz_link.trim() === '') {
        normalizedRow.amz_link = `www.amazon.com/dp/${normalizedRow.asin}`;
      }

      // if (!normalizedRow.link || normalizedRow.link.trim() === '') {
      //   normalizedRow.link = `www.amazon.com/dp/${normalizedRow.asin}`;
      // }

      // ✅ EXPLICIT RETURN - Only allowed DB columns
      const safeRow: any = {};
      DB_COLUMNS.forEach(col => {
        if (normalizedRow.hasOwnProperty(col)) {
          safeRow[col] = normalizedRow[col];
        }
      });

      return safeRow;

    })
    .filter(Boolean);
};