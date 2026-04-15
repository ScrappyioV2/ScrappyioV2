// ============================================
// lib/listing-error-helpers.ts
// Drop-in helpers for the unified listing_errors table
// ============================================

import { SupabaseClient } from '@supabase/supabase-js';

// Types
export type TabType = 'high_demand' | 'low_demand' | 'dropshipping' | 'done' | 'pending' | 'error' | 'removed';
export type Marketplace = 'india' | 'usa' | 'uk' | 'uae' | 'flipkart';

export interface ListingProduct {
  id: string;
  asin: string;
  product_name: string | null;
  sku: string | null;
  selling_price: number | null;
  seller_link: string | null;
  min_price?: number | null;
  max_price?: number | null;
  listing_notes?: string | null;
  error_reason?: string | null;
  source_admin_validation_id?: string;
  journey_id?: string | null;
  journey_number?: number | null;
  remark: string | null;
  seller_tag?: string | null;
  error_status?: string;
  _sourceTable?: string; // for compatibility during migration
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Get a base query for listing errors filtered by marketplace + seller + status.
 * 
 * BEFORE: supabase.from(`india_listing_error_seller_1_${activeTab}`)
 * AFTER:  queryListingErrors(supabase, 'india', 1, activeTab)
 */
export function queryListingErrors(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  errorStatus: string
) {
  return supabase
    .from('listing_errors')
    .select('*')
    .eq('marketplace', marketplace)
    .eq('seller_id', sellerId)
    .eq('error_status', errorStatus);
}

/**
 * Count rows for a specific status.
 */
export function countListingErrors(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  errorStatus: string
) {
  return supabase
    .from('listing_errors')
    .select('*', { count: 'exact', head: true })
    .eq('marketplace', marketplace)
    .eq('seller_id', sellerId)
    .eq('error_status', errorStatus);
}

/**
 * Get products for "Restock" tab (high_demand + low_demand combined).
 */
export async function fetchRestockProducts(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  options?: { search?: string; page?: number; perPage?: number }
) {
  const { search, page = 1, perPage = 100 } = options || {};
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('listing_errors')
    .select('*', { count: 'exact' })
    .eq('marketplace', marketplace)
    .eq('seller_id', sellerId)
    .in('error_status', ['high_demand', 'low_demand']);

  if (search) {
    query = query.or(`asin.ilike.%${search}%,product_name.ilike.%${search}%`);
  }

  return query.order('created_at', { ascending: false }).range(from, to);
}

/**
 * Fetch products for a single status tab.
 */
export async function fetchTabProducts(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  status: TabType,
  options?: { search?: string; page?: number; perPage?: number }
) {
  if (status === 'high_demand') {
    return fetchRestockProducts(supabase, marketplace, sellerId, options);
  }

  const { search, page = 1, perPage = 100 } = options || {};
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from('listing_errors')
    .select('*', { count: 'exact' })
    .eq('marketplace', marketplace)
    .eq('seller_id', sellerId)
    .eq('error_status', status);

  if (search) {
    query = query.or(`asin.ilike.%${search}%,product_name.ilike.%${search}%`);
  }

  return query.order('created_at', { ascending: false }).range(from, to);
}

// ============================================
// MOVE HELPERS
// ============================================

/**
 * Move a product to a new status.
 * 
 * BEFORE: delete from source table + insert into target table (2 operations)
 * AFTER:  single UPDATE changing the error_status column
 */
export async function moveProduct(
  supabase: SupabaseClient,
  productId: string,
  newStatus: string,
  extraFields?: Record<string, any>
) {
  return supabase
    .from('listing_errors')
    .update({
      error_status: newStatus,
      updated_at: new Date().toISOString(),
      ...extraFields,
    })
    .eq('id', productId);
}

/**
 * Move product and log history in one go.
 */
export async function moveProductWithHistory(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  product: ListingProduct,
  fromStatus: string,
  toStatus: string,
  extraFields?: Record<string, any>
) {
  // If moving to done/listed, remove any existing row with same status to prevent unique constraint violation
  if (toStatus === 'done' || toStatus === 'error' || toStatus === 'removed') {
    await supabase
      .from('listing_errors')
      .delete()
      .eq('marketplace', marketplace)
      .eq('seller_id', sellerId)
      .eq('asin', product.asin)
      .eq('error_status', toStatus)
      .neq('id', product.id);
  }

  // Move the product (just update the status)
  const { error: moveError } = await moveProduct(supabase, product.id, toStatus, extraFields);
  if (moveError) throw moveError;

  // Log movement history
  const { error: historyError } = await supabase
    .from('listing_errors')
    .upsert({
      marketplace,
      seller_id: sellerId,
      error_status: 'movement_history',
      asin: product.asin,
      product_name: product.product_name,
      sku: product.sku,
      selling_price: product.selling_price,
      seller_link: product.seller_link,
      source_admin_validation_id: product.source_admin_validation_id || null,
      from_table: fromStatus,
      to_table: toStatus,
      remark: product.remark ?? null,
      moved_at: new Date().toISOString(),
    }, { onConflict: 'marketplace,seller_id,asin,error_status' });

  if (historyError) console.error('History log failed:', historyError);
}

/**
 * Rollback: move a product back to its previous status.
 */
export async function rollbackProduct(
  supabase: SupabaseClient,
  productId: string,
  previousStatus: string
) {
  return supabase
    .from('listing_errors')
    .update({
      error_status: previousStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
}

/**
 * Delete a product from listing_errors entirely.
 */
export async function deleteProduct(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  asin: string
) {
  return supabase
    .from('listing_errors')
    .delete()
    .eq('marketplace', marketplace)
    .eq('asin', asin)
    .neq('error_status', 'movement_history'); // preserve history
}

/**
 * Check if ASIN is listed (done) by ANY seller in a marketplace.
 */
export async function checkCrossSellerStatus(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  asins: string[],
  excludeSellerId: number
) {
  if (asins.length === 0) return {};

  const { data } = await supabase
    .from('listing_errors')
    .select('asin, seller_id')
    .eq('marketplace', marketplace)
    .eq('error_status', 'done')
    .neq('seller_id', excludeSellerId)
    .in('asin', asins);

  const result: Record<string, number[]> = {};
  data?.forEach(row => {
    if (!result[row.asin]) result[row.asin] = [];
    result[row.asin].push(row.seller_id);
  });
  return result;
}

/**
 * Update remark for a product.
 */
export async function updateRemark(
  supabase: SupabaseClient,
  productId: string,
  remark: string
) {
  return supabase
    .from('listing_errors')
    .update({ remark, updated_at: new Date().toISOString() })
    .eq('id', productId);
}

// ============================================
// REALTIME HELPER
// ============================================

/**
 * Subscribe to changes for a specific marketplace + seller.
 * 
 * BEFORE: subscribe to each individual table name
 * AFTER:  subscribe once with a filter
 */
export function subscribeToListingErrors(
  supabase: SupabaseClient,
  marketplace: Marketplace,
  sellerId: number,
  onUpdate: () => void
) {
  const channel = supabase
    .channel(`listing_errors_${marketplace}_${sellerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'listing_errors',
        filter: `marketplace=eq.${marketplace}`,
      },
      (payload) => {
        // Only react to changes for this seller
        const row = (payload.new || payload.old) as any;
        if (row?.seller_id === sellerId) {
          onUpdate();
        }
      }
    )
    .subscribe();

  return channel;
}

// ============================================
// BACKWARD COMPATIBILITY
// ============================================

/**
 * Convert old table name to marketplace + seller_id + status.
 * Useful during migration period.
 * 
 * 'india_listing_error_seller_3_done' → { marketplace: 'india', sellerId: 3, status: 'done' }
 */
export function parseOldTableName(tableName: string): {
  marketplace: Marketplace;
  sellerId: number;
  status: string;
} | null {
  const match = tableName.match(/^(\w+)_listing_error_seller_(\d+)_(\w+)$/);
  if (!match) return null;
  return {
    marketplace: match[1] as Marketplace,
    sellerId: parseInt(match[2]),
    status: match[3],
  };
}