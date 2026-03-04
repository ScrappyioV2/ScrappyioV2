"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useIndiaDashboardStats } from "@/lib/hooks/useIndiaDashboardStats";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import {
  ShieldCheck, FileCheck, LayoutList, TrendingUp,
  Loader2, ShoppingBag
} from 'lucide-react';

/* ================= CONFIGURATION ================= */
const SELLER_CONFIG: Record<number, { name: string; color: string; bg: string; border: string }> = {
  1: { name: "Golden Aura", color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  2: { name: "Rudra Retail", color: "#6366f1", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
  3: { name: "UBeauty", color: "#ec4899", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  4: { name: "Velvet Vista", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/20" }
};

// Custom Tooltip to handle the dual axis context
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl">
        <p className="text-slate-300 font-bold mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400 w-24">{entry.name}:</span>
              <span className="font-mono font-bold text-white">
                {entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function IndiaSellingPage() {
  const router = useRouter();
  const { userRole, loading: authLoading } = useAuth();

  // 1. Determine if user is restricted (needs redirect)
  const redirectTarget = useMemo(() => {
    if (authLoading || !userRole) return null;
    const pages = userRole.allowed_pages || [];

    if (pages.includes('validation')) return '/dashboard/india-selling/validation';
    if (pages.includes('brand-checking')) return '/dashboard/india-selling/brand-checking';
    if (pages.includes('purchase')) return '/dashboard/india-selling/purchases';

    return null; // Admin or Manager
  }, [authLoading, userRole]);

  // 2. Execute Redirect
  useEffect(() => {
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router]);

  // 3. Only fetch stats if NOT redirecting
  const { stats, loading: statsLoading } = useIndiaDashboardStats({ enabled: !redirectTarget });

  // Calculate Header Totals
  const pipelineData = useMemo(() => {
    return [1, 2, 3, 4].map(id => {
      const bc = stats?.brandChecking?.sellers?.find((s: any) => s.id === id)?.pending || 0;
      const val = stats?.validation?.sellers?.find((s: any) => s.id === id)?.pending || 0;
      const pur = stats?.purchasing?.sellers?.find((s: any) => s.id === id)?.pending || 0;
      return {
        name: SELLER_CONFIG[id].name,
        "Brand Check": bc,
        "Validation": val,
        "Purchasing": pur,
      };
    });
  }, [stats]);

  const totalActive = pipelineData.reduce((acc, curr) => acc + curr["Brand Check"] + curr["Validation"] + curr["Purchasing"], 0);

  return (
    <>
      <div className="h-full bg-slate-950 text-slate-200 p-4 lg:p-6 font-sans selection:bg-indigo-500/30 flex flex-col overflow-hidden">

        {/* === HEADER — COMPACT === */}
        <div className="flex items-end justify-between mb-4 border-b border-slate-800/60 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <TrendingUp className="w-5 h-5 text-indigo-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">INDIA Overview</h1>
            </div>
            <p className="text-slate-400 text-sm pl-1">
              Live pipeline metrics for <span className="text-indigo-400 font-bold">4 Brands</span>
            </p>
          </div>

          <div className="bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 shadow-xl flex flex-col items-center min-w-[140px]">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Total Active</span>
            <span className="text-2xl font-mono font-bold text-white">{totalActive.toLocaleString()}</span>
          </div>
        </div>

        {/* === CONTENT === */}
        {(!stats || statsLoading) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-sm font-medium tracking-wide animate-pulse">SYNCING LIVE DATA...</span>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0">

            {/* === LEFT: PIPELINE CHART + STATS === */}
            <div className="xl:col-span-2 flex flex-col gap-4 min-h-0">
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl shadow-xl backdrop-blur-sm flex-1 min-h-0 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    Pipeline Volume
                  </h2>
                  <div className="text-[10px] text-slate-500 flex gap-3">
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Right Scale</span>
                    <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Left Scale</span>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                      <YAxis yAxisId="left" orientation="left" stroke="#8b5cf6" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                      <Bar yAxisId="right" dataKey="Brand Check" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      <Bar yAxisId="left" dataKey="Validation" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                      <Bar yAxisId="left" dataKey="Purchasing" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* === STATS ROW === */}
              <div className="grid grid-cols-2 gap-4 shrink-0">
                <StatCard title="Brand Checking" icon={<ShieldCheck className="w-4 h-4 text-blue-400" />} data={stats.brandChecking.sellers} type="pending" />
                <StatCard title="Validation" icon={<FileCheck className="w-4 h-4 text-purple-400" />} data={stats.validation.sellers} type="mixed" />
              </div>
            </div>

            {/* === RIGHT COLUMN === */}
            <div className="flex flex-col gap-4 min-h-0">

              {/* LISTING ERRORS */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shrink-0">
                <div className="px-4 py-2.5 bg-rose-500/5 border-b border-rose-500/10 flex justify-between items-center">
                  <h2 className="font-bold text-sm text-rose-200 flex items-center gap-2">
                    <LayoutList className="w-4 h-4 text-rose-500" /> Listing Errors
                  </h2>
                  <span className="animate-pulse w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]"></span>
                </div>
                <div className="divide-y divide-slate-800/50 p-1.5">
                  {stats.listing.sellers.map((seller: any) => (
                    <div key={seller.id} className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-800/30 rounded-lg transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SELLER_CONFIG[seller.id].color }}></div>
                        <span className="text-xs text-slate-300 font-medium">{SELLER_CONFIG[seller.id].name}</span>
                      </div>
                      {seller.notApproved > 0 ? (
                        <span className="text-xs font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md">
                          {seller.notApproved} Errors
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-medium">Clean</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* PURCHASING QUEUE */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex-1 min-h-0">
                <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-bold text-sm text-white">Ready to Buy</h2>
                </div>
                <div className="p-1.5 space-y-1">
                  {stats.purchasing.sellers.map((seller: any) => (
                    <div key={seller.id} className="px-3 py-2.5 flex items-center justify-between rounded-lg bg-slate-950/50 border border-slate-800/50">
                      <span className="text-xs text-slate-300 font-medium">{SELLER_CONFIG[seller.id].name}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500">Pending</div>
                          <div className="text-xs font-bold text-emerald-400">{seller.pending}</div>
                        </div>
                        <div className="w-px h-6 bg-slate-800"></div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500">Done</div>
                          <div className="text-xs font-bold text-white">{seller.approved}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}

// === HELPER COMPONENT ===
function StatCard({ title, icon, data, type }: { title: string, icon: any, data: any[], type: 'pending' | 'mixed' }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-2xl shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="p-1.5 bg-slate-800 rounded-lg">{icon}</div>
        <h3 className="font-bold text-sm text-slate-200">{title}</h3>
      </div>
      <div className="space-y-1.5">
        {data.map((item: any) => {
          const cfg = SELLER_CONFIG[item.id];
          return (
            <div key={item.id} className="flex items-center justify-between px-2.5 py-2 bg-slate-950/50 border border-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-[11px] text-slate-400 font-medium">{cfg.name}</span>
              </div>
              <div className="flex gap-3 text-[11px]">
                {type === 'pending' ? (
                  <span className="font-bold text-blue-400">{item.pending} Pending</span>
                ) : (
                  <>
                    <span className="text-emerald-400 font-bold">{item.approved} Pass</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300">{item.pending} Wait</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}