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
    'uae_seller_1_high_demand',
    'uae_seller_1_low_demand',
    'uae_seller_1_dropshipping',
    'uae_seller_1_not_approved',
  ],
  2: [
    'uae_seller_2_high_demand',
    'uae_seller_2_low_demand',
    'uae_seller_2_dropshipping',
    'uae_seller_2_not_approved',
  ],
  3: [
    'uae_seller_3_high_demand',
    'uae_seller_3_low_demand',
    'uae_seller_3_dropshipping',
    'uae_seller_3_not_approved',
  ],
  4: [
    'uae_seller_4_high_demand',
    'uae_seller_4_low_demand',
    'uae_seller_4_dropshipping',
    'uae_seller_4_not_approved',
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
      router.push(`/dashboard/uae-selling/brand-checking/${seller.slug}`);
    }
  };

  /* ===== INITIAL LOAD FROM SUPABASE ===== */
  useEffect(() => {
    if (!user) return;

    const fetchProgress = async () => {
      console.log("📊 Fetching initial brand check progress...");
      const { data, error } = await supabase
        .from("uae_brand_check_progress")
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

    console.log("🔌 Setting up real-time subscription for uae_brand_check_progress");

    const channel = supabase
      .channel("brand-check-progress-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "uae_brand_check_progress",
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
        supabase.from(`uae_seller_${seller.id}_high_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`uae_seller_${seller.id}_low_demand`).select('*', { count: 'exact', head: true }),
        supabase.from(`uae_seller_${seller.id}_dropshipping`).select('*', { count: 'exact', head: true }),
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
    <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-8">
        {/* === HEADER === */}
        <div className="max-w-7xl mx-auto mb-12">
          <Link
            href="/dashboard/uae-selling"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-indigo-400 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to UAE Selling Dashboard
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">
                Brand Checking Dashboard
              </h1>
              <p className="text-slate-400 mt-1">
                Monitor real-time brand approval progress across all sellers.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-300">
              Total Sellers: <span className="font-semibold text-white">{sellers.length}</span>
            </span>
          </div>
        </div>

        {/* === SELLER GRID === */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                className="group relative bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 backdrop-blur-sm overflow-hidden"
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-indigo-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 rounded-2xl" />

                <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Seller Card */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      {seller.name.charAt(0)}
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold text-white">{seller.name}</h2>
                      <p className="text-sm text-slate-400">Seller {seller.id}</p>

                      <p className="text-4xl font-extrabold text-indigo-400 mt-2">
                        {seller.totalProducts.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-400 uppercase tracking-wide">
                        Total Products
                      </p>
                    </div>
                  </div>

                  {/* Right: Progress Bars */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                      Brand Check Status
                    </h3>

                    {/* Approved Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-medium text-slate-300">Approved</span>
                        </div>
                        <span className="text-sm font-semibold text-emerald-400">
                          {seller.approved.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                          style={{ width: `${approvedPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-right">
                        {Math.round(approvedPercentage)}%
                      </p>
                    </div>

                    {/* Not Approved Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          <span className="text-sm font-medium text-slate-300">Not Approved</span>
                        </div>
                        <span className="text-sm font-semibold text-rose-400">
                          {seller.notApproved.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-red-400 rounded-full transition-all duration-500"
                          style={{ width: `${notApprovedPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-right">
                        {Math.round(notApprovedPercentage)}%
                      </p>
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
