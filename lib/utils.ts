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


// ============================================
// USA TRACKING CONFIGURATION
// ============================================


export const USA_TRACKING_STAGES = {
  MAIN: 'main_file',
  INVOICE: 'usa_invoice',
  CHECKING: 'usa_checking',
  SHIPMENT: 'usa_shipment',
  RESTOCK: 'usa_restock',
  VYAPAR: 'usa_vyapar'
} as const;


export type USATrackingStage = keyof typeof USA_TRACKING_STAGES;


/**
 * Helper to get USA table name for a specific tracking stage and seller
 * Example: getUSATrackingTableName('INVOICE', 1) -> 'usa_invoice_seller_1'
 */
export const getUSATrackingTableName = (stage: USATrackingStage, sellerId: number): string => {
  const prefix = USA_TRACKING_STAGES[stage];
  
  if (stage === 'MAIN') {
    return `usa_tracking_seller_${sellerId}`;
  }
  
  return `${prefix}_seller_${sellerId}`;
};


// ============================================
// INDIA TRACKING CONFIGURATION
// ============================================


export const INDIA_TRACKING_STAGES = {
  MAIN: 'main_file',
  INVOICE: 'india_invoice',
  CHECKING: 'india_checking',
  SHIPMENT: 'india_shipment',
  RESTOCK: 'india_restock',
  VYAPAR: 'india_vyapar'
} as const;


export type IndiaTrackingStage = keyof typeof INDIA_TRACKING_STAGES;


/**
 * Helper to get India table name for a specific tracking stage and seller
 * Example: getIndiaTrackingTableName('INVOICE', 1) -> 'india_invoice_seller_1'
 */
export const getIndiaTrackingTableName = (stage: IndiaTrackingStage, sellerId: number): string => {
  const prefix = INDIA_TRACKING_STAGES[stage];
  
  if (stage === 'MAIN') {
    return `india_tracking_seller_${sellerId}`;
  }
  
  return `${prefix}_seller_${sellerId}`;
};


// ============================================
// LEGACY: Keep for backward compatibility (defaults to USA)
// ============================================


export const TRACKING_STAGES = USA_TRACKING_STAGES;
export type TrackingStage = USATrackingStage;


/**
 * @deprecated Use getUSATrackingTableName or getIndiaTrackingTableName instead
 */
export const getTrackingTableName = getUSATrackingTableName;


/**
 * Helper to resolve seller ID from a tag string
 * Example: resolveSellerId('GR') -> 1
 */
export const resolveSellerId = (tag: string): number | null => {
  // Normalize input (uppercase and trim)
  const cleanTag = tag?.toUpperCase().trim() as SellerTag;
  return SELLER_TAG_MAPPING[cleanTag] || null;
};
