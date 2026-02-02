import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SELLERS = [
  { id: 1, name: 'golden_aura', code: 'GR' },
  { id: 2, name: 'rudra_retail', code: 'RR' },
  { id: 3, name: 'ubeauty', code: 'UB' },
  { id: 4, name: 'velvet_vista', code: 'VV' },
];

export function useUKDashboardStats(options = { enabled: true }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(options.enabled);

  // ✅ Wrap fetchStats in useCallback so it stays stable
  const fetchStats = useCallback(async () => {
    try {
      // Don't set loading=true here to avoid "flashing" on every update
      const newStats = {
        brandChecking: { sellers: [] as any[] },
        validation: { sellers: [] as any[] },
        listing: { sellers: [] as any[] },
        purchasing: { sellers: [] as any[] },
      };

      const promises = SELLERS.map(async (seller) => {
        // 1. BRAND CHECKING
        const tabs = ['high_demand', 'low_demand', 'dropshipping'];
        let bcPending = 0;
        for (const tab of tabs) {
          const { count } = await supabase
            .from(`uk_seller_${seller.id}_${tab}`)
            .select('*', { count: 'exact', head: true });
          bcPending += count || 0;
        }

        // 2. VALIDATION
        const { count: valPending } = await supabase
          .from('uk_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .or('judgement.is.null,judgement.eq.PENDING');

        const { count: valPassed } = await supabase
          .from('uk_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'PASS');
        
         const { count: valFailed } = await supabase
          .from('uk_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'FAIL'); 

        // 3. LISTING ERRORS
        const { count: listErrors } = await supabase
          .from(`uk_listing_error_seller_${seller.id}_error`)
          .select('*', { count: 'exact', head: true });

        // 4. PURCHASING (Ready to Buy)
        const { count: purchPending } = await supabase
          .from('uk_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'PASS')
          .not('sent_to_purchases', 'eq', true); // Waiting to be sent

        const { count: purchDone } = await supabase
          .from('uk_validation_main_file')
          .select('*', { count: 'exact', head: true })
          .eq('seller_tag', seller.code)
          .eq('judgement', 'PASS')
          .eq('sent_to_purchases', true); // Already sent to purchase team

        return {
          id: seller.id,
          name: seller.name,
          brandChecking: { pending: bcPending },
          validation: { pending: valPending || 0, passed: valPassed || 0, failed: valFailed || 0 },
          listing: { errors: listErrors || 0 },
          purchasing: { pending: purchPending || 0, completed: purchDone || 0 }
        };
      });

      const results = await Promise.all(promises);

      newStats.brandChecking.sellers = results.map(r => ({ id: r.id, pending: r.brandChecking.pending }));
      newStats.validation.sellers = results.map(r => ({ id: r.id, pending: r.validation.pending, approved: r.validation.passed, notApproved: r.validation.failed }));
      newStats.listing.sellers = results.map(r => ({ id: r.id, notApproved: r.listing.errors }));
      newStats.purchasing.sellers = results.map(r => ({ id: r.id, approved: r.purchasing.completed, pending: r.purchasing.pending }));

      setStats(newStats);
    } catch (error) {
      console.error("Stats Error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!options.enabled) return;

    // 1. Initial Load
    fetchStats();

    // 2. Realtime Subscription (The Magic ✨)
    const channel = supabase
      .channel('uk-dashboard-stats-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'uk_validation_main_file' },
        (payload) => {
          console.log('🔄 Realtime update detected:', payload.eventType);
          fetchStats(); // Re-fetch stats when data changes
        }
      )
      // Optional: Add listeners for error tables if you want listing errors real-time too
      .subscribe();

    // 3. Visibility Refresh (Backup)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStats();
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