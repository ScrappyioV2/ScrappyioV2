"use client";

export const dynamic = "force-dynamic";

import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Package,
  Truck
} from 'lucide-react';

type Stats = {
  total: number;
  restock: number;
  dropshipping: number;
};

/* ================= PAGE ================= */
export default function DemandSortingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, restock: 0, dropshipping: 0 });
  const [loading, setLoading] = useState(true);

  /* ===== INITIAL LOAD FROM SUPABASE ===== */
  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const { data, error } = await supabase
        .from("india_demand_sorting")
        .select("funnel");

      if (error) {
        console.error("Error fetching demand sorting stats:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setStats({
          total: data.length,
          restock: data.filter((d) => d.funnel === "RS").length,
          dropshipping: data.filter((d) => d.funnel === "DP").length,
        });
      }
      setLoading(false);
    };

    fetchStats();

    const channel = supabase
      .channel("india-demand-sorting-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "india_demand_sorting" },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const restockPct = stats.total === 0 ? 0 : (stats.restock / stats.total) * 100;
  const dropshippingPct = stats.total === 0 ? 0 : (stats.dropshipping / stats.total) * 100;

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200 font-sans">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/india-selling"
            className="text-indigo-400 hover:text-indigo-300 text-sm flex items-center gap-1 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to INDIA Selling Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Package className="w-7 h-7 text-indigo-500" />
            Demand Sorting
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Sort products into Restock and Dropshipping before brand checking.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
              Total Products
            </p>
            <p className="text-3xl font-bold text-white">
              {stats.total.toLocaleString()}
            </p>
          </div>

          {/* Restock */}
          <div
            onClick={() => router.push("/dashboard/india-selling/demand-sorting/view?tab=restock")}
            className="group bg-slate-900/40 border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-6 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Restock
              </p>
              <span className="text-sm text-slate-500">
                {Math.round(restockPct)}%
              </span>
            </div>
            <p className="text-3xl font-bold text-emerald-300">
              {stats.restock.toLocaleString()}
            </p>
            <div className="mt-3 w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${restockPct}%` }}
              />
            </div>
          </div>

          {/* Dropshipping */}
          <div
            onClick={() => router.push("/dashboard/india-selling/demand-sorting/view?tab=dropshipping")}
            className="group bg-slate-900/40 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-6 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4" /> Dropshipping
              </p>
              <span className="text-sm text-slate-500">
                {Math.round(dropshippingPct)}%
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-300">
              {stats.dropshipping.toLocaleString()}
            </p>
            <div className="mt-3 w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${dropshippingPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}