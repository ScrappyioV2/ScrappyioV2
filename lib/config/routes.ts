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
  PlusCircle,
  Users,
  Home,
  Truck,
  List,
  ListX
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
          { path: '/dashboard/india-selling/brand-checking/costech-ventures', label: 'Costech Ventures', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/india-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
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
          { path: '/dashboard/india-selling/listing-error/costech-ventures', label: 'Costech Ventures', permission: 'view-listing-errors' }
        ]
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
        path: '/dashboard/india-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
      {
        path: '/dashboard/india-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
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

  // --- 6. FLIPKART MARKETPLACE (✅ ALL LEVELS INCLUDED) ---
  {
    path: '/dashboard/flipkart',
    label: 'Flipkart',
    icon: ShoppingBag,
    permission: 'flipkart',
    subRoutes: [
      {
        path: '/dashboard/flipkart/brand-checking',
        label: 'Brand Checking',
        permission: 'view-brand-checking',
        icon: ShieldCheck,
        subRoutes: [
          // ✅ LEVEL 1: Selector Pages (with Listed/Not Listed buttons)
          { path: '/dashboard/flipkart/brand-checking/golden-aura', label: 'Golden Aura (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/rudra-retail', label: 'Rudra Retail (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/ubeauty', label: 'UBeauty (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/velvet-vista', label: 'Velvet Vista (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/dropy-ecom', label: 'Dropy Ecom (Select)', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/brand-checking/costech-ventures', label: 'Costech Ventures (Select)', permission: 'view-brand-checking' },
        ]
      },
      {
        path: '/dashboard/flipkart/listed-brand-checking',
        label: 'Listed Products',
        permission: 'view-brand-checking',
        icon: List,
        subRoutes: [
          { path: '/dashboard/flipkart/listed-brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/listed-brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/listed-brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/listed-brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/listed-brand-checking/dropy-ecom', label: 'Dropy Ecom', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/listed-brand-checking/costech-ventures', label: 'Costech Ventures', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/flipkart/not-listed-brand-checking',
        label: 'Not Listed Products',
        permission: 'view-brand-checking',
        icon: ListX,
        subRoutes: [
          { path: '/dashboard/flipkart/not-listed-brand-checking/golden-aura', label: 'Golden Aura', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/not-listed-brand-checking/rudra-retail', label: 'Rudra Retail', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/not-listed-brand-checking/ubeauty', label: 'UBeauty', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/not-listed-brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/not-listed-brand-checking/dropy-ecom', label: 'Dropy Ecom', permission: 'view-brand-checking' },
          { path: '/dashboard/flipkart/not-listed-brand-checking/costech-ventures', label: 'Costech Ventures', permission: 'view-brand-checking' }
        ]
      },
      {
        path: '/dashboard/flipkart/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
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
        path: '/dashboard/flipkart/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      },
      {
        path: '/dashboard/flipkart/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
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
  }
];
