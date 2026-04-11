import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


// ========================================
// EXISTING FUNCTION (Keep as is)
// ========================================


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ensureAbsoluteUrl = (url: string): string => {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};


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
 * Determine demand sorting category based on monthly_unit value
 * NEW Logic (RS/DP):
 * - monthly_unit >= 5 → Restock (RS)
 * - monthly_unit < 5 or null → Dropshipping (DP)
 */
export const determineDemandSortingCategory = (monthlyUnit: number | null): {
  category: 'restock' | 'dropshipping';
  funnel: 'RS' | 'DP';
} => {
  if (monthlyUnit != null && monthlyUnit >= 5) {
    return { category: 'restock', funnel: 'RS' };
  }
  return { category: 'dropshipping', funnel: 'DP' };
};


/**
 * Format table name helper
 */
export const getTableName = (sellerId: number, category: string): string => {
  return `usa_seller_${sellerId}_${category.replace('-', '_')}`;
};


/**
 * Helper for India demand sorting table names
 */
export const getIndiaDemandSortingTableName = (sellerId: number): string => {
  return `india_demand_sorting_seller_${sellerId}`;
};


// ============================================
// UNIFIED TRACKING OPS CONFIGURATION
// ============================================

export type OpsType = 'tracking' | 'invoice' | 'checking' | 'shipment' | 'restock' | 'vyapar' | 'reorder';

export const OPS_TYPE_MAP: Record<string, OpsType> = {
  MAIN: 'tracking',
  INVOICE: 'invoice',
  CHECKING: 'checking',
  SHIPMENT: 'shipment',
  RESTOCK: 'restock',
  VYAPAR: 'vyapar',
  REORDER: 'reorder',
};

/**
 * Helper to map a legacy stage name (MAIN/INVOICE/CHECKING/etc) to the
 * `ops_type` value used in the unified `tracking_ops` table.
 */
export function stageToOpsType(stage: string): OpsType {
  return OPS_TYPE_MAP[stage] || (stage.toLowerCase() as OpsType);
}


// ============================================
// SELLER & TRACKING CONFIGURATION
// ============================================


export const SELLER_TAG_MAPPING = {
  'GR': 1, // Golden Aura
  'RR': 2, // Rudra Retail
  'UB': 3, // UBeauty
  'VV': 4, // Velvet Vista
  'DE': 5, // Dropy Ecom
  'CV': 6, // Costech Ventures
  'MV': 7, // Maverick
  'KL': 8  // Kalash
} as const;


export type SellerTag = keyof typeof SELLER_TAG_MAPPING;


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


/**
 * Helper to resolve seller ID from a tag string
 */
export const resolveSellerId = (tag: string): number | null => {
  const cleanTag = tag?.toUpperCase().trim() as SellerTag;
  return SELLER_TAG_MAPPING[cleanTag] || null;
};

// ============================================
// FUNNEL BADGE STYLING (Shared across all components)
// ============================================

export const getFunnelBadgeStyle = (funnel: string | null): { display: string; color: string } => {
  if (!funnel) return { display: '-', color: '' };

  const isRS = funnel === 'HD' || funnel === 'LD' || funnel === 'RS';
  const isDP = funnel === 'DP';

  return {
    display: isRS ? 'RS' : funnel,
    color: isRS
      ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg border border-emerald-600/30'
      : isDP
        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg border border-amber-500/30'
        : 'bg-slate-600 text-white',
  };
};
//C:\Users\Admin\Desktop\Project2\ScrappyioV2-main\lib\utils.ts