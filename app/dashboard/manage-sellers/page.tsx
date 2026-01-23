'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '../../../lib/hooks/useAuth';
import { motion } from 'framer-motion';
import {
  Users,
  Globe,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  Database,
  ArrowRight,
  Loader2
} from 'lucide-react';

/* === TYPES === */
interface CountryProgress {
  country: string;
  totalLinks: number;
  copiedLinks: number;
  resetAt: string | null;
  completedAt: string | null;
}

export default function ManageSellersPage() {
  const router = useRouter();
  const { user, userRole, loading: authLoading } = useAuth();

  const [authMessage, setAuthMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [progress, setProgress] = useState<Record<string, CountryProgress>>({
    usa: { country: 'usa', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    india: { country: 'india', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    uae: { country: 'uae', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null },
    uk: { country: 'uk', totalLinks: 0, copiedLinks: 0, resetAt: null, completedAt: null }
  });

  // Config for UI Mapping
  const countryConfig = {
    usa: { label: 'United States', code: 'US', flag: '🇺🇸', color: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500/20', glow: 'shadow-blue-500/20' },
    india: { label: 'India', code: 'IN', flag: '🇮🇳', color: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/20', glow: 'shadow-orange-500/20' },
    uae: { label: 'UAE', code: 'AE', flag: '🇦🇪', color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/20' },
    uk: { label: 'United Kingdom', code: 'GB', flag: '🇬🇧', color: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-500/20', glow: 'shadow-rose-500/20' },
  };

  const debouncedFetchProgressRef = useRef<NodeJS.Timeout | null>(null);

  /* === LOGIC: FETCH PROGRESS === */
  const fetchProgress = async () => {
    if (!supabase || !user) return;
    try {
      const countries = ['usa', 'india', 'uae', 'uk'];
      const progressData: Record<string, CountryProgress> = {};

      const { data: timestamps } = await supabase
        .from('copy_progress_timestamps')
        .select('*')
        .eq('user_id', user.id);

      const timestampMap: Record<string, any> = {};
      timestamps?.forEach(t => { timestampMap[t.country] = t; });

      for (const country of countries) {
        const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`;

        const { count: totalCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const { count: copiedCount } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_copied', true);

        progressData[country] = {
          country,
          totalLinks: totalCount || 0,
          copiedLinks: copiedCount || 0,
          resetAt: timestampMap[country]?.reset_at || null,
          completedAt: timestampMap[country]?.completed_at || null
        };
      }
      setProgress(progressData);
    } catch (error: any) {
      if (error.name !== 'AbortError') console.error('Error fetching progress:', error);
    }
  };

  const debouncedFetchProgress = () => {
    if (debouncedFetchProgressRef.current) clearTimeout(debouncedFetchProgressRef.current);
    debouncedFetchProgressRef.current = setTimeout(() => { fetchProgress(); }, 500);
  };

  useEffect(() => { if (user) fetchProgress(); }, [user]);

  /* === LOGIC: REALTIME SUBSCRIPTION === */
  useEffect(() => {
    if (!user || !supabase) return;
    const subscriptions: any[] = [];
    const countries = ['usa', 'india', 'uae', 'uk'];

    countries.forEach((country) => {
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`;
      const subscription = supabase
        .channel(`${country}_realtime_copy`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
          console.log(`🔔 Real-time update for ${country}`);
          debouncedFetchProgress();
        })
        .subscribe();
      subscriptions.push(subscription);
    });

    return () => { subscriptions.forEach((sub) => supabase.removeChannel(sub)); };
  }, [user]);

  /* === LOGIC: RESET === */
  const resetAllCopied = async (country: string) => {
    if (!supabase || !user) return;
    try {
      const tableName = country === 'usa' ? 'us_sellers' : `${country}_sellers`;
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: links } = await supabase
          .from(tableName).select('id').eq('user_id', user.id).eq('is_copied', true).range(offset, offset + BATCH_SIZE - 1);

        if (!links || links.length === 0) { hasMore = false; break; }

        const ids = links.map(link => link.id);
        await supabase.from(tableName).update({ is_copied: false }).in('id', ids);

        offset += BATCH_SIZE;
        if (links.length < BATCH_SIZE) hasMore = false;
      }

      await supabase.from('copy_progress_timestamps').upsert({
        user_id: user.id, country: country, total_links: progress[country].totalLinks, copied_links: 0,
        reset_at: new Date().toISOString(), completed_at: null
      }, { onConflict: 'user_id,country' });

      await fetchProgress();
      setAuthMessage({ text: `Reset completed for ${country.toUpperCase()}!`, type: 'success' });
      setTimeout(() => setAuthMessage(null), 3000);
    } catch (error) {
      console.error('Error resetting:', error);
      setAuthMessage({ text: 'Error resetting progress', type: 'error' });
      setTimeout(() => setAuthMessage(null), 3000);
    }
  };

  const handleCardClick = (country: string) => {
    router.push(`/dashboard/manage-sellers/add-seller?country=${country}`);
  };

  // Animation Variants
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">

      <motion.div variants={container} initial="hidden" animate="show" className="max-w-7xl mx-auto space-y-8">

        {/* === HEADER === */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800/60">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
                <Globe className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Seller Management</h1>
            </div>
            <p className="text-slate-400 pl-[3.25rem]">
              Manage scraping sources and monitor copy progress across regions.
            </p>
          </div>
          {user && userRole && (
            <div className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full bg-emerald-500 animate-pulse`} />
              {userRole.full_name || user.email}
            </div>
          )}
        </div>

        {/* === AUTH MESSAGE === */}
        {authMessage && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-xl border ${authMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} flex items-center gap-3`}>
            {authMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5" />}
            {authMessage.text}
          </motion.div>
        )}

        {/* === COUNTRY GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.keys(progress).map((key) => {
            const country = key as keyof typeof countryConfig;
            const data = progress[country];
            const config = countryConfig[country];
            const percentage = data.totalLinks > 0 ? Math.round((data.copiedLinks / data.totalLinks) * 100) : 0;

            return (
              <motion.div
                key={country}
                variants={item}
                className={`group relative bg-slate-900/40 border border-slate-800 hover:border-slate-700 p-6 rounded-2xl backdrop-blur-sm transition-all duration-300 overflow-hidden hover:shadow-2xl hover:shadow-black/50`}
              >
                {/* Background Glow */}
                <div className={`absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br ${config.color.replace('text-', 'from-')}/10 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                {/* Header */}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl filter drop-shadow-md grayscale group-hover:grayscale-0 transition-all duration-300">
                      {config.flag}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {config.label}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${config.border} bg-slate-900 ${config.color}`}>
                          {config.code}
                        </span>
                      </h3>
                      <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                        <Database className="w-3 h-3" />
                        <span>{data.totalLinks.toLocaleString()} Total Sellers</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Section */}
                <div className="mb-8 relative z-10">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span className="text-slate-400">Copy Progress</span>
                    {/* ✅ CHANGED: Show count instead of percentage */}
                    <span className={config.color}>
                      {data.copiedLinks.toLocaleString()} / {data.totalLinks.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${config.bg} shadow-[0_0_15px_-2px_currentColor]`}
                    />
                  </div>

                  {/* Timestamp Info */}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono">
                    {data.resetAt && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>Reset: {new Date(data.resetAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {data.completedAt && (
                      <div className="flex items-center gap-1.5 text-emerald-500/80">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Done: {new Date(data.completedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-800/50 relative z-10">
                  <button
                    onClick={() => handleCardClick(country)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all group-hover:ring-1 ring-inset ring-slate-700`}
                  >
                    <Plus className="w-4 h-4" />
                    Add Seller
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); resetAllCopied(country); }}
                    disabled={data.copiedLinks === 0}
                    className="px-4 py-2.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white hover:bg-rose-500/10 hover:border-rose-500/50 hover:shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    title="Reset Copy Progress"
                  >
                    <RefreshCw className={`w-4 h-4 ${data.copiedLinks > 0 ? '' : ''}`} />
                  </button>
                </div>

              </motion.div>
            );
          })}
        </div>

      </motion.div>
    </div>
  );
}