"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import {
  FileCheck, ShoppingBag, Truck, AlertTriangle, Loader2,
  ArrowRight, TrendingUp, Package, RotateCcw, ShieldCheck
} from 'lucide-react';

type StatCard = {
  label: string;
  count: number;
  icon: React.ReactNode;
  href: string;
  gradient: string;
  iconBg: string;
};

type FunnelBreakdown = {
  rs: number;
  dp: number;
};

export default function DropyDashboard() {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [funnel, setFunnel] = useState<FunnelBreakdown>({ rs: 0, dp: 0 });
  const [masterCount, setMasterCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    async function fetchCounts() {
      setLoading(true);
      const [validation, purchases, tracking, listingErrors, master, funnelRS, funnelDP] = await Promise.all([
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }),
        supabase.from('dropy_purchases').select('*', { count: 'exact', head: true }).is('move_to', null),
        supabase.from('dropy_inbound_tracking').select('*', { count: 'exact', head: true }),
        supabase.from('listing_errors').select('*', { count: 'exact', head: true }).eq('marketplace', 'dropy').eq('error_status', 'pending'),
        supabase.from('dropy_master_sellers').select('*', { count: 'exact', head: true }),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('funnel', 'RS'),
        supabase.from('dropy_validation_main_file').select('*', { count: 'exact', head: true }).eq('funnel', 'DP'),
      ]);

      setMasterCount(master.count ?? 0);
      setFunnel({ rs: funnelRS.count ?? 0, dp: funnelDP.count ?? 0 });

      setStats([
        { label: 'Validation', count: validation.count ?? 0, icon: <FileCheck className="w-5 h-5" />, href: '/dashboard/dropy/validation', gradient: 'from-blue-500/20 to-blue-600/5', iconBg: 'bg-blue-500' },
        { label: 'Purchases', count: purchases.count ?? 0, icon: <ShoppingBag className="w-5 h-5" />, href: '/dashboard/dropy/purchases', gradient: 'from-emerald-500/20 to-emerald-600/5', iconBg: 'bg-emerald-500' },
        { label: 'Tracking', count: tracking.count ?? 0, icon: <Truck className="w-5 h-5" />, href: '/dashboard/dropy/tracking', gradient: 'from-purple-500/20 to-purple-600/5', iconBg: 'bg-purple-500' },
        { label: 'Listing Errors', count: listingErrors.count ?? 0, icon: <AlertTriangle className="w-5 h-5" />, href: '/dashboard/dropy/listing-error', gradient: 'from-red-500/20 to-red-600/5', iconBg: 'bg-red-500' },
      ]);
      setLoading(false);
    }
    fetchCounts();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  const totalValidation = funnel.rs + funnel.dp;
  const rsPercent = totalValidation > 0 ? Math.round((funnel.rs / totalValidation) * 100) : 0;
  const dpPercent = totalValidation > 0 ? Math.round((funnel.dp / totalValidation) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dropy</h1>
          <p className="text-gray-500 text-sm mt-1">Pipeline overview — no brand checking, direct to validation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[#111111] border border-white/[0.06] rounded-xl px-4 py-2">
            <span className="text-gray-500 text-xs">Master Products</span>
            <span className="text-white font-bold text-lg ml-2">{masterCount.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Pipeline Flow</h2>
        </div>
        <div className="flex items-center justify-between gap-2">
          {[
            { label: 'Master', icon: <Package className="w-4 h-4" />, count: masterCount, color: 'text-gray-400' },
            { label: 'Validation', icon: <FileCheck className="w-4 h-4" />, count: stats[0]?.count ?? 0, color: 'text-blue-400' },
            { label: 'Purchases', icon: <ShoppingBag className="w-4 h-4" />, count: stats[1]?.count ?? 0, color: 'text-emerald-400' },
            { label: 'Tracking', icon: <Truck className="w-4 h-4" />, count: stats[2]?.count ?? 0, color: 'text-purple-400' },
            { label: 'Listing Errors', icon: <AlertTriangle className="w-4 h-4" />, count: stats[3]?.count ?? 0, color: 'text-red-400' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`flex items-center gap-1.5 ${step.color}`}>
                  {step.icon}
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                <span className="text-white font-bold text-xl mt-1">{step.count.toLocaleString()}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className={`bg-gradient-to-br ${item.gradient} bg-[#111111] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.15] transition-all text-left group relative overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center text-white shadow-lg`}>
                {item.icon}
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-1 transition-all" />
            </div>
            <span className="text-3xl font-bold text-white font-mono block">
              {item.count.toLocaleString()}
            </span>
            <p className="text-sm text-gray-500 mt-1">{item.label}</p>
          </button>
        ))}
      </div>

      {/* Funnel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Funnel Breakdown</h2>
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-gray-400 text-sm">RS (High Demand)</span>
              <span className="text-white font-bold">{funnel.rs}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-gray-400 text-sm">DP (Dropshipping)</span>
              <span className="text-white font-bold">{funnel.dp}</span>
            </div>
          </div>
          {totalValidation > 0 && (
            <div className="w-full h-3 bg-[#1a1a1a] rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${rsPercent}%` }} />
              <div className="bg-amber-500 h-full rounded-r-full transition-all" style={{ width: `${dpPercent}%` }} />
            </div>
          )}
          {totalValidation > 0 && (
            <div className="flex justify-between mt-2">
              <span className="text-xs text-emerald-400">{rsPercent}% RS</span>
              <span className="text-xs text-amber-400">{dpPercent}% DP</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#111111] border border-white/[0.06] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Upload Master Data', href: '/dashboard/manage-sellers/dropy', icon: <Package className="w-4 h-4" />, desc: 'Add products to master table' },
              { label: 'Admin Approvals', href: '/dashboard/dropy/admin-validation', icon: <ShieldCheck className="w-4 h-4" />, desc: 'Review pricing & approve' },
              { label: 'Reorder Check', href: '/dashboard/dropy/reorder', icon: <RotateCcw className="w-4 h-4" />, desc: 'Check reorder levels' },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => router.push(action.href)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.05] transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                  {action.icon}
                </div>
                <div className="flex-1">
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{action.label}</span>
                  <p className="text-xs text-gray-600">{action.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
