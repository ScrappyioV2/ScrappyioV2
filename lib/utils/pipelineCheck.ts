import { supabase } from '@/lib/supabaseClient';

export type PipelineLocation = 'checking' | 'tracking' | 'purchases' | 'admin_validation' | 'validation';

export type PipelineResult = {
  location: PipelineLocation | null;
  seller_tags: string;
  stage_label: string;
  can_merge: boolean;
};

export async function checkAsinPipeline(asin: string): Promise<PipelineResult> {
  // Check deepest first (checking → tracking → purchases → admin → validation)
  const { data: checking } = await supabase
    .from('india_box_checking')
    .select('asin, seller_tag')
    .eq('asin', asin)
    .limit(1);
  if (checking && checking.length > 0) {
    return { location: 'checking', seller_tags: checking[0].seller_tag || '', stage_label: 'Checking', can_merge: false };
  }

  const { data: tracking } = await supabase
    .from('india_inbound_tracking')
    .select('asin, seller_tag')
    .eq('asin', asin)
    .limit(1);
  if (tracking && tracking.length > 0) {
    return { location: 'tracking', seller_tags: tracking[0].seller_tag || '', stage_label: 'Tracking', can_merge: false };
  }

  const { data: purchases } = await supabase
    .from('india_purchases')
    .select('asin, seller_tag, admin_confirmed')
    .eq('asin', asin)
    .limit(1);
  if (purchases && purchases.length > 0) {
    if (purchases[0].admin_confirmed) {
      return { location: 'purchases', seller_tags: purchases[0].seller_tag || '', stage_label: 'Purchases (Confirmed)', can_merge: false };
    }
    return { location: 'purchases', seller_tags: purchases[0].seller_tag || '', stage_label: 'Purchases', can_merge: true };
  }

  const { data: admin } = await supabase
    .from('india_admin_validation')
    .select('asin, seller_tag')
    .eq('asin', asin)
    .limit(1);
  if (admin && admin.length > 0) {
    return { location: 'admin_validation', seller_tags: admin[0].seller_tag || '', stage_label: 'Admin Validation', can_merge: true };
  }

  const { data: validation } = await supabase
    .from('india_validation_main_file')
    .select('asin, seller_tag')
    .eq('asin', asin)
    .limit(1);
  if (validation && validation.length > 0) {
    return { location: 'validation', seller_tags: validation[0].seller_tag || '', stage_label: 'Validation', can_merge: true };
  }

  return { location: null, seller_tags: '', stage_label: '', can_merge: false };
}

export async function batchCheckPipeline(asins: string[]): Promise<Map<string, PipelineResult>> {
  const result = new Map<string, PipelineResult>();
  if (asins.length === 0) return result;

  const uniqueAsins = [...new Set(asins)];

  // Fetch all 5 tables in parallel
  const [checkingRes, trackingRes, purchasesRes, adminRes, validationRes] = await Promise.all([
    supabase.from('india_box_checking').select('asin, seller_tag').in('asin', uniqueAsins),
    supabase.from('india_inbound_tracking').select('asin, seller_tag').in('asin', uniqueAsins),
    supabase.from('india_purchases').select('asin, seller_tag, admin_confirmed').in('asin', uniqueAsins),
    supabase.from('india_admin_validation').select('asin, seller_tag').in('asin', uniqueAsins),
    supabase.from('india_validation_main_file').select('asin, seller_tag').in('asin', uniqueAsins),
  ]);

  // Build lookup maps (deepest stage wins)
  const checkingMap = new Map<string, string>();
  (checkingRes.data || []).forEach((r: any) => checkingMap.set(r.asin, r.seller_tag || ''));

  const trackingMap = new Map<string, string>();
  (trackingRes.data || []).forEach((r: any) => trackingMap.set(r.asin, r.seller_tag || ''));

  const purchasesMap = new Map<string, { seller_tag: string; admin_confirmed: boolean }>();
  (purchasesRes.data || []).forEach((r: any) => purchasesMap.set(r.asin, { seller_tag: r.seller_tag || '', admin_confirmed: r.admin_confirmed }));

  const adminMap = new Map<string, string>();
  (adminRes.data || []).forEach((r: any) => adminMap.set(r.asin, r.seller_tag || ''));

  const validationMap = new Map<string, string>();
  (validationRes.data || []).forEach((r: any) => validationMap.set(r.asin, r.seller_tag || ''));

  // Priority: checking > tracking > purchases > admin_validation > validation
  for (const asin of uniqueAsins) {
    if (checkingMap.has(asin)) {
      result.set(asin, { location: 'checking', seller_tags: checkingMap.get(asin)!, stage_label: 'Checking', can_merge: false });
    } else if (trackingMap.has(asin)) {
      result.set(asin, { location: 'tracking', seller_tags: trackingMap.get(asin)!, stage_label: 'Tracking', can_merge: false });
    } else if (purchasesMap.has(asin)) {
      const p = purchasesMap.get(asin)!;
      if (p.admin_confirmed) {
        result.set(asin, { location: 'purchases', seller_tags: p.seller_tag, stage_label: 'Purchases (Confirmed)', can_merge: false });
      } else {
        result.set(asin, { location: 'purchases', seller_tags: p.seller_tag, stage_label: 'Purchases', can_merge: true });
      }
    } else if (adminMap.has(asin)) {
      result.set(asin, { location: 'admin_validation', seller_tags: adminMap.get(asin)!, stage_label: 'Admin Validation', can_merge: true });
    } else if (validationMap.has(asin)) {
      result.set(asin, { location: 'validation', seller_tags: validationMap.get(asin)!, stage_label: 'Validation', can_merge: true });
    }
  }

  return result;
}
