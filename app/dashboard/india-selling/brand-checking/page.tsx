"use client";
export const dynamic = "force-dynamic";

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

const SELLER_TABLE_GROUPS: Record<number, string[]> = {
  1: ['india_seller_1_high_demand', 'india_seller_1_low_demand', 'india_seller_1_dropshipping', 'india_seller_1_not_approved'],
  2: ['india_seller_2_high_demand', 'india_seller_2_low_demand', 'india_seller_2_dropshipping', 'india_seller_2_not_approved'],
  3: ['india_seller_3_high_demand', 'india_seller_3_low_demand', 'india_seller_3_dropshipping', 'india_seller_3_not_approved'],
  4: ['india_seller_4_high_demand', 'india_seller_4_low_demand', 'india_seller_4_dropshipping', 'india_seller_4_not_approved'],
  5: ['india_seller_5_high_demand', 'india_seller_5_low_demand', 'india_seller_5_dropshipping', 'india_seller_5_not_approved'],
  6: ['india_seller_6_high_demand', 'india_seller_6_low_demand', 'india_seller_6_dropshipping', 'india_seller_6_not_approved'],
};

const ALL_SELLERS = [
  { id: 1, slug: "golden-aura", name: "Golden Aura" },
  { id: 2, slug: "rudra-retail", name: "Rudra Retail" },
  { id: 3, slug: "ubeauty", name: "Ubeauty" },
  { id: 4, slug: "velvet-vista", name: "Velvet Vista" },
  { id: 5, slug: "dropy-ecom", name: "Dropy Ecom" },
  { id: 6, slug: "costech-ventures", name: "Costech Ventures" },
];

type BrandProgressRow = {
  sellerid: number;
  total: number;
  approved: number;
  notapproved: number;
};

type SellerApprovalBreakdown = {
  high: number;
  low: number;
  drop: number;
};

type SellerUI = {
  id: number;
  slug: string;
  name: string;
  totalProducts: number;
  approved: number;
  notApproved: number;
};

export default function BrandCheckingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [hasAnyMovementYet, setHasAnyMovementYet] = useState(false);
  const [approvalBreakdown, setApprovalBreakdown] = useState<Record<number, SellerApprovalBreakdown>>({});

  const [sellers, setSellers] = useState<SellerUI[]>(
    ALL_SELLERS.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      totalProducts: 0,
      approved: 0,
      notApproved: 0,
    }))
  );

  const handleSellerCardClick = (sellerId: number) => {
    const seller = ALL_SELLERS.find((s) => s.id === sellerId);
    if (seller) {
      router.push(`/dashboard/india-selling/brand-checking/${seller.slug}`);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from("india_brand_check_progress")
        .select("*");

      if (error) {
        console.error("❌ Error fetching brand check progress:", error);
        return;
      }

      if (data) {
        setSellers((prev) =>
          prev.map((seller) => {
            const row = data.find((d: BrandProgressRow) => d.sellerid === seller.id);
            if (!row) return seller;
            return {
              ...seller,
              totalProducts: row.total,
              approved: row.approved,
              notApproved: row.notapproved,
            };
          })
        );
      }
    };

    fetchProgress();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("india-brand-check-progress-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "india_brand_check_progress" },
        (payload) => {
          const data = payload.new as BrandProgressRow;
          if (!data || !data.sellerid) return;

          setSellers((prev) =>
            prev.map((seller) =>
              seller.id === data.sellerid
                ? {
                    ...seller,
                    totalProducts: data.total,
                    approved: data.approved,
                    notApproved: data.notapproved,
                  }
                : seller
            )
          );
          setHasAnyMovementYet(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchApprovedBreakdown = async () => {
    const result: Record<number, SellerApprovalBreakdown> = {};

    for (const seller of ALL_SELLERS) {
      const [high, low, drop] = await Promise.all([
        supabase.from(`india_seller_${seller.id}_high_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`india_seller_${seller.id}_low_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`india_seller_${seller.id}_dropshipping`).select('*', { count: 'exact', head: true }),
      ]);

      result[seller.id] = {
        high: high.count || 0,
        low: low.count || 0,
        drop: drop.count || 0,
      };
    }

    setApprovalBreakdown(result);
  };

  useEffect(() => {
    if (user) {
      fetchApprovedBreakdown();
    }
  }, [user]);

  return (
    <>
      <div className="h-full bg-slate-950 text-slate-200 p-3 sm:p-4 lg:p-6 font-sans selection:bg-indigo-500/30 flex flex-col overflow-hidden">

        {/* === HEADER === */}
        <div className="mb-3 shrink-0">
          <Link
            href="/dashboard/india-selling"
            className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 mb-2 transition-colors group font-medium text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to INDIA Selling Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Brand Checking Dashboard</h1>
              </div>
              <p className="text-slate-400 text-xs sm:text-sm pl-[2.5rem] max-w-2xl hidden sm:block">
                Monitor real-time brand approval progress across all sellers.
                <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                  Total Sellers: {sellers.length}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* === SELLER GRID === */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 min-h-0 auto-rows-min overflow-y-auto">
          {sellers.map((seller) => {
            const checkedTotal = seller.approved + seller.notApproved;
            const approvedPercentage = checkedTotal === 0 ? 0 : (seller.approved / checkedTotal) * 100;
            const notApprovedPercentage = checkedTotal === 0 ? 0 : (seller.notApproved / checkedTotal) * 100;

            return (
              <div
                key={seller.id}
                onClick={() => handleSellerCardClick(seller.id)}
                className="group relative bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 backdrop-blur-sm overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4 relative z-10">

                  {/* Left: Seller Card */}
                  <div className="sm:col-span-2 flex flex-col">
                    <div className="flex-1 bg-slate-950/50 border border-slate-800 rounded-lg p-3 flex flex-row sm:flex-col items-center sm:justify-center text-center gap-3 sm:gap-0 group-hover:border-indigo-500/20 transition-colors">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-0 sm:mb-2 text-slate-400 group-hover:text-indigo-400 group-hover:scale-110 transition-all shadow-inner">
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-semibold text-slate-300 mb-0.5 text-left sm:text-center">
                        {seller.name}
                        <span className="sm:hidden text-slate-500 font-normal ml-1">· {seller.totalProducts.toLocaleString()}</span>
                      </h3>
                      <div className="text-xl font-bold text-white tracking-tight hidden sm:block">
                        {seller.totalProducts.toLocaleString()}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5 font-semibold hidden sm:block">Total Products</span>
                    </div>
                  </div>

                  {/* Right: Progress Bars */}
                  <div className="sm:col-span-3 flex flex-col justify-center space-y-3">
                    <div>
                      <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        Brand Check Status
                        <div className="h-px flex-1 bg-slate-800"></div>
                      </h4>

                      {/* Approved */}
                      <div className="mb-3">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {seller.approved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                          <div
                            className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${approvedPercentage}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[9px] text-slate-500">{Math.round(approvedPercentage)}%</span>
                        </div>
                      </div>

                      {/* Not Approved */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Not Approved
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                            {seller.notApproved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                          <div
                            className="bg-rose-500 h-full rounded-full shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${notApprovedPercentage}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[9px] text-slate-500">{Math.round(notApprovedPercentage)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}