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

const MARKETPLACE = 'flipkart';

const ALL_SELLERS = [
  { id: 1, slug: "golden-aura", name: "Golden Aura" },
  { id: 2, slug: "rudra-retail", name: "Rudra Retail" },
  { id: 3, slug: "ubeauty", name: "Ubeauty" },
  { id: 4, slug: "velvet-vista", name: "Velvet Vista" },
  { id: 5, slug: "dropy-ecom", name: "Dropy Ecom" },
  { id: 6, slug: "costech-ventures", name: "Costech Ventures" },
];

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
      router.push(`/dashboard/flipkart/brand-checking/${seller.slug}`);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from("flipkart_brand_check_progress")
        .select("*");

      if (error) {
        console.error("❌ Error fetching brand check progress:", error);
        return;
      }

      if (data) {
        setSellers((prev) =>
          prev.map((seller) => {
            const row = data.find((d: BrandProgressRow) => d.seller_id === seller.id);
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

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("flipkart-brand-check-progress-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flipkart_brand_check_progress" },
        (payload) => {
          const data = payload.new as BrandProgressRow;
          if (!data || !data.seller_id) return;

          setSellers((prev) =>
            prev.map((seller) =>
              seller.id === data.seller_id
                ? {
                    ...seller,
                    totalProducts: data.total,
                    approved: data.approved,
                    notApproved: data.not_approved,
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
    const { data, error } = await supabase.rpc('get_approved_breakdown', { p_marketplace: MARKETPLACE });
    if (error) { console.error('Breakdown fetch error:', error); return; }
    const result: Record<number, SellerApprovalBreakdown> = {};
    for (const row of (data || [])) {
      result[row.seller_id] = {
        high: row.high || 0,
        low: row.low || 0,
        drop: row.drop || 0,
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
      <div className="h-full bg-[#111111] text-gray-100 p-3 sm:p-4 lg:p-6 font-sans selection:bg-orange-400/30 flex flex-col overflow-hidden">

        {/* === HEADER === */}
        <div className="mb-3 shrink-0">
          <Link
            href="/dashboard/flipkart"
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-400 mb-2 transition-colors group font-medium text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            Back to Flipkart Selling Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-500/100/10 rounded-lg border border-orange-500/20">
                  <ShieldCheck className="w-5 h-5 text-orange-500" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Brand Checking Dashboard</h1>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm pl-[2.5rem] max-w-2xl hidden sm:block">
                Monitor real-time brand approval progress across all sellers.
                <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#111111] border border-white/[0.06] text-[10px] font-mono text-gray-500">
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
                className="group relative bg-[#1a1a1a] border border-white/[0.06] hover:border-orange-500/30 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/30 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4 relative z-10">

                  {/* Left: Seller Card */}
                  <div className="sm:col-span-2 flex flex-col">
                    <div className="flex-1 bg-[#1a1a1a] border border-white/[0.06] rounded-lg p-3 flex flex-row sm:flex-col items-center sm:justify-center text-center gap-3 sm:gap-0 group-hover:border-orange-500/20 transition-colors">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-[#111111] border border-white/[0.06] flex items-center justify-center mb-0 sm:mb-2 text-gray-400 group-hover:text-orange-500 group-hover:scale-110 transition-all shadow-inner">
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <h3 className="text-xs font-semibold text-gray-500 mb-0.5 text-left sm:text-center">
                        {seller.name}
                        <span className="sm:hidden text-gray-500 font-normal ml-1">· {seller.totalProducts.toLocaleString()}</span>
                      </h3>
                      <div className="text-xl font-bold text-white tracking-tight hidden sm:block">
                        {seller.totalProducts.toLocaleString()}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-gray-500 mt-0.5 font-semibold hidden sm:block">Total Products</span>
                    </div>
                  </div>

                  {/* Right: Progress Bars */}
                  <div className="sm:col-span-3 flex flex-col justify-center space-y-3">
                    <div>
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        Brand Check Status
                        <div className="h-px flex-1 bg-[#111111]"></div>
                      </h4>

                      {/* Approved */}
                      <div className="mb-3">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            {seller.approved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-white/[0.06]">
                          <div
                            className="bg-emerald-500/100 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${approvedPercentage}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[9px] text-gray-500">{seller.approved} / {seller.totalProducts}</span>
                        </div>
                      </div>

                      {/* Not Approved */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Not Approved
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            {seller.notApproved.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-white/[0.06]">
                          <div
                            className="bg-rose-500/100 h-full rounded-full shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${notApprovedPercentage}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[9px] text-gray-500">{seller.notApproved} / {seller.totalProducts}</span>
                        </div>
                      </div>

                      {/* Pending */}
                      <div>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                            <span className="w-3 h-3 inline-flex items-center justify-center text-[8px]">⏳</span> Pending
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.06]">
                            {(seller.totalProducts - seller.approved - seller.notApproved).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-white/[0.06]">
                          <div
                            className="bg-amber-500/100 h-full rounded-full shadow-[0_0_10px_rgba(245,158,11,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${seller.totalProducts > 0 ? ((seller.totalProducts - seller.approved - seller.notApproved) / seller.totalProducts) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="text-right mt-0.5">
                          <span className="text-[9px] text-gray-500">{seller.totalProducts - seller.approved - seller.notApproved} / {seller.totalProducts}</span>
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