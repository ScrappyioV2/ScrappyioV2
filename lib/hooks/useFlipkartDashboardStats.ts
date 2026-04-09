import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const SELLERS = [
    { id: 1, name: 'Golden Aura', code: 'GR' }, // Note: India used 'GR' for Golden Aura in your logs, checking if 'GA' was a typo. Sticking to DB tags.
    { id: 2, name: 'Rudra Retail', code: 'RR' },
    { id: 3, name: 'Ubeauty', code: 'UB' },
    { id: 4, name: 'Velvet Vista', code: 'VV' },
    { id: 5, name: 'Dropy Ecom', code: 'DE' },      // ✅ NEW
    { id: 6, name: 'Costech Ventures', code: 'CV' }, // ✅ NEW
];

export function useFlipkartDashboardStats(options = { enabled: true }) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(options.enabled);

    const fetchStats = useCallback(async () => {
        try {
            const newStats = {
                brandChecking: { sellers: [] as any[] },
                validation: { sellers: [] as any[] },
                listing: { sellers: [] as any[] },
                purchasing: { sellers: [] as any[] },
            };

            const promises = SELLERS.map(async (seller) => {
                // 1. BRAND CHECKING - Count from High Demand, Low Demand, Dropshipping
                const tabs = ['high_demand', 'low_demand', 'dropshipping'];
                let bcPending = 0;
                for (const tab of tabs) {
                    const { count } = await supabase
                        .from(`flipkart_seller_${seller.id}_${tab}`)
                        .select('*', { count: 'exact', head: true });
                    bcPending += count || 0;
                }

                // 2. VALIDATION - Uses seller_tag and judgement (not validation_status)
                const { count: valPending } = await supabase
                    .from('flipkart_validation_main_file')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_tag', seller.code)
                    .or('judgement.is.null,judgement.eq.PENDING');

                const { count: valPassed } = await supabase
                    .from('flipkart_validation_main_file')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_tag', seller.code)
                    .eq('judgement', 'PASS');

                const { count: valFailed } = await supabase
                    .from('flipkart_validation_main_file')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_tag', seller.code)
                    .eq('judgement', 'FAIL');

                // 3. LISTING ERRORS
                const { count: listErrors } = await supabase
                    .from(`flipkart_listing_error_seller_${seller.id}_error`)
                    .select('*', { count: 'exact', head: true });

                // 4. PURCHASING - Uses seller_tag (not seller_id)
                const { count: purchPending } = await supabase
                    .from('flipkart_purchases')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_tag', seller.code)
                    .or('status.is.null,status.eq.pending');

                const { count: purchDone } = await supabase
                    .from('flipkart_purchases')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_tag', seller.code)
                    .eq('status', 'done');

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
            console.error("India Stats Error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!options.enabled) return;

        // 1. Initial Load
        fetchStats();

        // 2. Realtime Subscription
        const channel = supabase
            .channel('flipkart-dashboard-stats-changes') // ✅ UPDATED
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'flipkart_validation_main_file' }, // ✅ UPDATED
                (payload) => {
                    fetchStats();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'flipkart_purchases' }, // ✅ UPDATED
                (payload) => {
                    fetchStats();
                }
            )
            .subscribe();

        // 3. Visibility Refresh
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
