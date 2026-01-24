"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useDashboardStats } from "@/lib/hooks/useDashboardStats";
import PageTransition from "@/components/layout/PageTransition";
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

export default function USASellingPage() {
  const router = useRouter();
  const { userRole, loading: authLoading } = useAuth();
  
  // 1. Determine if user is restricted (needs redirect)
  const redirectTarget = useMemo(() => {
    if (authLoading || !userRole) return null;
    const pages = userRole.allowed_pages || [];
    
    if (pages.includes('validation')) return '/dashboard/usa-selling/validation';
    if (pages.includes('brand-checking')) return '/dashboard/usa-selling/brand-checking';
    if (pages.includes('purchase')) return '/dashboard/usa-selling/purchases';
    
    return null; // Admin or Manager
  }, [authLoading, userRole]);

  // 2. Execute Redirect
  useEffect(() => {
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [redirectTarget, router]);

  // 3. Only fetch stats if NOT redirecting
  const { stats, loading: statsLoading } = useDashboardStats({ enabled: !redirectTarget });

  // 4. Show Loader if redirecting OR loading auth
  if (authLoading || redirectTarget) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-slate-400 animate-pulse font-medium">
            {redirectTarget ? "Redirecting..." : "Authenticating..."}
          </p>
        </div>
      </div>
    );
  }

  // 5. Safe to render Dashboard (Only Admins see this now)
  if (statsLoading || !stats) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-slate-400 animate-pulse font-medium">Syncing Live Data...</p>
        </div>
      </div>
    );
  }

  // Calculate Header Totals
  const pipelineData = [1, 2, 3, 4].map(id => {
    const bc = stats.brandChecking.sellers.find((s: any) => s.id === id)?.pending || 0;
    const val = stats.validation.sellers.find((s: any) => s.id === id)?.pending || 0;
    const pur = stats.purchasing.sellers.find((s: any) => s.id === id)?.pending || 0;

    return {
      name: SELLER_CONFIG[id].name,
      "Brand Check": bc,
      "Validation": val,
      "Purchasing": pur,
    };
  });

  const totalActive = pipelineData.reduce((acc, curr) => acc + curr["Brand Check"] + curr["Validation"] + curr["Purchasing"], 0);

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10 font-sans selection:bg-indigo-500/30">

        {/* === HEADER === */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 border-b border-slate-800/60 pb-6 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]">
                <TrendingUp className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-4xl font-bold text-white tracking-tight">USA Overview</h1>
            </div>
            <p className="text-slate-400 text-lg pl-1">
              Live pipeline metrics for <span className="text-indigo-400 font-bold">4 Brands</span>
            </p>
          </div>

          <div className="bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col items-center min-w-[160px]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Active</span>
            <span className="text-3xl font-mono font-bold text-white">{totalActive.toLocaleString()}</span>
          </div>
        </div>

        {/* === MAIN LAYOUT === */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* === LEFT: PIPELINE CHART === */}
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl shadow-xl backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  Pipeline Volume
                </h2>
                <div className="text-xs text-slate-500 flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Right Scale (High Vol)</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Left Scale (Low Vol)</span>
                </div>
              </div>
              
              <div className="w-full h-[350px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#64748b" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10} 
                    />
                    
                    {/* Left Axis: For Validation & Purchasing (Small Numbers) */}
                    <YAxis 
                        yAxisId="left"
                        orientation="left"
                        stroke="#8b5cf6" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        label={{ value: 'Active Items', angle: -90, position: 'insideLeft', fill: '#8b5cf6', fontSize: 10 }}
                    />

                    {/* Right Axis: For Brand Check (Huge Numbers) */}
                    <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#3b82f6" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        label={{ value: 'Brand Check Volume', angle: 90, position: 'insideRight', fill: '#3b82f6', fontSize: 10 }}
                    />

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />

                    {/* Bars side-by-side, tied to specific axes */}
                    <Bar yAxisId="right" dataKey="Brand Check" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="Validation" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar yAxisId="left" dataKey="Purchasing" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* === DETAILED STATS GRID === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BRAND CHECKING */}
              <StatCard
                title="Brand Checking"
                icon={<ShieldCheck className="w-5 h-5 text-blue-400" />}
                data={stats.brandChecking.sellers}
                type="pending"
              />

              {/* VALIDATION */}
              <StatCard
                title="Validation"
                icon={<FileCheck className="w-5 h-5 text-purple-400" />}
                data={stats.validation.sellers}
                type="mixed"
              />
            </div>
          </div>

          {/* === RIGHT: ALERTS & PURCHASING === */}
          <div className="space-y-6">

            {/* LISTING ERRORS (Alert) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-5 bg-rose-500/5 border-b border-rose-500/10 flex justify-between items-center">
                <h2 className="font-bold text-rose-200 flex items-center gap-2">
                  <LayoutList className="w-5 h-5 text-rose-500" /> Listing Errors
                </h2>
                <span className="animate-pulse w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_10px_#f43f5e]"></span>
              </div>
              <div className="divide-y divide-slate-800/50 p-2">
                {stats.listing.sellers.map((seller: any) => (
                  <div key={seller.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: SELLER_CONFIG[seller.id].color }}></div>
                      <span className="text-sm text-slate-300 font-medium">{SELLER_CONFIG[seller.id].name}</span>
                    </div>
                    {seller.notApproved > 0 ? (
                      <span className="text-sm font-bold text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md">
                        {seller.notApproved} Errors
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 font-medium">Clean</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* PURCHASING QUEUE */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-white">Ready to Buy</h2>
              </div>
              <div className="p-2 space-y-1">
                {stats.purchasing.sellers.map((seller: any) => (
                  <div key={seller.id} className="p-4 flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800/50 mb-2 last:mb-0">
                    <span className="text-sm text-slate-300 font-medium">{SELLER_CONFIG[seller.id].name}</span>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Pending</div>
                        <div className="text-sm font-bold text-emerald-400">{seller.pending}</div>
                      </div>
                      <div className="w-px h-8 bg-slate-800"></div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">Done</div>
                        <div className="text-sm font-bold text-white">{seller.approved}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </PageTransition>
  );
}

// === HELPER COMPONENT ===
function StatCard({ title, icon, data, type }: { title: string, icon: any, data: any[], type: 'pending' | 'mixed' }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
        <h3 className="font-bold text-slate-200">{title}</h3>
      </div>
      <div className="space-y-3">
        {data.map((item: any) => {
          const cfg = SELLER_CONFIG[item.id];
          return (
            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/50 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs text-slate-400 font-medium">{cfg.name}</span>
              </div>
              <div className="flex gap-3 text-xs">
                {type === 'pending' ? (
                  <span className={`font-bold ${cfg.bg.replace('bg-', 'text-')}`}>{item.pending} Pending</span>
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