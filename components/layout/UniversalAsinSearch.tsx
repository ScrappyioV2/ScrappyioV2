'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Search, X, Loader2, ChevronRight, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'

// ─── CONFIG ───────────────────────────────────────────────
type SearchHit = {
    marketplace: string
    marketEmoji: string
    stage: string
    table: string
    routePath: string
    seller?: string
    subType?: string
    status?: string
    productName?: string
    order: number
}

const SELLER_MAP: Record<number, { name: string; slug: string }> = {
    1: { name: 'Golden Aura', slug: 'golden-aura' },
    2: { name: 'Rudra Retail', slug: 'rudra-retail' },
    3: { name: 'UBeauty', slug: 'ubeauty' },
    4: { name: 'Velvet Vista', slug: 'velvet-vista' },
    5: { name: 'Dropy Ecom', slug: 'dropy-ecom' },
    6: { name: 'Costech Ventures', slug: 'costech-ventures' },
}

const MARKETPLACES = [
    { key: 'india', label: 'India', emoji: '🇮🇳', prefix: 'india', routeBase: '/dashboard/india-selling', sellers: [1, 2, 3, 4, 5, 6] },
    { key: 'usa', label: 'USA', emoji: '🇺🇸', prefix: 'usa', routeBase: '/dashboard/usa-selling', sellers: [1, 2, 3, 4] },
    { key: 'uk', label: 'UK', emoji: '🇬🇧', prefix: 'uk', routeBase: '/dashboard/uk-selling', sellers: [1, 2, 3, 4] },
    { key: 'uae', label: 'UAE', emoji: '🇦🇪', prefix: 'uae', routeBase: '/dashboard/uae-selling', sellers: [1, 2, 3, 4] },
    { key: 'flipkart', label: 'Flipkart', emoji: '🛒', prefix: 'flipkart', routeBase: '/dashboard/flipkart', sellers: [1, 2, 3, 4, 5, 6] },
]

// ─── ALL SEARCH TARGETS (exact DB table names) ───────────
const ALL_TARGETS: {
    table: string
    marketplace: string
    marketEmoji: string
    stage: string
    routePath: string
    seller?: string
    subType?: string
    order: number
}[] = [
        { table: 'india_validation_main_file', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Validation', routePath: '/dashboard/india-selling/validation', order: 1 },
        { table: 'india_purchases', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Purchases', routePath: '/dashboard/india-selling/purchases', order: 2 },
        { table: 'india_admin_validation', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Admin Validation', routePath: '/dashboard/india-selling/admin-validation', order: 3 },
        { table: 'india_traking', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', order: 4 },
        { table: 'india_brand_checking_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/golden-aura', seller: 'Golden Aura', order: 0 },
        { table: 'india_brand_checking_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/rudra-retail', seller: 'Rudra Retail', order: 0 },
        { table: 'india_brand_checking_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/ubeauty', seller: 'UBeauty', order: 0 },
        { table: 'india_brand_checking_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/velvet-vista', seller: 'Velvet Vista', order: 0 },
        { table: 'india_brand_checking_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/dropy-ecom', seller: 'Dropy Ecom', order: 0 },
        { table: 'india_brand_checking_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Brand Checking', routePath: '/dashboard/india-selling/brand-checking/costech-ventures', seller: 'Costech Ventures', order: 0 },
        { table: 'india_listing_error_seller_1_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 6 },
        { table: 'india_listing_error_seller_1_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 7 },
        { table: 'india_listing_error_seller_1_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 8 },
        { table: 'india_listing_error_seller_1_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 9 },
        { table: 'india_listing_error_seller_1_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 10 },
        { table: 'india_listing_error_seller_1_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 11 },
        { table: 'india_listing_error_seller_1_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 12 },
        { table: 'india_listing_error_seller_2_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 6 },
        { table: 'india_listing_error_seller_2_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 7 },
        { table: 'india_listing_error_seller_2_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 8 },
        { table: 'india_listing_error_seller_2_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 9 },
        { table: 'india_listing_error_seller_2_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 10 },
        { table: 'india_listing_error_seller_2_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 11 },
        { table: 'india_listing_error_seller_2_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 12 },
        { table: 'india_listing_error_seller_3_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 6 },
        { table: 'india_listing_error_seller_3_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 7 },
        { table: 'india_listing_error_seller_3_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 8 },
        { table: 'india_listing_error_seller_3_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 9 },
        { table: 'india_listing_error_seller_3_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 10 },
        { table: 'india_listing_error_seller_3_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 11 },
        { table: 'india_listing_error_seller_3_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/ubeauty', seller: 'UBeauty', order: 12 },
        { table: 'india_listing_error_seller_4_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 6 },
        { table: 'india_listing_error_seller_4_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 7 },
        { table: 'india_listing_error_seller_4_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 8 },
        { table: 'india_listing_error_seller_4_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 9 },
        { table: 'india_listing_error_seller_4_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 10 },
        { table: 'india_listing_error_seller_4_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 11 },
        { table: 'india_listing_error_seller_4_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 12 },
        { table: 'india_listing_error_seller_5_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 6 },
        { table: 'india_listing_error_seller_5_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 7 },
        { table: 'india_listing_error_seller_5_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 8 },
        { table: 'india_listing_error_seller_5_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 9 },
        { table: 'india_listing_error_seller_5_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 10 },
        { table: 'india_listing_error_seller_5_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 11 },
        { table: 'india_listing_error_seller_5_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 12 },
        { table: 'india_listing_error_seller_6_pending', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 6 },
        { table: 'india_listing_error_seller_6_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 7 },
        { table: 'india_listing_error_seller_6_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 8 },
        { table: 'india_listing_error_seller_6_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 9 },
        { table: 'india_listing_error_seller_6_done', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 10 },
        { table: 'india_listing_error_seller_6_error', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 11 },
        { table: 'india_listing_error_seller_6_removed', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/india-selling/listing-error/costech-ventures', seller: 'Costech Ventures', order: 12 },
        { table: 'india_reorder_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'Golden Aura', order: 5 },
        { table: 'india_reorder_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'Rudra Retail', order: 5 },
        { table: 'india_reorder_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'UBeauty', order: 5 },
        { table: 'india_reorder_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'Velvet Vista', order: 5 },
        { table: 'india_reorder_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'Dropy Ecom', order: 5 },
        { table: 'india_reorder_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Reorder', routePath: '/dashboard/india-selling/reorder', seller: 'Costech Ventures', order: 5 },
        { table: 'india_tracking_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'Golden Aura', order: 4 },
        { table: 'india_tracking_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'Rudra Retail', order: 4 },
        { table: 'india_tracking_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'UBeauty', order: 4 },
        { table: 'india_tracking_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'Velvet Vista', order: 4 },
        { table: 'india_tracking_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'Dropy Ecom', order: 4 },
        { table: 'india_tracking_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Tracking', routePath: '/dashboard/india-selling/tracking', seller: 'Costech Ventures', order: 4 },
        { table: 'india_shipment_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'Golden Aura', order: 13 },
        { table: 'india_shipment_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'Rudra Retail', order: 13 },
        { table: 'india_shipment_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'UBeauty', order: 13 },
        { table: 'india_shipment_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'Velvet Vista', order: 13 },
        { table: 'india_shipment_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'Dropy Ecom', order: 13 },
        { table: 'india_shipment_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Shipment', routePath: '/dashboard/india-selling/shipment', seller: 'Costech Ventures', order: 13 },
        { table: 'india_invoice_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'Golden Aura', order: 14 },
        { table: 'india_invoice_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'Rudra Retail', order: 14 },
        { table: 'india_invoice_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'UBeauty', order: 14 },
        { table: 'india_invoice_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'Velvet Vista', order: 14 },
        { table: 'india_invoice_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'Dropy Ecom', order: 14 },
        { table: 'india_invoice_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Invoice', routePath: '/dashboard/india-selling/invoice', seller: 'Costech Ventures', order: 14 },
        { table: 'india_vyapar_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'Golden Aura', order: 15 },
        { table: 'india_vyapar_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'Rudra Retail', order: 15 },
        { table: 'india_vyapar_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'UBeauty', order: 15 },
        { table: 'india_vyapar_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'Velvet Vista', order: 15 },
        { table: 'india_vyapar_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'Dropy Ecom', order: 15 },
        { table: 'india_vyapar_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Vyapar', routePath: '/dashboard/india-selling/vyapar', seller: 'Costech Ventures', order: 15 },
        { table: 'india_restock_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'Golden Aura', order: 16 },
        { table: 'india_restock_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'Rudra Retail', order: 16 },
        { table: 'india_restock_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'UBeauty', order: 16 },
        { table: 'india_restock_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'Velvet Vista', order: 16 },
        { table: 'india_restock_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'Dropy Ecom', order: 16 },
        { table: 'india_restock_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Restock', routePath: '/dashboard/india-selling/restock', seller: 'Costech Ventures', order: 16 },
        { table: 'india_checking_seller_1', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'Golden Aura', order: 17 },
        { table: 'india_checking_seller_2', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'Rudra Retail', order: 17 },
        { table: 'india_checking_seller_3', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'UBeauty', order: 17 },
        { table: 'india_checking_seller_4', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'Velvet Vista', order: 17 },
        { table: 'india_checking_seller_5', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'Dropy Ecom', order: 17 },
        { table: 'india_checking_seller_6', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Checking', routePath: '/dashboard/india-selling/checking', seller: 'Costech Ventures', order: 17 },
        { table: 'india_seller_1_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Golden Aura', order: 18 },
        { table: 'india_seller_1_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Golden Aura', order: 19 },
        { table: 'india_seller_1_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Golden Aura', order: 20 },
        { table: 'india_seller_1_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Golden Aura', order: 21 },
        { table: 'india_seller_1_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Golden Aura', order: 22 },
        { table: 'india_seller_2_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Rudra Retail', order: 18 },
        { table: 'india_seller_2_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Rudra Retail', order: 19 },
        { table: 'india_seller_2_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Rudra Retail', order: 20 },
        { table: 'india_seller_2_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Rudra Retail', order: 21 },
        { table: 'india_seller_2_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Rudra Retail', order: 22 },
        { table: 'india_seller_3_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'UBeauty', order: 18 },
        { table: 'india_seller_3_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'UBeauty', order: 19 },
        { table: 'india_seller_3_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'UBeauty', order: 20 },
        { table: 'india_seller_3_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'UBeauty', order: 21 },
        { table: 'india_seller_3_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'UBeauty', order: 22 },
        { table: 'india_seller_4_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Velvet Vista', order: 18 },
        { table: 'india_seller_4_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Velvet Vista', order: 19 },
        { table: 'india_seller_4_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Velvet Vista', order: 20 },
        { table: 'india_seller_4_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Velvet Vista', order: 21 },
        { table: 'india_seller_4_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Velvet Vista', order: 22 },
        { table: 'india_seller_5_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Dropy Ecom', order: 18 },
        { table: 'india_seller_5_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Dropy Ecom', order: 19 },
        { table: 'india_seller_5_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Dropy Ecom', order: 20 },
        { table: 'india_seller_5_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Dropy Ecom', order: 21 },
        { table: 'india_seller_5_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Dropy Ecom', order: 22 },
        { table: 'india_seller_6_high_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Costech Ventures', order: 18 },
        { table: 'india_seller_6_low_demand', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Costech Ventures', order: 19 },
        { table: 'india_seller_6_dropshipping', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Costech Ventures', order: 20 },
        { table: 'india_seller_6_reject', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Costech Ventures', order: 21 },
        { table: 'india_seller_6_not_approved', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/india-sellers', seller: 'Costech Ventures', order: 22 },
        { table: 'usa_validation_main_file', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Validation', routePath: '/dashboard/usa-selling/validation', order: 1 },
        { table: 'usa_purchases', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Purchases', routePath: '/dashboard/usa-selling/purchases', order: 2 },
        { table: 'usa_admin_validation', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Admin Validation', routePath: '/dashboard/usa-selling/admin-validation', order: 3 },
        { table: 'usa_traking', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Tracking', routePath: '/dashboard/usa-selling/tracking', order: 4 },
        { table: 'usa_brand_checking_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Brand Checking', routePath: '/dashboard/usa-selling/brand-checking/golden-aura', seller: 'Golden Aura', order: 0 },
        { table: 'usa_brand_checking_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Brand Checking', routePath: '/dashboard/usa-selling/brand-checking/rudra-retail', seller: 'Rudra Retail', order: 0 },
        { table: 'usa_brand_checking_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Brand Checking', routePath: '/dashboard/usa-selling/brand-checking/ubeauty', seller: 'UBeauty', order: 0 },
        { table: 'usa_brand_checking_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Brand Checking', routePath: '/dashboard/usa-selling/brand-checking/velvet-vista', seller: 'Velvet Vista', order: 0 },
        { table: 'usa_listing_error_seller_1_pending', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 6 },
        { table: 'usa_listing_error_seller_1_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 7 },
        { table: 'usa_listing_error_seller_1_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 8 },
        { table: 'usa_listing_error_seller_1_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 9 },
        { table: 'usa_listing_error_seller_1_done', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 10 },
        { table: 'usa_listing_error_seller_1_error', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 11 },
        { table: 'usa_listing_error_seller_1_removed', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/usa-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 12 },
        { table: 'usa_listing_error_seller_2_pending', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 6 },
        { table: 'usa_listing_error_seller_2_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 7 },
        { table: 'usa_listing_error_seller_2_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 8 },
        { table: 'usa_listing_error_seller_2_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 9 },
        { table: 'usa_listing_error_seller_2_done', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 10 },
        { table: 'usa_listing_error_seller_2_error', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 11 },
        { table: 'usa_listing_error_seller_2_removed', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/usa-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 12 },
        { table: 'usa_listing_error_seller_3_pending', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 6 },
        { table: 'usa_listing_error_seller_3_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 7 },
        { table: 'usa_listing_error_seller_3_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 8 },
        { table: 'usa_listing_error_seller_3_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 9 },
        { table: 'usa_listing_error_seller_3_done', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 10 },
        { table: 'usa_listing_error_seller_3_error', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 11 },
        { table: 'usa_listing_error_seller_3_removed', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/usa-selling/listing-error/ubeauty', seller: 'UBeauty', order: 12 },
        { table: 'usa_listing_error_seller_4_pending', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 6 },
        { table: 'usa_listing_error_seller_4_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 7 },
        { table: 'usa_listing_error_seller_4_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 8 },
        { table: 'usa_listing_error_seller_4_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 9 },
        { table: 'usa_listing_error_seller_4_done', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 10 },
        { table: 'usa_listing_error_seller_4_error', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 11 },
        { table: 'usa_listing_error_seller_4_removed', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/usa-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 12 },
        { table: 'usa_reorder_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Reorder', routePath: '/dashboard/usa-selling/reorder', seller: 'Golden Aura', order: 5 },
        { table: 'usa_reorder_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Reorder', routePath: '/dashboard/usa-selling/reorder', seller: 'Rudra Retail', order: 5 },
        { table: 'usa_reorder_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Reorder', routePath: '/dashboard/usa-selling/reorder', seller: 'UBeauty', order: 5 },
        { table: 'usa_reorder_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Reorder', routePath: '/dashboard/usa-selling/reorder', seller: 'Velvet Vista', order: 5 },
        { table: 'usa_tracking_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Tracking', routePath: '/dashboard/usa-selling/tracking', seller: 'Golden Aura', order: 4 },
        { table: 'usa_tracking_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Tracking', routePath: '/dashboard/usa-selling/tracking', seller: 'Rudra Retail', order: 4 },
        { table: 'usa_tracking_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Tracking', routePath: '/dashboard/usa-selling/tracking', seller: 'UBeauty', order: 4 },
        { table: 'usa_tracking_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Tracking', routePath: '/dashboard/usa-selling/tracking', seller: 'Velvet Vista', order: 4 },
        { table: 'usa_shipment_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Shipment', routePath: '/dashboard/usa-selling/shipment', seller: 'Golden Aura', order: 13 },
        { table: 'usa_shipment_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Shipment', routePath: '/dashboard/usa-selling/shipment', seller: 'Rudra Retail', order: 13 },
        { table: 'usa_shipment_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Shipment', routePath: '/dashboard/usa-selling/shipment', seller: 'UBeauty', order: 13 },
        { table: 'usa_shipment_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Shipment', routePath: '/dashboard/usa-selling/shipment', seller: 'Velvet Vista', order: 13 },
        { table: 'usa_invoice_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Invoice', routePath: '/dashboard/usa-selling/invoice', seller: 'Golden Aura', order: 14 },
        { table: 'usa_invoice_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Invoice', routePath: '/dashboard/usa-selling/invoice', seller: 'Rudra Retail', order: 14 },
        { table: 'usa_invoice_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Invoice', routePath: '/dashboard/usa-selling/invoice', seller: 'UBeauty', order: 14 },
        { table: 'usa_invoice_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Invoice', routePath: '/dashboard/usa-selling/invoice', seller: 'Velvet Vista', order: 14 },
        { table: 'usa_vyapar_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Vyapar', routePath: '/dashboard/usa-selling/vyapar', seller: 'Golden Aura', order: 15 },
        { table: 'usa_vyapar_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Vyapar', routePath: '/dashboard/usa-selling/vyapar', seller: 'Rudra Retail', order: 15 },
        { table: 'usa_vyapar_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Vyapar', routePath: '/dashboard/usa-selling/vyapar', seller: 'UBeauty', order: 15 },
        { table: 'usa_vyapar_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Vyapar', routePath: '/dashboard/usa-selling/vyapar', seller: 'Velvet Vista', order: 15 },
        { table: 'usa_restock_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Restock', routePath: '/dashboard/usa-selling/restock', seller: 'Golden Aura', order: 16 },
        { table: 'usa_restock_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Restock', routePath: '/dashboard/usa-selling/restock', seller: 'Rudra Retail', order: 16 },
        { table: 'usa_restock_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Restock', routePath: '/dashboard/usa-selling/restock', seller: 'UBeauty', order: 16 },
        { table: 'usa_restock_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Restock', routePath: '/dashboard/usa-selling/restock', seller: 'Velvet Vista', order: 16 },
        { table: 'usa_checking_seller_1', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Checking', routePath: '/dashboard/usa-selling/checking', seller: 'Golden Aura', order: 17 },
        { table: 'usa_checking_seller_2', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Checking', routePath: '/dashboard/usa-selling/checking', seller: 'Rudra Retail', order: 17 },
        { table: 'usa_checking_seller_3', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Checking', routePath: '/dashboard/usa-selling/checking', seller: 'UBeauty', order: 17 },
        { table: 'usa_checking_seller_4', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Checking', routePath: '/dashboard/usa-selling/checking', seller: 'Velvet Vista', order: 17 },
        { table: 'usa_seller_1_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Golden Aura', order: 18 },
        { table: 'usa_seller_1_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Golden Aura', order: 19 },
        { table: 'usa_seller_1_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Golden Aura', order: 20 },
        { table: 'usa_seller_1_reject', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Golden Aura', order: 21 },
        { table: 'usa_seller_1_not_approved', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Golden Aura', order: 22 },
        { table: 'usa_seller_2_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Rudra Retail', order: 18 },
        { table: 'usa_seller_2_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Rudra Retail', order: 19 },
        { table: 'usa_seller_2_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Rudra Retail', order: 20 },
        { table: 'usa_seller_2_reject', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Rudra Retail', order: 21 },
        { table: 'usa_seller_2_not_approved', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Rudra Retail', order: 22 },
        { table: 'usa_seller_3_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'UBeauty', order: 18 },
        { table: 'usa_seller_3_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'UBeauty', order: 19 },
        { table: 'usa_seller_3_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'UBeauty', order: 20 },
        { table: 'usa_seller_3_reject', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'UBeauty', order: 21 },
        { table: 'usa_seller_3_not_approved', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'UBeauty', order: 22 },
        { table: 'usa_seller_4_high_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Velvet Vista', order: 18 },
        { table: 'usa_seller_4_low_demand', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Velvet Vista', order: 19 },
        { table: 'usa_seller_4_dropshipping', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Velvet Vista', order: 20 },
        { table: 'usa_seller_4_reject', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Velvet Vista', order: 21 },
        { table: 'usa_seller_4_not_approved', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/usa-sellers', seller: 'Velvet Vista', order: 22 },
        { table: 'uk_validation_main_file', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Validation', routePath: '/dashboard/uk-selling/validation', order: 1 },
        { table: 'uk_purchases', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Purchases', routePath: '/dashboard/uk-selling/purchases', order: 2 },
        { table: 'uk_admin_validation', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Admin Validation', routePath: '/dashboard/uk-selling/admin-validation', order: 3 },
        { table: 'uk_traking', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Tracking', routePath: '/dashboard/uk-selling/tracking', order: 4 },
        { table: 'uk_brand_checking_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Brand Checking', routePath: '/dashboard/uk-selling/brand-checking/golden-aura', seller: 'Golden Aura', order: 0 },
        { table: 'uk_brand_checking_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Brand Checking', routePath: '/dashboard/uk-selling/brand-checking/rudra-retail', seller: 'Rudra Retail', order: 0 },
        { table: 'uk_brand_checking_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Brand Checking', routePath: '/dashboard/uk-selling/brand-checking/ubeauty', seller: 'UBeauty', order: 0 },
        { table: 'uk_brand_checking_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Brand Checking', routePath: '/dashboard/uk-selling/brand-checking/velvet-vista', seller: 'Velvet Vista', order: 0 },
        { table: 'uk_listing_error_seller_1_pending', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 6 },
        { table: 'uk_listing_error_seller_1_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 7 },
        { table: 'uk_listing_error_seller_1_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 8 },
        { table: 'uk_listing_error_seller_1_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 9 },
        { table: 'uk_listing_error_seller_1_done', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 10 },
        { table: 'uk_listing_error_seller_1_error', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 11 },
        { table: 'uk_listing_error_seller_1_removed', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uk-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 12 },
        { table: 'uk_listing_error_seller_2_pending', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 6 },
        { table: 'uk_listing_error_seller_2_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 7 },
        { table: 'uk_listing_error_seller_2_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 8 },
        { table: 'uk_listing_error_seller_2_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 9 },
        { table: 'uk_listing_error_seller_2_done', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 10 },
        { table: 'uk_listing_error_seller_2_error', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 11 },
        { table: 'uk_listing_error_seller_2_removed', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uk-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 12 },
        { table: 'uk_listing_error_seller_3_pending', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 6 },
        { table: 'uk_listing_error_seller_3_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 7 },
        { table: 'uk_listing_error_seller_3_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 8 },
        { table: 'uk_listing_error_seller_3_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 9 },
        { table: 'uk_listing_error_seller_3_done', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 10 },
        { table: 'uk_listing_error_seller_3_error', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 11 },
        { table: 'uk_listing_error_seller_3_removed', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uk-selling/listing-error/ubeauty', seller: 'UBeauty', order: 12 },
        { table: 'uk_listing_error_seller_4_pending', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 6 },
        { table: 'uk_listing_error_seller_4_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 7 },
        { table: 'uk_listing_error_seller_4_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 8 },
        { table: 'uk_listing_error_seller_4_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 9 },
        { table: 'uk_listing_error_seller_4_done', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 10 },
        { table: 'uk_listing_error_seller_4_error', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 11 },
        { table: 'uk_listing_error_seller_4_removed', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uk-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 12 },
        { table: 'uk_reorder_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Reorder', routePath: '/dashboard/uk-selling/reorder', seller: 'Golden Aura', order: 5 },
        { table: 'uk_reorder_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Reorder', routePath: '/dashboard/uk-selling/reorder', seller: 'Rudra Retail', order: 5 },
        { table: 'uk_reorder_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Reorder', routePath: '/dashboard/uk-selling/reorder', seller: 'UBeauty', order: 5 },
        { table: 'uk_reorder_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Reorder', routePath: '/dashboard/uk-selling/reorder', seller: 'Velvet Vista', order: 5 },
        { table: 'uk_tracking_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Tracking', routePath: '/dashboard/uk-selling/tracking', seller: 'Golden Aura', order: 4 },
        { table: 'uk_tracking_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Tracking', routePath: '/dashboard/uk-selling/tracking', seller: 'Rudra Retail', order: 4 },
        { table: 'uk_tracking_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Tracking', routePath: '/dashboard/uk-selling/tracking', seller: 'UBeauty', order: 4 },
        { table: 'uk_tracking_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Tracking', routePath: '/dashboard/uk-selling/tracking', seller: 'Velvet Vista', order: 4 },
        { table: 'uk_shipment_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Shipment', routePath: '/dashboard/uk-selling/shipment', seller: 'Golden Aura', order: 13 },
        { table: 'uk_shipment_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Shipment', routePath: '/dashboard/uk-selling/shipment', seller: 'Rudra Retail', order: 13 },
        { table: 'uk_shipment_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Shipment', routePath: '/dashboard/uk-selling/shipment', seller: 'UBeauty', order: 13 },
        { table: 'uk_shipment_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Shipment', routePath: '/dashboard/uk-selling/shipment', seller: 'Velvet Vista', order: 13 },
        { table: 'uk_invoice_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Invoice', routePath: '/dashboard/uk-selling/invoice', seller: 'Golden Aura', order: 14 },
        { table: 'uk_invoice_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Invoice', routePath: '/dashboard/uk-selling/invoice', seller: 'Rudra Retail', order: 14 },
        { table: 'uk_invoice_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Invoice', routePath: '/dashboard/uk-selling/invoice', seller: 'UBeauty', order: 14 },
        { table: 'uk_invoice_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Invoice', routePath: '/dashboard/uk-selling/invoice', seller: 'Velvet Vista', order: 14 },
        { table: 'uk_vyapar_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Vyapar', routePath: '/dashboard/uk-selling/vyapar', seller: 'Golden Aura', order: 15 },
        { table: 'uk_vyapar_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Vyapar', routePath: '/dashboard/uk-selling/vyapar', seller: 'Rudra Retail', order: 15 },
        { table: 'uk_vyapar_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Vyapar', routePath: '/dashboard/uk-selling/vyapar', seller: 'UBeauty', order: 15 },
        { table: 'uk_vyapar_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Vyapar', routePath: '/dashboard/uk-selling/vyapar', seller: 'Velvet Vista', order: 15 },
        { table: 'uk_restock_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Restock', routePath: '/dashboard/uk-selling/restock', seller: 'Golden Aura', order: 16 },
        { table: 'uk_restock_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Restock', routePath: '/dashboard/uk-selling/restock', seller: 'Rudra Retail', order: 16 },
        { table: 'uk_restock_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Restock', routePath: '/dashboard/uk-selling/restock', seller: 'UBeauty', order: 16 },
        { table: 'uk_restock_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Restock', routePath: '/dashboard/uk-selling/restock', seller: 'Velvet Vista', order: 16 },
        { table: 'uk_checking_seller_1', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Checking', routePath: '/dashboard/uk-selling/checking', seller: 'Golden Aura', order: 17 },
        { table: 'uk_checking_seller_2', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Checking', routePath: '/dashboard/uk-selling/checking', seller: 'Rudra Retail', order: 17 },
        { table: 'uk_checking_seller_3', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Checking', routePath: '/dashboard/uk-selling/checking', seller: 'UBeauty', order: 17 },
        { table: 'uk_checking_seller_4', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Checking', routePath: '/dashboard/uk-selling/checking', seller: 'Velvet Vista', order: 17 },
        { table: 'uk_seller_1_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Golden Aura', order: 18 },
        { table: 'uk_seller_1_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Golden Aura', order: 19 },
        { table: 'uk_seller_1_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Golden Aura', order: 20 },
        { table: 'uk_seller_1_reject', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Golden Aura', order: 21 },
        { table: 'uk_seller_1_not_approved', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Golden Aura', order: 22 },
        { table: 'uk_seller_2_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Rudra Retail', order: 18 },
        { table: 'uk_seller_2_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Rudra Retail', order: 19 },
        { table: 'uk_seller_2_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Rudra Retail', order: 20 },
        { table: 'uk_seller_2_reject', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Rudra Retail', order: 21 },
        { table: 'uk_seller_2_not_approved', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Rudra Retail', order: 22 },
        { table: 'uk_seller_3_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'UBeauty', order: 18 },
        { table: 'uk_seller_3_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'UBeauty', order: 19 },
        { table: 'uk_seller_3_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'UBeauty', order: 20 },
        { table: 'uk_seller_3_reject', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'UBeauty', order: 21 },
        { table: 'uk_seller_3_not_approved', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'UBeauty', order: 22 },
        { table: 'uk_seller_4_high_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Velvet Vista', order: 18 },
        { table: 'uk_seller_4_low_demand', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Velvet Vista', order: 19 },
        { table: 'uk_seller_4_dropshipping', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Velvet Vista', order: 20 },
        { table: 'uk_seller_4_reject', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Velvet Vista', order: 21 },
        { table: 'uk_seller_4_not_approved', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uk-sellers', seller: 'Velvet Vista', order: 22 },
        { table: 'uae_validation_main_file', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Validation', routePath: '/dashboard/uae-selling/validation', order: 1 },
        { table: 'uae_purchases', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Purchases', routePath: '/dashboard/uae-selling/purchases', order: 2 },
        { table: 'uae_admin_validation', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Admin Validation', routePath: '/dashboard/uae-selling/admin-validation', order: 3 },
        { table: 'uae_traking', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Tracking', routePath: '/dashboard/uae-selling/tracking', order: 4 },
        { table: 'uae_brand_checking_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Brand Checking', routePath: '/dashboard/uae-selling/brand-checking/golden-aura', seller: 'Golden Aura', order: 0 },
        { table: 'uae_brand_checking_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Brand Checking', routePath: '/dashboard/uae-selling/brand-checking/rudra-retail', seller: 'Rudra Retail', order: 0 },
        { table: 'uae_brand_checking_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Brand Checking', routePath: '/dashboard/uae-selling/brand-checking/ubeauty', seller: 'UBeauty', order: 0 },
        { table: 'uae_brand_checking_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Brand Checking', routePath: '/dashboard/uae-selling/brand-checking/velvet-vista', seller: 'Velvet Vista', order: 0 },
        { table: 'uae_listing_error_seller_1_pending', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 6 },
        { table: 'uae_listing_error_seller_1_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 7 },
        { table: 'uae_listing_error_seller_1_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 8 },
        { table: 'uae_listing_error_seller_1_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 9 },
        { table: 'uae_listing_error_seller_1_done', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 10 },
        { table: 'uae_listing_error_seller_1_error', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 11 },
        { table: 'uae_listing_error_seller_1_removed', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uae-selling/listing-error/golden-aura', seller: 'Golden Aura', order: 12 },
        { table: 'uae_listing_error_seller_2_pending', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 6 },
        { table: 'uae_listing_error_seller_2_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 7 },
        { table: 'uae_listing_error_seller_2_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 8 },
        { table: 'uae_listing_error_seller_2_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 9 },
        { table: 'uae_listing_error_seller_2_done', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 10 },
        { table: 'uae_listing_error_seller_2_error', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 11 },
        { table: 'uae_listing_error_seller_2_removed', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uae-selling/listing-error/rudra-retail', seller: 'Rudra Retail', order: 12 },
        { table: 'uae_listing_error_seller_3_pending', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 6 },
        { table: 'uae_listing_error_seller_3_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 7 },
        { table: 'uae_listing_error_seller_3_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 8 },
        { table: 'uae_listing_error_seller_3_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 9 },
        { table: 'uae_listing_error_seller_3_done', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 10 },
        { table: 'uae_listing_error_seller_3_error', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 11 },
        { table: 'uae_listing_error_seller_3_removed', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uae-selling/listing-error/ubeauty', seller: 'UBeauty', order: 12 },
        { table: 'uae_listing_error_seller_4_pending', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 6 },
        { table: 'uae_listing_error_seller_4_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 7 },
        { table: 'uae_listing_error_seller_4_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 8 },
        { table: 'uae_listing_error_seller_4_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 9 },
        { table: 'uae_listing_error_seller_4_done', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 10 },
        { table: 'uae_listing_error_seller_4_error', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 11 },
        { table: 'uae_listing_error_seller_4_removed', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/uae-selling/listing-error/velvet-vista', seller: 'Velvet Vista', order: 12 },
        { table: 'uae_reorder_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Reorder', routePath: '/dashboard/uae-selling/reorder', seller: 'Golden Aura', order: 5 },
        { table: 'uae_reorder_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Reorder', routePath: '/dashboard/uae-selling/reorder', seller: 'Rudra Retail', order: 5 },
        { table: 'uae_reorder_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Reorder', routePath: '/dashboard/uae-selling/reorder', seller: 'UBeauty', order: 5 },
        { table: 'uae_reorder_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Reorder', routePath: '/dashboard/uae-selling/reorder', seller: 'Velvet Vista', order: 5 },
        { table: 'uae_tracking_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Tracking', routePath: '/dashboard/uae-selling/tracking', seller: 'Golden Aura', order: 4 },
        { table: 'uae_tracking_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Tracking', routePath: '/dashboard/uae-selling/tracking', seller: 'Rudra Retail', order: 4 },
        { table: 'uae_tracking_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Tracking', routePath: '/dashboard/uae-selling/tracking', seller: 'UBeauty', order: 4 },
        { table: 'uae_tracking_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Tracking', routePath: '/dashboard/uae-selling/tracking', seller: 'Velvet Vista', order: 4 },
        { table: 'uae_shipment_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Shipment', routePath: '/dashboard/uae-selling/shipment', seller: 'Golden Aura', order: 13 },
        { table: 'uae_shipment_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Shipment', routePath: '/dashboard/uae-selling/shipment', seller: 'Rudra Retail', order: 13 },
        { table: 'uae_shipment_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Shipment', routePath: '/dashboard/uae-selling/shipment', seller: 'UBeauty', order: 13 },
        { table: 'uae_shipment_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Shipment', routePath: '/dashboard/uae-selling/shipment', seller: 'Velvet Vista', order: 13 },
        { table: 'uae_invoice_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Invoice', routePath: '/dashboard/uae-selling/invoice', seller: 'Golden Aura', order: 14 },
        { table: 'uae_invoice_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Invoice', routePath: '/dashboard/uae-selling/invoice', seller: 'Rudra Retail', order: 14 },
        { table: 'uae_invoice_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Invoice', routePath: '/dashboard/uae-selling/invoice', seller: 'UBeauty', order: 14 },
        { table: 'uae_invoice_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Invoice', routePath: '/dashboard/uae-selling/invoice', seller: 'Velvet Vista', order: 14 },
        { table: 'uae_vyapar_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Vyapar', routePath: '/dashboard/uae-selling/vyapar', seller: 'Golden Aura', order: 15 },
        { table: 'uae_vyapar_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Vyapar', routePath: '/dashboard/uae-selling/vyapar', seller: 'Rudra Retail', order: 15 },
        { table: 'uae_vyapar_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Vyapar', routePath: '/dashboard/uae-selling/vyapar', seller: 'UBeauty', order: 15 },
        { table: 'uae_vyapar_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Vyapar', routePath: '/dashboard/uae-selling/vyapar', seller: 'Velvet Vista', order: 15 },
        { table: 'uae_restock_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Restock', routePath: '/dashboard/uae-selling/restock', seller: 'Golden Aura', order: 16 },
        { table: 'uae_restock_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Restock', routePath: '/dashboard/uae-selling/restock', seller: 'Rudra Retail', order: 16 },
        { table: 'uae_restock_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Restock', routePath: '/dashboard/uae-selling/restock', seller: 'UBeauty', order: 16 },
        { table: 'uae_restock_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Restock', routePath: '/dashboard/uae-selling/restock', seller: 'Velvet Vista', order: 16 },
        { table: 'uae_checking_seller_1', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Checking', routePath: '/dashboard/uae-selling/checking', seller: 'Golden Aura', order: 17 },
        { table: 'uae_checking_seller_2', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Checking', routePath: '/dashboard/uae-selling/checking', seller: 'Rudra Retail', order: 17 },
        { table: 'uae_checking_seller_3', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Checking', routePath: '/dashboard/uae-selling/checking', seller: 'UBeauty', order: 17 },
        { table: 'uae_checking_seller_4', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Checking', routePath: '/dashboard/uae-selling/checking', seller: 'Velvet Vista', order: 17 },
        { table: 'uae_seller_1_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Golden Aura', order: 18 },
        { table: 'uae_seller_1_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Golden Aura', order: 19 },
        { table: 'uae_seller_1_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Golden Aura', order: 20 },
        { table: 'uae_seller_1_reject', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Golden Aura', order: 21 },
        { table: 'uae_seller_1_not_approved', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Golden Aura', order: 22 },
        { table: 'uae_seller_2_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Rudra Retail', order: 18 },
        { table: 'uae_seller_2_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Rudra Retail', order: 19 },
        { table: 'uae_seller_2_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Rudra Retail', order: 20 },
        { table: 'uae_seller_2_reject', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Rudra Retail', order: 21 },
        { table: 'uae_seller_2_not_approved', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Rudra Retail', order: 22 },
        { table: 'uae_seller_3_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'UBeauty', order: 18 },
        { table: 'uae_seller_3_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'UBeauty', order: 19 },
        { table: 'uae_seller_3_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'UBeauty', order: 20 },
        { table: 'uae_seller_3_reject', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'UBeauty', order: 21 },
        { table: 'uae_seller_3_not_approved', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'UBeauty', order: 22 },
        { table: 'uae_seller_4_high_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Velvet Vista', order: 18 },
        { table: 'uae_seller_4_low_demand', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Velvet Vista', order: 19 },
        { table: 'uae_seller_4_dropshipping', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Velvet Vista', order: 20 },
        { table: 'uae_seller_4_reject', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Velvet Vista', order: 21 },
        { table: 'uae_seller_4_not_approved', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/uae-sellers', seller: 'Velvet Vista', order: 22 },
        { table: 'flipkart_validation_main_file', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Validation', routePath: '/dashboard/flipkart/validation', order: 1 },
        { table: 'flipkart_purchases', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Purchases', routePath: '/dashboard/flipkart/purchases', order: 2 },
        { table: 'flipkart_admin_validation', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Admin Validation', routePath: '/dashboard/flipkart/admin-validation', order: 3 },
        { table: 'flipkart_traking', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', order: 4 },
        { table: 'flipkart_brand_checking_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/golden-aura', seller: 'Golden Aura', order: 0 },
        { table: 'flipkart_brand_checking_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/rudra-retail', seller: 'Rudra Retail', order: 0 },
        { table: 'flipkart_brand_checking_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/ubeauty', seller: 'UBeauty', order: 0 },
        { table: 'flipkart_brand_checking_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/velvet-vista', seller: 'Velvet Vista', order: 0 },
        { table: 'flipkart_brand_checking_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/dropy-ecom', seller: 'Dropy Ecom', order: 0 },
        { table: 'flipkart_brand_checking_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Brand Checking', routePath: '/dashboard/flipkart/brand-checking/costech-ventures', seller: 'Costech Ventures', order: 0 },
        { table: 'flipkart_listing_error_seller_1_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 6 },
        { table: 'flipkart_listing_error_seller_1_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 7 },
        { table: 'flipkart_listing_error_seller_1_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 8 },
        { table: 'flipkart_listing_error_seller_1_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 9 },
        { table: 'flipkart_listing_error_seller_1_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 10 },
        { table: 'flipkart_listing_error_seller_1_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 11 },
        { table: 'flipkart_listing_error_seller_1_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/golden-aura', seller: 'Golden Aura', order: 12 },
        { table: 'flipkart_listing_error_seller_2_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 6 },
        { table: 'flipkart_listing_error_seller_2_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 7 },
        { table: 'flipkart_listing_error_seller_2_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 8 },
        { table: 'flipkart_listing_error_seller_2_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 9 },
        { table: 'flipkart_listing_error_seller_2_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 10 },
        { table: 'flipkart_listing_error_seller_2_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 11 },
        { table: 'flipkart_listing_error_seller_2_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/rudra-retail', seller: 'Rudra Retail', order: 12 },
        { table: 'flipkart_listing_error_seller_3_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 6 },
        { table: 'flipkart_listing_error_seller_3_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 7 },
        { table: 'flipkart_listing_error_seller_3_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 8 },
        { table: 'flipkart_listing_error_seller_3_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 9 },
        { table: 'flipkart_listing_error_seller_3_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 10 },
        { table: 'flipkart_listing_error_seller_3_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 11 },
        { table: 'flipkart_listing_error_seller_3_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/ubeauty', seller: 'UBeauty', order: 12 },
        { table: 'flipkart_listing_error_seller_4_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 6 },
        { table: 'flipkart_listing_error_seller_4_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 7 },
        { table: 'flipkart_listing_error_seller_4_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 8 },
        { table: 'flipkart_listing_error_seller_4_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 9 },
        { table: 'flipkart_listing_error_seller_4_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 10 },
        { table: 'flipkart_listing_error_seller_4_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 11 },
        { table: 'flipkart_listing_error_seller_4_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/velvet-vista', seller: 'Velvet Vista', order: 12 },
        { table: 'flipkart_listing_error_seller_5_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 6 },
        { table: 'flipkart_listing_error_seller_5_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 7 },
        { table: 'flipkart_listing_error_seller_5_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 8 },
        { table: 'flipkart_listing_error_seller_5_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 9 },
        { table: 'flipkart_listing_error_seller_5_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 10 },
        { table: 'flipkart_listing_error_seller_5_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 11 },
        { table: 'flipkart_listing_error_seller_5_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/dropy-ecom', seller: 'Dropy Ecom', order: 12 },
        { table: 'flipkart_listing_error_seller_6_pending', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Pending', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 6 },
        { table: 'flipkart_listing_error_seller_6_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'High Demand', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 7 },
        { table: 'flipkart_listing_error_seller_6_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Low Demand', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 8 },
        { table: 'flipkart_listing_error_seller_6_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Dropshipping', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 9 },
        { table: 'flipkart_listing_error_seller_6_done', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Done', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 10 },
        { table: 'flipkart_listing_error_seller_6_error', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Error', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 11 },
        { table: 'flipkart_listing_error_seller_6_removed', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Listing Error', subType: 'Removed', routePath: '/dashboard/flipkart/listing-error/costech-ventures', seller: 'Costech Ventures', order: 12 },
        { table: 'flipkart_reorder_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'Golden Aura', order: 5 },
        { table: 'flipkart_reorder_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'Rudra Retail', order: 5 },
        { table: 'flipkart_reorder_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'UBeauty', order: 5 },
        { table: 'flipkart_reorder_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'Velvet Vista', order: 5 },
        { table: 'flipkart_reorder_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'Dropy Ecom', order: 5 },
        { table: 'flipkart_reorder_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Reorder', routePath: '/dashboard/flipkart/reorder', seller: 'Costech Ventures', order: 5 },
        { table: 'flipkart_tracking_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'Golden Aura', order: 4 },
        { table: 'flipkart_tracking_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'Rudra Retail', order: 4 },
        { table: 'flipkart_tracking_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'UBeauty', order: 4 },
        { table: 'flipkart_tracking_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'Velvet Vista', order: 4 },
        { table: 'flipkart_tracking_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'Dropy Ecom', order: 4 },
        { table: 'flipkart_tracking_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Tracking', routePath: '/dashboard/flipkart/tracking', seller: 'Costech Ventures', order: 4 },
        { table: 'flipkart_shipment_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'Golden Aura', order: 13 },
        { table: 'flipkart_shipment_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'Rudra Retail', order: 13 },
        { table: 'flipkart_shipment_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'UBeauty', order: 13 },
        { table: 'flipkart_shipment_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'Velvet Vista', order: 13 },
        { table: 'flipkart_shipment_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'Dropy Ecom', order: 13 },
        { table: 'flipkart_shipment_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Shipment', routePath: '/dashboard/flipkart/shipment', seller: 'Costech Ventures', order: 13 },
        { table: 'flipkart_invoice_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'Golden Aura', order: 14 },
        { table: 'flipkart_invoice_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'Rudra Retail', order: 14 },
        { table: 'flipkart_invoice_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'UBeauty', order: 14 },
        { table: 'flipkart_invoice_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'Velvet Vista', order: 14 },
        { table: 'flipkart_invoice_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'Dropy Ecom', order: 14 },
        { table: 'flipkart_invoice_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Invoice', routePath: '/dashboard/flipkart/invoice', seller: 'Costech Ventures', order: 14 },
        { table: 'flipkart_vyapar_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'Golden Aura', order: 15 },
        { table: 'flipkart_vyapar_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'Rudra Retail', order: 15 },
        { table: 'flipkart_vyapar_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'UBeauty', order: 15 },
        { table: 'flipkart_vyapar_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'Velvet Vista', order: 15 },
        { table: 'flipkart_vyapar_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'Dropy Ecom', order: 15 },
        { table: 'flipkart_vyapar_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Vyapar', routePath: '/dashboard/flipkart/vyapar', seller: 'Costech Ventures', order: 15 },
        { table: 'flipkart_restock_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'Golden Aura', order: 16 },
        { table: 'flipkart_restock_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'Rudra Retail', order: 16 },
        { table: 'flipkart_restock_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'UBeauty', order: 16 },
        { table: 'flipkart_restock_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'Velvet Vista', order: 16 },
        { table: 'flipkart_restock_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'Dropy Ecom', order: 16 },
        { table: 'flipkart_restock_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Restock', routePath: '/dashboard/flipkart/restock', seller: 'Costech Ventures', order: 16 },
        { table: 'flipkart_checking_seller_1', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'Golden Aura', order: 17 },
        { table: 'flipkart_checking_seller_2', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'Rudra Retail', order: 17 },
        { table: 'flipkart_checking_seller_3', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'UBeauty', order: 17 },
        { table: 'flipkart_checking_seller_4', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'Velvet Vista', order: 17 },
        { table: 'flipkart_checking_seller_5', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'Dropy Ecom', order: 17 },
        { table: 'flipkart_checking_seller_6', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Checking', routePath: '/dashboard/flipkart/checking', seller: 'Costech Ventures', order: 17 },
        { table: 'flipkart_seller_1_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Golden Aura', order: 18 },
        { table: 'flipkart_seller_1_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Golden Aura', order: 19 },
        { table: 'flipkart_seller_1_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Golden Aura', order: 20 },
        { table: 'flipkart_seller_1_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Golden Aura', order: 21 },
        { table: 'flipkart_seller_1_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Golden Aura', order: 22 },
        { table: 'flipkart_seller_2_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Rudra Retail', order: 18 },
        { table: 'flipkart_seller_2_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Rudra Retail', order: 19 },
        { table: 'flipkart_seller_2_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Rudra Retail', order: 20 },
        { table: 'flipkart_seller_2_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Rudra Retail', order: 21 },
        { table: 'flipkart_seller_2_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Rudra Retail', order: 22 },
        { table: 'flipkart_seller_3_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'UBeauty', order: 18 },
        { table: 'flipkart_seller_3_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'UBeauty', order: 19 },
        { table: 'flipkart_seller_3_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'UBeauty', order: 20 },
        { table: 'flipkart_seller_3_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'UBeauty', order: 21 },
        { table: 'flipkart_seller_3_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'UBeauty', order: 22 },
        { table: 'flipkart_seller_4_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Velvet Vista', order: 18 },
        { table: 'flipkart_seller_4_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Velvet Vista', order: 19 },
        { table: 'flipkart_seller_4_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Velvet Vista', order: 20 },
        { table: 'flipkart_seller_4_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Velvet Vista', order: 21 },
        { table: 'flipkart_seller_4_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Velvet Vista', order: 22 },
        { table: 'flipkart_seller_5_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Dropy Ecom', order: 18 },
        { table: 'flipkart_seller_5_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Dropy Ecom', order: 19 },
        { table: 'flipkart_seller_5_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Dropy Ecom', order: 20 },
        { table: 'flipkart_seller_5_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Dropy Ecom', order: 21 },
        { table: 'flipkart_seller_5_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Dropy Ecom', order: 22 },
        { table: 'flipkart_seller_6_high_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'High Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Costech Ventures', order: 18 },
        { table: 'flipkart_seller_6_low_demand', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Low Demand', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Costech Ventures', order: 19 },
        { table: 'flipkart_seller_6_dropshipping', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Dropshipping', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Costech Ventures', order: 20 },
        { table: 'flipkart_seller_6_reject', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Reject', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Costech Ventures', order: 21 },
        { table: 'flipkart_seller_6_not_approved', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Manage Sellers', subType: 'Not Approved', routePath: '/dashboard/manage-sellers/flipkart-sellers', seller: 'Costech Ventures', order: 22 },
        // ===== MASTER TABLES =====
        // India
        { table: 'india_master_sellers', marketplace: 'India', marketEmoji: '🇮🇳', stage: 'Master', routePath: '/dashboard/manage-sellers/india-sellers', order: 23 },
        // USA
        { table: 'usa_master_sellers', marketplace: 'USA', marketEmoji: '🇺🇸', stage: 'Master', routePath: '/dashboard/manage-sellers/usa-sellers', order: 23 },
        // UK
        { table: 'uk_master_sellers', marketplace: 'UK', marketEmoji: '🇬🇧', stage: 'Master', routePath: '/dashboard/manage-sellers/uk-sellers', order: 23 },
        // UAE
        { table: 'uae_master_sellers', marketplace: 'UAE', marketEmoji: '🇦🇪', stage: 'Master', routePath: '/dashboard/manage-sellers/uae-sellers', order: 23 },
        // Flipkart
        { table: 'flipkart_master_sellers', marketplace: 'Flipkart', marketEmoji: '🛒', stage: 'Master', routePath: '/dashboard/manage-sellers/flipkart-sellers', order: 23 },
        // Dropy
        { table: 'dropy_master_sellers', marketplace: 'Dropy', marketEmoji: '📦', stage: 'Master', routePath: '/dashboard/manage-sellers/dropy', order: 23 },
    ]

// Build a human-readable breadcrumb from a hit
function buildBreadcrumb(hit: SearchHit): string[] {
    const crumbs: string[] = [];

    // Master tables show under "Manage Sellers" not "{market} Selling"
    if (hit.stage === 'Master') {
        crumbs.push('Manage Sellers');
        // Map marketplace to master label
        const masterLabels: Record<string, string> = {
            'India': 'India Master',
            'USA': 'USA Master',
            'UK': 'UK Master',
            'UAE': 'UAE Master',
            'Flipkart': 'Flipkart Master',
            'Dropy': 'Dropy Master',
        };
        crumbs.push(masterLabels[hit.marketplace] || `${hit.marketplace} Master`);
        return crumbs;
    }

    crumbs.push(`${hit.marketplace} Selling`);
    crumbs.push(hit.stage);
    if (hit.seller) crumbs.push(hit.seller);
    if (hit.subType) crumbs.push(hit.subType);

    // Show pass/fail for validation
    if (hit.stage === 'Validation' && hit.status) {
        const statusLabel = hit.status.toLowerCase() === 'pass' ? 'Pass File'
            : hit.status.toLowerCase() === 'fail' ? 'Failed'
                : hit.status;
        crumbs.push(statusLabel);
    }

    return crumbs;
}

// Stage color mapping
function getStageColor(stage: string): string {
    switch (stage) {
        case 'Brand Checking': return 'text-purple-400'
        case 'Validation': return 'text-blue-400'
        case 'Purchases': return 'text-cyan-400'
        case 'Admin Validation': return 'text-amber-400'
        case 'Listing Error': return 'text-orange-400'
        case 'Tracking': return 'text-emerald-400'
        case 'Reorder': return 'text-pink-400'
        case 'Shipment': return 'text-teal-400'
        case 'Invoice': return 'text-lime-400'
        case 'Vyapar': return 'text-yellow-400'
        case 'Restock': return 'text-sky-400'
        case 'Checking': return 'text-violet-400'
        case 'Manage Sellers': return 'text-rose-400'
        case 'Master': return 'text-indigo-400'
        default: return 'text-slate-400'
    }
}

function getStageBg(stage: string): string {
    switch (stage) {
        case 'Brand Checking': return 'bg-purple-500/10 border-purple-500/20'
        case 'Validation': return 'bg-blue-500/10 border-blue-500/20'
        case 'Purchases': return 'bg-cyan-500/10 border-cyan-500/20'
        case 'Admin Validation': return 'bg-amber-500/10 border-amber-500/20'
        case 'Listing Error': return 'bg-orange-500/10 border-orange-500/20'
        case 'Tracking': return 'bg-emerald-500/10 border-emerald-500/20'
        case 'Reorder': return 'bg-pink-500/10 border-pink-500/20'
        case 'Shipment': return 'bg-teal-500/10 border-teal-500/20'
        case 'Invoice': return 'bg-lime-500/10 border-lime-500/20'
        case 'Vyapar': return 'bg-yellow-500/10 border-yellow-500/20'
        case 'Restock': return 'bg-sky-500/10 border-sky-500/20'
        case 'Checking': return 'bg-violet-500/10 border-violet-500/20'
        case 'Manage Sellers': return 'bg-rose-500/10 border-rose-500/20'
        case 'Master': return 'bg-indigo-500/10 border-indigo-500/20'
        default: return 'bg-slate-500/10 border-slate-500/20'
    }
}

// ─── COMPONENT ───────────────────────────────────────────
export default function UniversalAsinSearch() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<SearchHit[]>([])
    const [searched, setSearched] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(true)
                setTimeout(() => inputRef.current?.focus(), 100)
            }
            if (e.key === 'Escape') setIsOpen(false)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const handleSearch = useCallback(async () => {
        const asin = query.trim().toUpperCase()
        if (!asin) return

        setLoading(true)
        setSearched(true)
        setResults([])

        try {
            const { data, error } = await supabase.rpc('search_asin_everywhere', {
                asin_input: asin,
            })

            if (error) {
                console.error('RPC error:', error)
                setLoading(false)
                return
            }

            const hits: SearchHit[] = (data || [])
                .map((row: { found_table: string; found_asin: string; found_productname: string | null; found_status: string | null }) => {
                    const target = ALL_TARGETS.find(t => t.table === row.found_table)
                    if (!target) return null
                    return {
                        marketplace: target.marketplace,
                        marketEmoji: target.marketEmoji,
                        stage: target.stage,
                        table: target.table,
                        routePath: target.routePath,
                        seller: target.seller,
                        subType: target.subType,
                        status: row.found_status || undefined,
                        productName: row.found_productname || undefined,
                        order: target.order,
                    } as SearchHit
                })
                .filter((v: SearchHit | null): v is SearchHit => v !== null)
                .sort((a: SearchHit, b: SearchHit) => {
                    if (a.marketplace !== b.marketplace) return a.marketplace.localeCompare(b.marketplace)
                    return a.order - b.order
                })

            setResults(hits)
        } catch (err) {
            console.error('Search failed:', err)
        }

        setLoading(false)
    }, [query])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch()
    }

    const navigateTo = (path: string) => {
        router.push(path)
        setIsOpen(false)
    }

    // Group results by marketplace
    const groupedResults = results.reduce<Record<string, SearchHit[]>>((acc, hit) => {
        const key = `${hit.marketEmoji} ${hit.marketplace}`
        if (!acc[key]) acc[key] = []
        acc[key].push(hit)
        return acc
    }, {})

    return (
        <>
            {/* Search Trigger Button */}
            <button
                onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
                className="w-full flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-800
          rounded-lg text-slate-500 hover:text-slate-300 hover:border-slate-700
          hover:bg-slate-900 transition-all text-xs group"
            >
                <Search className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">Find ASIN...</span>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700
          group-hover:border-slate-600">⌘K</kbd>
            </button>

            {/* Search Panel Overlay */}
            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]" onClick={() => setIsOpen(false)} />

                    <div ref={panelRef} className="fixed top-[12%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[9999]">
                        <div
                            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {/* Search Input */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                                <Search className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Search ASIN across all marketplaces..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value.toUpperCase())}
                                    onKeyDown={handleKeyDown}
                                    className="flex-1 bg-transparent text-white text-sm placeholder-slate-600
                    focus:outline-none font-mono tracking-wide"
                                    autoFocus
                                />
                                {loading ? (
                                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                ) : query ? (
                                    <button
                                        onClick={() => { setQuery(''); setResults([]); setSearched(false) }}
                                        className="text-slate-500 hover:text-slate-300"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                ) : null}
                                <button
                                    onClick={handleSearch}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg
                    font-medium transition-colors"
                                >
                                    Search
                                </button>
                            </div>

                            {/* Results */}
                            <div className="max-h-[65vh] overflow-y-auto">
                                {!searched && !loading && (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-2">🔍</div>
                                        <p className="text-slate-400 text-sm">Type an ASIN and press Enter</p>
                                        <p className="text-slate-600 text-xs mt-1">
                                            Searches {ALL_TARGETS.length} tables across {MARKETPLACES.length} markets
                                        </p>
                                    </div>
                                )}

                                {searched && !loading && results.length === 0 && (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-2">😕</div>
                                        <p className="text-slate-300 font-medium">ASIN not found</p>
                                        <p className="text-slate-500 text-sm mt-1">
                                            <span className="font-mono text-indigo-400">{query}</span> doesn&apos;t exist in any table
                                        </p>
                                    </div>
                                )}

                                {searched && !loading && results.length > 0 && (
                                    <>
                                        {/* Summary bar */}
                                        <div className="px-4 py-2.5 bg-indigo-500/5 border-b border-slate-800 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-xs text-slate-300">
                                                Found in <span className="text-indigo-400 font-bold">{results.length}</span> location{results.length !== 1 ? 's' : ''}
                                                {' '}across <span className="text-indigo-400 font-bold">{Object.keys(groupedResults).length}</span> market{Object.keys(groupedResults).length !== 1 ? 's' : ''}
                                            </span>
                                            {results[0]?.productName && (
                                                <span className="text-xs text-slate-500 truncate ml-auto max-w-[200px]">
                                                    {results[0].productName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Grouped by marketplace */}
                                        {Object.entries(groupedResults).map(([marketKey, hits]) => (
                                            <div key={marketKey}>
                                                {/* Market header */}
                                                <div className="px-4 py-2 bg-slate-800/40 border-b border-slate-800/50 flex items-center justify-between sticky top-0 z-10">
                                                    <span className="text-xs font-bold text-white tracking-wide">{marketKey}</span>
                                                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                                                        {hits.length} location{hits.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                {/* Each hit as a breadcrumb row */}
                                                {hits.map((hit, i) => {
                                                    const crumbs = buildBreadcrumb(hit)
                                                    return (
                                                        <button
                                                            key={`${hit.table}-${i}`}
                                                            onClick={() => navigateTo(hit.routePath)}
                                                            className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-800/60
                                transition-all text-left group border-b border-slate-800/30 last:border-0"
                                                        >
                                                            {/* Stage icon dot */}
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStageColor(hit.stage).replace('text-', 'bg-')
                                                                }`} />

                                                            {/* Breadcrumb path */}
                                                            <div className="flex-1 flex items-center gap-1 flex-wrap min-w-0">
                                                                {crumbs.map((crumb, ci) => (
                                                                    <span key={ci} className="flex items-center gap-1">
                                                                        {ci > 0 && (
                                                                            <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                                                        )}
                                                                        <span className={`text-xs font-medium whitespace-nowrap ${ci === crumbs.length - 1
                                                                            ? getStageColor(hit.stage)
                                                                            : ci === 0 ? 'text-slate-300' : 'text-slate-400'
                                                                            }`}>
                                                                            {crumb}
                                                                        </span>
                                                                    </span>
                                                                ))}
                                                                {hit.status && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded ml-1 border border-amber-500/20">
                                                                        {hit.status}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Go arrow */}
                                                            <ExternalLink className="w-3.5 h-3.5 text-slate-700 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between bg-slate-900/80">
                                <span className="text-[10px] text-slate-600">
                                    {ALL_TARGETS.length} tables · {MARKETPLACES.length} markets
                                </span>
                                <div className="flex items-center gap-3 text-[10px] text-slate-600">
                                    <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">Enter</kbd> Search</span>
                                    <span><kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">Esc</kbd> Close</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    )
}
