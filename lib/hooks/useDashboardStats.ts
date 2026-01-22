import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SELLERS = [
  { id: 1, name: 'golden_aura', code: 'GR' },
  { id: 2, name: 'rudra_retail', code: 'RR' },
  { id: 3, name: 'ubeauty', code: 'UB' },
  { id: 4, name: 'velvet_vista', code: 'VV' },
];

export function useDashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const newStats = {
          brandChecking: { sellers: [] as any[] },
          validation: { sellers: [] as any[] },
          listing: { sellers: [] as any[] },
          purchasing: { sellers: [] as any[] },
        };

        const promises = SELLERS.map(async (seller) => {
          // 1. BRAND CHECKING (Active Tabs)
          const tabs = ['high_demand', 'low_demand', 'dropshipping'];
          let bcPending = 0;
          for (const tab of tabs) {
            const { count } = await supabase
              .from(`usa_seller_${seller.id}_${tab}`)
              .select('*', { count: 'exact', head: true });
            bcPending += count || 0;
          }

          // 2. VALIDATION (From Main File)
          // Pending: In main file, Judgement is NULL or PENDING
          const { count: valPending } = await supabase
            .from('usa_validation_main_file')
            .select('*', { count: 'exact', head: true })
            .eq('seller_tag', seller.code) // ✅ Use .eq() to prevent 400 error
            .or('judgement.is.null,judgement.eq.PENDING'); 

          // Passed: Judgement is PASS
          const { count: valPassed } = await supabase
            .from('usa_validation_main_file')
            .select('*', { count: 'exact', head: true })
            .eq('seller_tag', seller.code)
            .eq('judgement', 'PASS');
          
          // Failed: Judgement is FAIL
           const { count: valFailed } = await supabase
            .from('usa_validation_main_file')
            .select('*', { count: 'exact', head: true })
            .eq('seller_tag', seller.code)
            .eq('judgement', 'FAIL'); 

          // 3. LISTING ERRORS
          // Active errors in the error table
          const { count: listErrors } = await supabase
            .from(`usa_listing_error_seller_${seller.id}_error`)
            .select('*', { count: 'exact', head: true });

          // 4. PURCHASING 
          // ✅ FIX: Use 'sent_to_purchases' instead of 'buying_price'
          
          // Pending Purchase: Validated (PASS) but NOT yet sent to purchases
          const { count: purchPending } = await supabase
            .from('usa_validation_main_file')
            .select('*', { count: 'exact', head: true })
            .eq('seller_tag', seller.code)
            .eq('judgement', 'PASS')
            .not('sent_to_purchases', 'eq', true); // Count items NOT sent yet

          // Purchased: Validated (PASS) AND Sent to purchases
          const { count: purchDone } = await supabase
            .from('usa_validation_main_file')
            .select('*', { count: 'exact', head: true })
            .eq('seller_tag', seller.code)
            .eq('judgement', 'PASS')
            .eq('sent_to_purchases', true); // Count items ALREADY sent

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
    }

    // Initial Fetch
    fetchStats();

    // Auto-refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Dashboard stats visible: Refreshing...');
        fetchStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { stats, loading };
}