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
  Truck
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
        label: 'USA Sellers',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/india-sellers',
        label: 'India Sellers',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/uk-sellers',
        label: 'UK Sellers',
        permission: 'manage-sellers',
        icon: Users
      },
      {
        path: '/dashboard/manage-sellers/uae-sellers',
        label: 'UAE Sellers',
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

  // --- 3. India Marketplace (✅ UPDATED WITH ALL ROUTES) ---
  {
    path: '/dashboard/india-selling',
    label: 'India Selling',
    icon: ShoppingCart,
    permission: 'india-selling',
    subRoutes: [
      {
        path: '/dashboard/india-selling/validation',
        label: 'Validation',
        permission: 'view-validation',
        icon: CheckCircle2
      },
      {
        path: '/dashboard/india-selling/admin-validation',
        label: 'Admin Approvals',
        permission: 'admin-access',
        icon: ShieldCheck
      },
      {
        path: '/dashboard/india-selling/purchases',
        label: 'Purchases',
        permission: 'view-purchases',
        icon: ShoppingBag
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
          { path: '/dashboard/india-selling/brand-checking/velvet-vista', label: 'Velvet Vista', permission: 'view-brand-checking' }
        ]
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
          { path: '/dashboard/india-selling/listing-error/velvet-vista', label: 'Velvet Vista', permission: 'view-listing-errors' }
        ]
      },
      {
        path: '/dashboard/india-selling/reorder',
        label: 'Reorder',
        permission: 'view-reorder',
        icon: RotateCcw
      }
    ]
  },

  // --- 4. Other Marketplaces ---
  {
    path: '/dashboard/uk-selling',
    label: 'UK Selling',
    icon: TrendingUp,
    permission: 'uk-selling',
    subRoutes: []
  },
  {
    path: '/dashboard/uae-selling',
    label: 'UAE Selling',
    icon: Globe,
    permission: 'uae-selling',
    subRoutes: []
  },
  {
    path: '/dashboard/flipkart',
    label: 'Flipkart',
    icon: ShoppingBag,
    permission: 'flipkart',
    subRoutes: []
  },
  {
    path: '/dashboard/jio-mart',
    label: 'JioMart',
    icon: ShoppingBag,
    permission: 'jio-mart',
    subRoutes: []
  }
];
