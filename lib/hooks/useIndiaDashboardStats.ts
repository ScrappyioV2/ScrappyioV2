import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SELLERS = [
  { id: 1, name: 'Golden Aura', code: 'GA' },
  { id: 2, name: 'Rudra Retail', code: 'RR' },
  { id: 3, name: 'Ubeauty', code: 'UB' },
  { id: 4, name: 'Velvet Vista', code: 'VV' },
];

const CACHE_KEY = 'india_dashboard_stats_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function loadCache() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed._ts || 0) < CACHE_TTL) return parsed.data;
  } catch { }
  return null;
}

function saveCache(data: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, _ts: Date.now() }));
  } catch { }
}

export function useIndiaDashboardStats(options = { enabled: true }) {
  const [stats, setStats] = useState<any>(() => loadCache());
  const [loading, setLoading] = useState(!loadCache() && options.enabled);
  const isFetching = useRef(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    if (!silent) setLoading(true);

    try {
      const newStats = {
        brandChecking: { sellers: [] as any[] },
        validation: { sellers: [] as any[] },
        listing: { sellers: [] as any[] },
        purchasing: { sellers: [] as any[] },
      };

      const promises = SELLERS.map(async (seller) => {
        const { data: bcData } = await supabase
          .from('india_brand_check_progress')
          .select('total, approved, notapproved')
          .eq('sellerid', seller.id)
          .single();

        const bcTotal = bcData?.total || 0;
        const bcApproved = bcData?.approved || 0;
        const bcNotApproved = bcData?.notapproved || 0;
        const bcPending = bcTotal;

        const { count: valPending } = await supabase
          .from('india_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .or('judgement.is.null,judgement.eq.PENDING');

        const { count: valPassed } = await supabase
          .from('india_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'PASS');

        const { count: valFailed } = await supabase
          .from('india_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'FAIL');

        const { count: listErrors } = await supabase
          .from(`india_listing_error_seller_${seller.id}_error`)
          .select('*', { count: 'exact', head: true });

        const { count: purchPending } = await supabase
          .from('india_purchases')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .or('status.is.null,status.eq.pending');

        const { count: purchDone } = await supabase
          .from('india_purchases')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('status', 'done');

        return {
          id: seller.id,
          name: seller.name,
          brandChecking: { pending: bcPending, approved: bcApproved, notApproved: bcNotApproved, total: bcTotal },
          validation: { pending: valPending || 0, passed: valPassed || 0, failed: valFailed || 0 },
          listing: { errors: listErrors || 0 },
          purchasing: { pending: purchPending || 0, completed: purchDone || 0 }
        };
      });

      const results = await Promise.all(promises);

      newStats.brandChecking.sellers = results.map(r => ({
        id: r.id,
        pending: r.brandChecking.pending,
        approved: r.brandChecking.approved,
        notApproved: r.brandChecking.notApproved,
        total: r.brandChecking.total,
      }));
      newStats.validation.sellers = results.map(r => ({ id: r.id, pending: r.validation.pending, approved: r.validation.passed, notApproved: r.validation.failed }));
      newStats.listing.sellers = results.map(r => ({ id: r.id, notApproved: r.listing.errors }));
      newStats.purchasing.sellers = results.map(r => ({ id: r.id, approved: r.purchasing.completed, pending: r.purchasing.pending }));

      setStats(newStats);
      saveCache(newStats);
    } catch (error) {
      console.error("India Stats Error:", error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    if (!options.enabled) return;

    // If we have cache, fetch silently in background
    // If no cache, fetch with loading spinner
    fetchStats(!!stats);

    const channel = supabase
      .channel('india-dashboard-stats-changes')
      // VALIDATION
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_validation_main_file' },
        () => fetchStats(true)
      )

      // PURCHASING
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_purchases' },
        () => fetchStats(true)
      )

      // BRAND CHECKING (progress table)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_brand_check_progress' },
        () => fetchStats(true)
      )

      // LISTING ERRORS
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_listing_error_seller_1_error' },
        () => fetchStats(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_listing_error_seller_2_error' },
        () => fetchStats(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_listing_error_seller_3_error' },
        () => fetchStats(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'india_listing_error_seller_4_error' },
        () => fetchStats(true)
      )

      .subscribe();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats(true);  // Silent on tab return
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [options.enabled, fetchStats]);

  return { stats, loading };
}
