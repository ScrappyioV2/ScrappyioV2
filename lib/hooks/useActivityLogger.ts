import { useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';

interface LogActivityParams {
  action: string;      // 'approve' | 'reject' | 'not_approve' | 'pass' | 'fail' | 'move' | 'upload' | 'delete' | 'confirm' | 'submit'
  marketplace: string; // 'usa' | 'india' | 'uk' | 'uae' | 'flipkart'
  page: string;        // 'brand-checking' | 'validation' | 'listing-error' | 'purchases' | 'tracking' | 'reorder' | 'admin-validation'
  table_name?: string;
  asin?: string;
  details?: Record<string, any>;
}

export function useActivityLogger() {
  const { user, userRole } = useAuth();

  const logActivity = useCallback(async (params: LogActivityParams) => {
    if (!user) return;
    try {
      await supabase.rpc('log_user_activity', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_full_name: userRole?.full_name || null,
        p_action: params.action,
        p_marketplace: params.marketplace,
        p_page: params.page,
        p_table_name: params.table_name || null,
        p_asin: params.asin || null,
        p_details: params.details || {},
      });
    } catch (err) {
      console.error('Activity log error:', err);
      // Never block the main action — logging failures are silent
    }
  }, [user, userRole]);

  // Batch log for bulk operations (e.g. approving 50 products at once)
  const logBatchActivity = useCallback(async (
    items: { asin: string; details?: Record<string, any> }[],
    common: Omit<LogActivityParams, 'asin' | 'details'>
  ) => {
    if (!user || items.length === 0) return;
    try {
      const rows = items.map(item => ({
        user_id: user.id,
        email: user.email || '',
        full_name: userRole?.full_name || null,
        action: common.action,
        marketplace: common.marketplace,
        page: common.page,
        table_name: common.table_name || null,
        asin: item.asin,
        details: item.details || {},
      }));

      // Insert only REAL rows (no phantom batch_ row)
      await supabase.from('user_activity_log').insert(rows);

      // Update summary with actual count (no log row created)
      await supabase.rpc('increment_daily_summary', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_full_name: userRole?.full_name || null,
        p_marketplace: common.marketplace,
        p_page: common.page,
        p_action: common.action,
        p_count: items.length,
      });
    } catch (err) {
      console.error('Batch activity log error:', err);
    }
  }, [user, userRole]);

  return { logActivity, logBatchActivity };
}
