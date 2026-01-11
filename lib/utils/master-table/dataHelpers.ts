'use client';

/* =========================
   DB COLUMN CONFIG
========================= */

const DB_COLUMNS = new Set([
  'asin',
  'link',
  'product_name',
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

  const text = value.toLowerCase().trim();

  const numMatch = text.match(/[\d.]+/);
  if (!numMatch) {
    return { weight: null, unit: 'kg' };
  }

  let weight = parseFloat(numMatch[0]);

  // grams → kg
  if (
    text.includes('g') ||
    text.includes('gm') ||
    text.includes('gram')
  ) {
    weight = weight / 1000;
  }

  // kg stays kg
  if (text.includes('kg')) {
    weight = weight;
  }

  return {
    weight: isNaN(weight) ? null : Number(weight.toFixed(3)),
    unit: 'kg',
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

        if (dbKey === 'monthly_units') dbKey = 'monthly_unit';
        if (dbKey === 'seller_count') dbKey = 'seller';

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

      return normalizedRow;
    })
    .filter(Boolean);
};
