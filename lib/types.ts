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
  
  // Specific Page Permissions (Granular)
  | 'view-brand-checking'
  | 'view-validation'
  | 'view-listing-errors'
  | 'view-purchases'
  | 'view-reorder'
  
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