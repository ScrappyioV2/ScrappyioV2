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
  'VV': 4, // Velvet Vista
  'DE': 5, // Dropy Ecom
  'CV': 6  // Costech Ventures
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

export const getIndiaTrackingTableName = (stage: IndiaTrackingStage, sellerId: number): string => {
  const prefix = INDIA_TRACKING_STAGES[stage];
  if (stage === 'MAIN') {
    return `india_tracking_seller_${sellerId}`;
  }
  return `${prefix}_seller_${sellerId}`;
};


// ============================================
// UK TRACKING CONFIGURATION
// ============================================

export const UK_TRACKING_STAGES = {
  MAIN: 'main_file',
  INVOICE: 'uk_invoice',
  CHECKING: 'uk_checking',
  SHIPMENT: 'uk_shipment',
  RESTOCK: 'uk_restock',
  VYAPAR: 'uk_vyapar'
} as const;

export type UKTrackingStage = keyof typeof UK_TRACKING_STAGES;

/**
 * Helper to get UK table name for a specific tracking stage and seller
 * Example: getUKTrackingTableName('INVOICE', 1) -> 'uk_invoice_seller_1'
 */
export const getUKTrackingTableName = (stage: UKTrackingStage, sellerId: number): string => {
  const prefix = UK_TRACKING_STAGES[stage];
  
  if (stage === 'MAIN') {
    return `uk_tracking_seller_${sellerId}`;
  }
  
  return `${prefix}_seller_${sellerId}`;
};


// ============================================
// UAE TRACKING CONFIGURATION
// ============================================

export const UAE_TRACKING_STAGES = {
  MAIN: 'main_file',
  INVOICE: 'uae_invoice',
  CHECKING: 'uae_checking',
  SHIPMENT: 'uae_shipment',
  RESTOCK: 'uae_restock',
  VYAPAR: 'uae_vyapar'
} as const;

export type UAETrackingStage = keyof typeof UAE_TRACKING_STAGES;

/**
 * Helper to get UAE table name for a specific tracking stage and seller
 * Example: getUAETrackingTableName('INVOICE', 1) -> 'uae_invoice_seller_1'
 */
export const getUAETrackingTableName = (stage: UAETrackingStage, sellerId: number): string => {
  const prefix = UAE_TRACKING_STAGES[stage];
  
  if (stage === 'MAIN') {
    return `uae_tracking_seller_${sellerId}`;
  }
  
  return `${prefix}_seller_${sellerId}`;
};

// ============================================
// FLIPKART CONFIGURATION
// ============================================

export const FLIPKART_SELLER_MAPPING = {
  1: { name: 'Golden Aura', badge: 'GA', color: 'bg-amber-500' },
  2: { name: 'Rudra Retail', badge: 'RR', color: 'bg-blue-500' },
  3: { name: 'UBeauty', badge: 'UB', color: 'bg-purple-500' },
  4: { name: 'Velvet Vista', badge: 'VV', color: 'bg-pink-500' },
  5: { name: 'Dropy Ecom', badge: 'DE', color: 'bg-green-500' },
  6: { name: 'Costech Ventures', badge: 'CV', color: 'bg-indigo-500' },
} as const;

export const FLIPKART_SELLER_TAG_MAPPING = {
  'GA': 1,
  'RR': 2,
  'UB': 3,
  'VV': 4,
  'DE': 5,
  'CV': 6,
} as const;

export type FlipkartSellerTag = keyof typeof FLIPKART_SELLER_TAG_MAPPING;
export type FlipkartSellerId = 1 | 2 | 3 | 4 | 5 | 6;

export function getFlipkartSellerInfo(sellerId: FlipkartSellerId) {
  return FLIPKART_SELLER_MAPPING[sellerId];
}

export function getFlipkartSellerIdFromTag(tag: FlipkartSellerTag): FlipkartSellerId {
  return FLIPKART_SELLER_TAG_MAPPING[tag];
}

export const FLIPKART_TRACKING_STAGES = {
  MAIN: 'main_file',
  INVOICE: 'flipkart_invoice',
  CHECKING: 'flipkart_checking',
  SHIPMENT: 'flipkart_shipment',
  RESTOCK: 'flipkart_restock',
  VYAPAR: 'flipkart_vyapar'
} as const;

export type FlipkartTrackingStage = keyof typeof FLIPKART_TRACKING_STAGES;

export const getFlipkartTrackingTableName = (
  stage: FlipkartTrackingStage,
  sellerId: number  // ✅ Change from FlipkartSellerId to number
): string => {
  const prefix = FLIPKART_TRACKING_STAGES[stage];
  if (stage === 'MAIN') {
    return `flipkart_tracking_seller_${sellerId}`;
  }
  return `${prefix}_seller_${sellerId}`;
};

export function getFlipkartBrandCheckingTableName(sellerId: FlipkartSellerId): string {
  return `flipkart_brand_checking_seller_${sellerId}`;
}

export function getFlipkartCategoryTableName(
  sellerId: FlipkartSellerId,
  category: 'high_demand' | 'low_demand' | 'dropshipping' | 'not_approved' | 'reject'
): string {
  return `flipkart_seller_${sellerId}_${category}`;
}

export function getFlipkartListingErrorTableName(
  sellerId: FlipkartSellerId,
  status: 'pending' | 'done' | 'error' | 'removed' | 'movement_history'
): string {
  return `flipkart_listing_error_seller_${sellerId}_${status}`;
}

// ============================================
// LEGACY: Keep for backward compatibility
// ============================================

export const TRACKING_STAGES = USA_TRACKING_STAGES;
export type TrackingStage = USATrackingStage;

/**
 * @deprecated Use getUSATrackingTableName or getIndiaTrackingTableName instead
 */
export const getTrackingTableName = getUSATrackingTableName;

/**
 * Helper to resolve seller ID from a tag string
 */
export const resolveSellerId = (tag: string): number | null => {
  const cleanTag = tag?.toUpperCase().trim() as SellerTag;
  return SELLER_TAG_MAPPING[cleanTag] || null;
};
//C:\Users\Admin\Desktop\Project2\ScrappyioV2-main\lib\utils.ts