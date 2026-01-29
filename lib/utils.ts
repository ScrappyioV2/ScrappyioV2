import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ========================================
// EXISTING FUNCTION (Keep as is)
// ========================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// NEW FUNCTIONS FOR BRAND CHECKING
// ============================================

/**
 * Generate Amazon Seller Central Link from ASIN
 * Converts .in to .com for USA marketplace
 */
export const generateAmazonLink = (asin: string): string => {
  if (!asin) return '';
  return `https://sellercentral.amazon.com/hz/approvalrequest/restrictions/approve?asin=${asin}&itemcondition=new`;
};

/**
 * Determine category based on monthly_unit value
 * Rules:
 * - monthly_unit > 60 → High Demand (HD)
 * - monthly_unit 1-60 → Low Demand (LD)
 * - monthly_unit = 0 or null → Dropshipping (DP)
 */
export const determineCategory = (monthlyUnit: number | null): {
  category: 'high_demand' | 'low_demand' | 'dropshipping';
  funnel: 'HD' | 'LD' | 'DP';
} => {
  if (!monthlyUnit || monthlyUnit === 0) {
    return { category: 'dropshipping', funnel: 'DP' };
  } else if (monthlyUnit > 60) {
    return { category: 'high_demand', funnel: 'HD' };
  } else {
    return { category: 'low_demand', funnel: 'LD' };
  }
};

/**
 * Format table name helper
 */
export const getTableName = (sellerId: number, category: string): string => {
  return `usa_seller_${sellerId}_${category.replace('-', '_')}`;
};

// ============================================
// SELLER & TRACKING CONFIGURATION
// ============================================

export const SELLER_TAG_MAPPING = {
  'GR': 1, // Golden Aura
  'RR': 2, // Rudra Retail
  'UB': 3, // UBeauty
  'VV': 4  // Velvet Vista
} as const;

export type SellerTag = keyof typeof SELLER_TAG_MAPPING;

export const TRACKING_STAGES = {
  MAIN: 'main_file',      // The original usa_tracking_seller_X tables
  INVOICE: 'usa_invoice',
  CHECKING: 'usa_checking',
  SHIPMENT: 'usa_shipment',
  RESTOCK: 'usa_restock',
  VYAPAR: 'usa_vyapar'    // Admin only
} as const;

export type TrackingStage = keyof typeof TRACKING_STAGES;

/**
 * Helper to get the table name for a specific tracking stage and seller
 * Example: getTrackingTableName('INVOICE', 1) -> 'usa_invoice_seller_1'
 */
export const getTrackingTableName = (stage: TrackingStage, sellerId: number): string => {
  const prefix = TRACKING_STAGES[stage];

  // Handle the discrepancy where "MAIN" tables are named 'usa_tracking_seller_X'
  // but the new tables are named 'usa_invoice_seller_X'
  if (stage === 'MAIN') {
    return `usa_tracking_seller_${sellerId}`;
  }

  return `${prefix}_seller_${sellerId}`;
};

/**
 * Helper to resolve seller ID from a tag string
 * Example: resolveSellerId('GR') -> 1
 */
export const resolveSellerId = (tag: string): number | null => {
  // Normalize input (uppercase and trim)
  const cleanTag = tag?.toUpperCase().trim() as SellerTag;
  return SELLER_TAG_MAPPING[cleanTag] || null;
};