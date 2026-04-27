import { type LucideIcon } from 'lucide-react';

// --- Existing Domain Types (Product, Seller) ---
export type Product = {
  id: string;
  asin?: string;
  product_name?: string;
  brand?: string;
  seller_name?: string;
  marketplace: string;
  funnel_stage: string;
  brand_status?: string;
  listing_status?: string;
  purchase_status?: string;
};

export type Seller = {
  id: string;
  seller_name: string;
  merchant_token: string;
  marketplace: string;
  profile_link: string;
  page_number: number;
  filter_type: string;
  badge?: string;
  copied_status: boolean;
  total_products: number;
  scraping_progress: number;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// --- New Authentication & Routing Types ---

export type PermissionKey =
  // Menu Groups (Parent Access)
  | 'manage-sellers'
  | 'usa-selling'
  | 'india-selling'
  | 'uk-selling'
  | 'uae-selling'
  | 'flipkart'
  | 'jio-mart'
  | 'dropy'

  // Specific Page Permissions (Granular)
  | 'view-brand-checking'
  | 'view-validation'
  | 'view-listing-errors'
  | 'view-purchases'
  | 'view-reorder'
  | 'view-tracking'
  | 'view-restock'
  | 'view-price-tracker'

  // System
  | 'admin-access'
  | 'public';

export type AppRoute = {
  path: string;
  label: string;
  icon?: LucideIcon;
  permission: PermissionKey;
  subRoutes?: AppRoute[];
  exactMatch?: boolean;
};

// Add to existing file

export interface FlipkartProduct {
  id: string;
  asin: string;
  product_name?: string;
  brand?: string;
  monthly_unit?: number;
  funnel?: 'HD' | 'LD' | 'DP';
  seller_tag?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FlipkartValidation extends FlipkartProduct {
  inr_purchase?: number;
  inr_sold?: number;
  profit?: number;
  profit_percentage?: number;
  roi?: number;
  judgement?: string;
  admin_status?: 'pending' | 'approved' | 'rejected';
}

export interface FlipkartTracking {
  id: string;
  asin: string;
  product_name?: string;
  seller_tag?: string;
  status?: 'tracking' | 'invoice' | 'checking' | 'shipment' | 'restock' | 'vyapar';
  journey_number?: number;
  created_at?: string;
  updated_at?: string;
}
