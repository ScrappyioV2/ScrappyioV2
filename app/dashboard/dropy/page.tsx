"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  FileCheck, ShoppingBag, Truck, AlertTriangle, Loader2,
  TrendingUp, Package, RotateCcw, ShieldCheck, LayoutList, ArrowRight
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111111] border border-white/[0.1] p-3 rounded-xl shadow-2xl">
        <p className="text-gray-500 font-bold mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400 w-24">{entry.name}:</span>
              <span className="font-mono font-bold text-white">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function DropyDashboard() {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    master: 0, validation: 0, purchases: 0, tracking: 0, listingErrors: 0,
    rs: 0, dp: 0, passed: 0, failed: 0, pending: 0, reworking: 0
  });

  useEffect(() => {
    if (authLoading) return;
    async function fetch() {
      setLoading(true);
      const [master, validation, purchases, tracking, listingErrors, rs, dp, passed, failed, pendingV, reworking] = await Promise.all([
        supabase.from('dropy_master_sellers').select('*', { count: 'exact', head: true }),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }),
        supabase.from('dropy_purchases').select('*', { count: 'exact', head: true }).is('move_to', null),
        supabase.from('dropy_inbound_tracking').select('*', { count: 'exact', head: true }),
        supabase.from('listing_errors').select('*', { count: 'exact', head: true }).eq('marketplace', 'dropy').eq('error_status', 'pending'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('funnel', 'RS'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('funnel', 'DP'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('judgement', 'PASS'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('judgement', 'FAIL'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).is('judgement', null),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('judgement', 'REWORKING'),
      ]);
      setCounts({
        master: master.count ?? 0, validation: validation.count ?? 0,
        purchases: purchases.count ?? 0, tracking: tracking.count ?? 0,
        listingErrors: listingErrors.count ?? 0,
        rs: rs.count ?? 0, dp: dp.count ?? 0,
        passed: passed.count ?? 0, failed: failed.count ?? 0,
        pending: pendingV.count ?? 0, reworking: reworking.count ?? 0,
      });
      setLoading(false);
    }
    fetch();
  }, [authLoading]);

  const chartData = useMemo(() => [
    { name: 'Validation', count: counts.validation },
    { name: 'Purchases', count: counts.purchases },
    { name: 'Tracking', count: counts.tracking },
    { name: 'Errors', count: counts.listingErrors },
  ], [counts]);

  const totalActive = counts.validation + counts.purchases + counts.tracking;

  return (
    <div className="h-full bg-[#111111] text-gray-100 p-3 sm:p-4 lg:p-6 font-sans selection:bg-orange-400/30 flex flex-col overflow-y-auto">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 sm:gap-0 mb-6 border-b border-white/[0.1] pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dropy Overview</h1>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm pl-1">
            Direct pipeline — <span className="text-orange-500 font-bold">no brand checking</span>, master to validation
          </p>
        </div>
        <div className="flex gap-3 self-end sm:self-auto">
          <div className="bg-[#111111] px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl border border-white/[0.1] shadow-xl flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Master</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-white">{counts.master.toLocaleString()}</span>
          </div>
          <div className="bg-[#111111] px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl border border-white/[0.1] shadow-xl flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Active</span>
            <span className="text-xl sm:text-2xl font-mono font-bold text-white">{totalActive.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
          <div className="w-10 h-10 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <span className="text-sm font-medium tracking-wide animate-pulse">SYNCING LIVE DATA...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">

          {/* LEFT: CHART + PIPELINE CARDS */}
          <div className="xl:col-span-2 flex flex-col gap-3 sm:gap-4">
            {/* Chart */}
            <div className="bg-[#1a1a1a] border border-white/[0.1] p-3 sm:p-4 rounded-2xl shadow-xl min-h-[280px] flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  Pipeline Volume
                </h2>
              </div>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                    <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Validation', count: counts.validation, icon: <FileCheck className="w-4 h-4 text-blue-400" />, href: '/dashboard/dropy/validation', accent: 'border-blue-500/20' },
                { label: 'Purchases', count: counts.purchases, icon: <ShoppingBag className="w-4 h-4 text-emerald-400" />, href: '/dashboard/dropy/purchases', accent: 'border-emerald-500/20' },
                { label: 'Tracking', count: counts.tracking, icon: <Truck className="w-4 h-4 text-purple-400" />, href: '/dashboard/dropy/tracking', accent: 'border-purple-500/20' },
                { label: 'Reorder', count: 0, icon: <RotateCcw className="w-4 h-4 text-amber-400" />, href: '/dashboard/dropy/reorder', accent: 'border-amber-500/20' },
              ].map((item) => (
                <button key={item.label} onClick={() => router.push(item.href)}
                  className={`bg-[#1a1a1a] border ${item.accent} rounded-2xl p-4 hover:bg-white/[0.03] transition-all text-left group`}>
                  <div className="flex items-center gap-2 mb-2">{item.icon}<span className="text-xs text-gray-500 font-medium">{item.label}</span></div>
                  <span className="text-2xl font-mono font-bold text-white">{item.count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-3 sm:gap-4">

            {/* Funnel Breakdown */}
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-orange-500/5 border-b border-orange-500/10 flex justify-between items-center">
                <h2 className="font-bold text-sm text-orange-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" /> Funnel Breakdown
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-gray-400 text-sm">RS (High Demand)</span>
                  </div>
                  <span className="text-white font-bold font-mono">{counts.rs}</span>
                </div>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-gray-400 text-sm">DP (Dropshipping)</span>
                  </div>
                  <span className="text-white font-bold font-mono">{counts.dp}</span>
                </div>
                {(counts.rs + counts.dp) > 0 && (
                  <div className="w-full h-2.5 bg-[#111111] rounded-full overflow-hidden flex mt-2">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.round((counts.rs / (counts.rs + counts.dp)) * 100)}%` }} />
                    <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.round((counts.dp / (counts.rs + counts.dp)) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>

            {/* Validation Status */}
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-blue-500/5 border-b border-blue-500/10 flex justify-between items-center">
                <h2 className="font-bold text-sm text-blue-200 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-500" /> Validation Status
                </h2>
              </div>
              <div className="divide-y divide-white/[0.06] p-1.5">
                {[
                  { label: 'Pending', count: counts.pending, color: 'bg-gray-500' },
                  { label: 'Passed', count: counts.passed, color: 'bg-emerald-500' },
                  { label: 'Failed', count: counts.failed, color: 'bg-rose-500' },
                  { label: 'Reworking', count: counts.reworking, color: 'bg-amber-500' },
                ].map((item) => (
                  <div key={item.label} className="px-3 py-2.5 flex items-center justify-between hover:bg-white/[0.05] rounded-lg transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-white">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Listing Errors */}
            <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-2xl overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-rose-500/5 border-b border-rose-500/10 flex justify-between items-center">
                <h2 className="font-bold text-sm text-rose-200 flex items-center gap-2">
                  <LayoutList className="w-4 h-4 text-rose-500" /> Listing Errors
                </h2>
                <span className="animate-pulse w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]" />
              </div>
              <div className="p-4">
                <button onClick={() => router.push('/dashboard/dropy/listing-error/dropy')}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span className="text-xs text-gray-500 font-medium">Dropy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">{counts.listingErrors}</span>
                    <span className="text-[10px] text-rose-400">pending</span>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
