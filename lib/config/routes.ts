import {
  LayoutDashboard,
  Globe,
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  ClipboardCheck,
  PlusCircle,
  Users,
  Home,
  Truck,
  Package,
  Cog
} from 'lucide-react';
import { AppRoute } from '@/lib/types';



export const APP_ROUTES: AppRoute[] = [
  // --- 0. MAIN DASHBOARD ---
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: Home,
    permission: 'public',
    subRoutes: []
  },



  // --- 1. General Management ---
  {
    path: '/dashboard/manage-sellers',
    label: 'Manage Sellers',
    icon: LayoutDashboard,
    permission: 'manage-sellers',
    subRoutes: [
      {
        path: '/dashboard/manage-sellers/add-seller',
        label: 'Link Generator',
        permission: 'manage-sellers',
        icon: PlusCircle
      },
      {
        path: '/dashboard/manage-sellers/usa-sellers',
        label: 'USA Master',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/india-sellers',
        label: 'India Master',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/flipkart-sellers',
        label: 'Flipkart Master',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/uk-sellers',
        label: 'UK Master',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/uae-sellers',
        label: 'UAE Master',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/dropy',
        label: 'Dropy Master',
        permission: 'manage-sellers',
        icon: Users
      }
    ]
  },



  // --- 2. USA Marketplace ---
  {
    path: '/dashboard/usa-selling',
    label: 'USA Selling',
    icon: Globe,
    permission: 'usa-selling',
    subRoutes: [
      {
        path: '/dashboard/usa-selling/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          { path: '/dashboard/usa-selling/brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/usa-selling/brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/usa-selling/brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/usa-selling/brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/usa-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/usa-selling/listing-error',
        label: 'Listing Errors',
        permission: 'view-listing-errors',
        icon: XCircle,
        subRoutes: [
          { path: '/dashboard/usa-selling/listing-error/golden-aura', label: 'Golden Aura', permission: 'view-listing-errors' },
          { path: '/dashboard/usa-selling/listing-error/rudra-retail', label: 'Rudra Retail', permission: 'view-listing-errors' },
          { path: '/dashboard/usa-selling/listing-error/ubeauty', label: 'UBeauty', permission: 'view-listing-errors' },
          { path: '/dashboard/usa-selling/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' }
        ]
      },
      {
        path: '/dashboard/usa-selling/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
      },
      {
        path: '/dashboard/usa-selling/tracking',
        label: 'Tracking',
        permission: 'view-tracking',
        icon: Truck
      },
      {
        path: '/dashboard/usa-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
      {
        path: '/dashboard/usa-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      }
    ]
  },



  // --- 3. India Marketplace ---
  {
    path: '/dashboard/india-selling',
    label: 'India Selling',
    icon: ShoppingCart,
    permission: 'india-selling',
    subRoutes: [
      {
        path: '/dashboard/india-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      },
      {
        path: '/dashboard/india-selling/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          { path: '/dashboard/india-selling/brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/dropy-ecom', label: 'Dropy Ecom', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/costech-ventures', label: 'Costech Ventures', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/maverick', label: 'Maverick', permission: 'view-brand-checking' },
          { path: '/dashboard/india-selling/brand-checking/kalash', label: 'Kalash', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/india-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/india-selling/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
      },
      {
        path: '/dashboard/india-selling/tracking',
        label: 'Tracking',
        permission: 'view-tracking',
        icon: Truck
      },
      {
        path: '/dashboard/india-selling/listing-error',
        label: 'Listing Errors',
        permission: 'view-listing-errors',
        icon: XCircle,
        subRoutes: [
          { path: '/dashboard/india-selling/listing-error/golden-aura', label: 'Golden Aura', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/rudra-retail', label: 'Rudra Retail', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/ubeauty', label: 'UBeauty', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/dropy-ecom', label: 'Dropy Ecom', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/costech-ventures', label: 'Costech Ventures', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/maverick', label: 'Maverick', permission: 'view-listing-errors' },
          { path: '/dashboard/india-selling/listing-error/kalash', label: 'Kalash', permission: 'view-listing-errors' }
        ]
      },
      // ✅ NEW — Restock (Inbound pipeline final stage, seller-wise)
      {
        path: '/dashboard/india-selling/restock',
        label: 'Restock',
        permission: 'view-restock',    // ← CHANGED from 'view-tracking'
        icon: Package,
        subRoutes: [
          { path: '/dashboard/india-selling/restock/golden-aura', label: 'Golden Aura', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/rudra-retail', label: 'Rudra Retail', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/ubeauty', label: 'UBeauty', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/velvet-vista', label: 'Velvet Vista', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/dropy-ecom', label: 'Dropy Ecom', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/costech-ventures', label: 'Costech Ventures', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/maverick', label: 'Maverick', permission: 'view-restock' },
          { path: '/dashboard/india-selling/restock/kalash', label: 'Kalash', permission: 'view-restock' }
        ]
      },
      {
        path: '/dashboard/india-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
    ]
  },



  // --- 4. UK Marketplace ---
  {
    path: '/dashboard/uk-selling',
    label: 'UK Selling',
    icon: TrendingUp,
    permission: 'uk-selling',
    subRoutes: [
      {
        path: '/dashboard/uk-selling/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          { path: '/dashboard/uk-selling/brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/uk-selling/brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/uk-selling/brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/uk-selling/brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/uk-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/uk-selling/listing-error',
        label: 'Listing Errors',
        permission: 'view-listing-errors',
        icon: XCircle,
        subRoutes: [
          { path: '/dashboard/uk-selling/listing-error/golden-aura', label: 'Golden Aura', permission: 'view-listing-errors' },
          { path: '/dashboard/uk-selling/listing-error/rudra-retail', label: 'Rudra Retail', permission: 'view-listing-errors' },
          { path: '/dashboard/uk-selling/listing-error/ubeauty', label: 'UBeauty', permission: 'view-listing-errors' },
          { path: '/dashboard/uk-selling/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' }
        ]
      },
      {
        path: '/dashboard/uk-selling/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
      },
      {
        path: '/dashboard/uk-selling/tracking',
        label: 'Tracking',
        permission: 'view-tracking',
        icon: Truck
      },
      {
        path: '/dashboard/uk-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
      {
        path: '/dashboard/uk-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      }
    ]
  },



  // --- 5. UAE Marketplace ---
  {
    path: '/dashboard/uae-selling',
    label: 'UAE Selling',
    icon: Globe,
    permission: 'uae-selling',
    subRoutes: [
      {
        path: '/dashboard/uae-selling/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          { path: '/dashboard/uae-selling/brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/uae-selling/brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/uae-selling/brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/uae-selling/brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/uae-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/uae-selling/listing-error',
        label: 'Listing Errors',
        permission: 'view-listing-errors',
        icon: XCircle,
        subRoutes: [
          { path: '/dashboard/uae-selling/listing-error/golden-aura', label: 'Golden Aura', permission: 'view-listing-errors' },
          { path: '/dashboard/uae-selling/listing-error/rudra-retail', label: 'Rudra Retail', permission: 'view-listing-errors' },
          { path: '/dashboard/uae-selling/listing-error/ubeauty', label: 'UBeauty', permission: 'view-listing-errors' },
          { path: '/dashboard/uae-selling/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' }
        ]
      },
      {
        path: '/dashboard/uae-selling/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
      },
      {
        path: '/dashboard/uae-selling/tracking',
        label: 'Tracking',
        permission: 'view-tracking',
        icon: Truck
      },
      {
        path: '/dashboard/uae-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
      {
        path: '/dashboard/uae-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      }
    ]
  },


  // --- 6. FLIPKART MARKETPLACE ---
  {
    path: '/dashboard/flipkart',
    label: 'Flipkart',
    icon: ShoppingBag,
    permission: 'flipkart',
    subRoutes: [
      {
        path: '/dashboard/flipkart/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      },
      {
        path: '/dashboard/flipkart/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          { path: '/dashboard/flipkart/brand-checking/golden-aura', label: 'Golden Aura (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/rudra-retail', label: 'Rudra Retail (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/ubeauty', label: 'UBeauty (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/velvet-vista', label: 'Velvet Vista (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/dropy-ecom', label: 'Dropy Ecom (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/costech-ventures', label: 'Costech Ventures (Select)', permission: 'view-brand-checking' },
        ]
      },
      {
        path: '/dashboard/flipkart/brand-checking-review',
        label: 'Brand Checking Review',
        permission: 'view-brand-checking',
        icon: ClipboardCheck,
        subRoutes: [
          { path: '/dashboard/flipkart/brand-checking-review/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking-review/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking-review/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking-review/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking-review/dropy-ecom', label: 'Dropy Ecom', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking-review/costech-ventures', label: 'Costech Ventures', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/flipkart/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/flipkart/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
      },
      {
        path: '/dashboard/flipkart/tracking',
        label: 'Tracking',
        permission: 'view-tracking',
        icon: Truck
      },
      {
        path: '/dashboard/flipkart/listing-error',
        label: 'Listing Errors',
        permission: 'view-listing-errors',
        icon: XCircle,
        subRoutes: [
          { path: '/dashboard/flipkart/listing-error/golden-aura', label: 'Golden Aura', permission: 'view-listing-errors' },
          { path: '/dashboard/flipkart/listing-error/rudra-retail', label: 'Rudra Retail', permission: 'view-listing-errors' },
          { path: '/dashboard/flipkart/listing-error/ubeauty', label: 'UBeauty', permission: 'view-listing-errors' },
          { path: '/dashboard/flipkart/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' },
          { path: '/dashboard/flipkart/listing-error/dropy-ecom', label: 'Dropy Ecom', permission: 'view-listing-errors' },
          { path: '/dashboard/flipkart/listing-error/costech-ventures', label: 'Costech Ventures', permission: 'view-listing-errors' }
        ]
      },
      {
        path: '/dashboard/flipkart/restock',
        label: 'Restock',
        permission: 'view-restock',
        icon: Package,
        subRoutes: [
          { path: '/dashboard/flipkart/restock/golden-aura', label: 'Golden Aura', permission: 'view-restock' },
          { path: '/dashboard/flipkart/restock/rudra-retail', label: 'Rudra Retail', permission: 'view-restock' },
          { path: '/dashboard/flipkart/restock/ubeauty', label: 'UBeauty', permission: 'view-restock' },
          { path: '/dashboard/flipkart/restock/velvet-vista', label: 'Velvet Vista', permission: 'view-restock' },
          { path: '/dashboard/flipkart/restock/dropy-ecom', label: 'Dropy Ecom', permission: 'view-restock' },
          { path: '/dashboard/flipkart/restock/costech-ventures', label: 'Costech Ventures', permission: 'view-restock' }
        ]
      },
      {
        path: '/dashboard/flipkart/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
    ]
  },



  // --- 7. JioMart ---
  {
    path: '/dashboard/jio-mart',
    label: 'JioMart',
    icon: ShoppingBag,
    permission: 'jio-mart',
    subRoutes: []
  },

  // --- 8. SKU Generator ---
  {
    path: '/dashboard/sku-generator',
    label: 'SKU Generator',
    icon: Cog,
    permission: 'view-validation',
  }
];
