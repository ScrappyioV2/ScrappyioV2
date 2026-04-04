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
  ShieldCheck,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  TrendingUp
} from 'lucide-react';

const SELLER_TABLE_GROUPS: Record<number, string[]> = {
  1: [
    'usa_seller_1_high_demand',
    'usa_seller_1_low_demand',
    'usa_seller_1_dropshipping',
    'usa_seller_1_not_approved',
  ],
  2: [
    'usa_seller_2_high_demand',
    'usa_seller_2_low_demand',
    'usa_seller_2_dropshipping',
    'usa_seller_2_not_approved',
  ],
  3: [
    'usa_seller_3_high_demand',
    'usa_seller_3_low_demand',
    'usa_seller_3_dropshipping',
    'usa_seller_3_not_approved',
  ],
  4: [
    'usa_seller_4_high_demand',
    'usa_seller_4_low_demand',
    'usa_seller_4_dropshipping',
    'usa_seller_4_not_approved',
  ],
};

/* ================= STATIC SELLERS ================= */
const ALL_SELLERS = [
  { id: 1, slug: "golden-aura", name: "Golden Aura" },
  { id: 2, slug: "rudra-retail", name: "Rudra Retail" },
  { id: 3, slug: "ubeauty", name: "Ubeauty" },
  { id: 4, slug: "velvet-vista", name: "Velvet Vista" },
];

/* ================= TYPES ================= */
type BrandProgressRow = {
  seller_id: number;
  total: number;
  approved: number;
  not_approved: number;
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

/* ================= PAGE ================= */
export default function BrandCheckingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [hasAnyMovementYet, setHasAnyMovementYet] = useState(false);
  const [approvalBreakdown, setApprovalBreakdown] = useState<
    Record<number, SellerApprovalBreakdown>
  >({});

  // Initialize ALL sellers with 0 progress
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
      router.push(`/dashboard/usa-selling/brand-checking/${seller.slug}`);
    }
  };

  /* ===== INITIAL LOAD FROM SUPABASE ===== */
  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      console.log("📊 Fetching initial brand check progress...");

      const { data, error } = await supabase
        .from("brand_check_progress")
        .select("*");

      if (error) {
        console.error("❌ Error fetching brand check progress:", error);
        return;
      }

      if (data) {
        setSellers((prev) =>
          prev.map((seller) => {
            const row = data.find(
              (d: BrandProgressRow) => d.seller_id === seller.id
            );
            if (!row) return seller;

            return {
              ...seller,
              totalProducts: row.total,
              approved: row.approved,
              notApproved: row.not_approved,
            };
          })
        );
      }
    };

    fetchProgress();
  }, [user]);

  /* ===== REALTIME SUBSCRIPTION ===== */
  useEffect(() => {
    if (!user) return;
    console.log("🔌 Setting up real-time subscription for brand_check_progress");

    const channel = supabase
      .channel("brand-check-progress-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "brand_check_progress",
        },
        (payload) => {
          const data = payload.new as BrandProgressRow;

          if (!data || !data.seller_id) return;

          setSellers((prev) => {
            const updated = prev.map((seller) =>
              seller.id === data.seller_id
                ? {
                  ...seller,
                  totalProducts: data.total,
                  approved: data.approved,
                  notApproved: data.not_approved,
                  hasMovement: true,
                }
                : seller
            );
            return updated;
          });

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
        supabase.from(`usa_seller_${seller.id}_high_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`usa_seller_${seller.id}_low_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`usa_seller_${seller.id}_dropshipping`).select('*', { count: 'exact', head: true }),
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
    if (user) { // 👈 Only fetch if user exists
      fetchApprovedBreakdown();
    }
  }, [user]); // 👈 Change [] to [user]

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#111111] text-gray-100 p-8 font-sans selection:bg-orange-400/30">

        {/* === HEADER === */}
        <div className="mb-8">
          <Link
            href="/dashboard/usa-selling"
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400 mb-6 transition-colors group font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to USA Selling Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.06] pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500/100/10 rounded-xl border border-orange-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
                  <ShieldCheck className="w-6 h-6 text-orange-500" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Brand Checking Dashboard</h1>
              </div>
              <p className="text-gray-400 pl-[3.75rem] max-w-2xl">
                Monitor real-time brand approval progress across all sellers.
                <span className="ml-3 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#111111] border border-white/[0.06] text-xs font-mono text-gray-500">
                  Total Sellers: {sellers.length}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* === SELLER GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sellers.map((seller) => {
            const checkedTotal = seller.approved + seller.notApproved;
            const approvedPercentage =
              checkedTotal === 0 ? 0 : (seller.approved / checkedTotal) * 100;
            const notApprovedPercentage =
              checkedTotal === 0 ? 0 : (seller.notApproved / checkedTotal) * 100;

            return (
              <div
                key={seller.id}
                onClick={() => handleSellerCardClick(seller.id)}
                className="group relative bg-[#1a1a1a] border border-white/[0.06] hover:border-orange-500/30 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/30 overflow-hidden"
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="grid grid-cols-5 gap-6 relative z-10">

                  {/* Left: Seller Card */}
                  <div className="col-span-2 flex flex-col">
                    <div className="flex-1 bg-[#1a1a1a] border border-white/[0.06] rounded-xl p-5 flex flex-col items-center justify-center text-center group-hover:border-orange-500/20 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-[#111111] border border-white/[0.06] flex items-center justify-center mb-3 text-gray-400 group-hover:text-orange-500 group-hover:scale-110 transition-all shadow-inner">
                        <LayoutDashboard className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-500 mb-1 pb-1 w-full text-center">
                        {seller.name}
                      </h3>
                      <div className="text-3xl font-bold text-white tracking-tight">
                        {seller.totalProducts.toLocaleString()}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-semibold">Total Products</span>
                    </div>
                  </div>

                  {/* Right: Progress Bars */}
                  <div className="col-span-3 flex flex-col justify-center space-y-6">

                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        Brand Check Status
                        <div className="h-px flex-1 bg-[#111111]"></div>
                      </h4>

                      {/* Approved Progress Bar */}
                      <div className="mb-5">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Approved
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            {seller.approved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2.5 overflow-hidden border border-white/[0.06]">
                          <div
                            className="bg-emerald-500/100 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${approvedPercentage}%` }}
                          >
                          </div>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-[10px] text-gray-500">{Math.round(approvedPercentage)}%</span>
                        </div>
                      </div>

                      {/* Not Approved Progress Bar */}
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-sm text-rose-400 font-medium flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" /> Not Approved
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            {seller.notApproved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2.5 overflow-hidden border border-white/[0.06]">
                          <div
                            className="bg-rose-500/100 h-full rounded-full shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${notApprovedPercentage}%` }}
                          >
                          </div>
                        </div>
                        <div className="text-right mt-1">
                          <span className="text-[10px] text-gray-500">{Math.round(notApprovedPercentage)}%</span>
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
    </PageTransition>
  );
}