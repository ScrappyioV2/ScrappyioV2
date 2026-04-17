"use client";
export const dynamic = "force-dynamic";

import { useAuth } from '@/lib/hooks/useAuth';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";
import {
  ClipboardCheck,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
} from 'lucide-react';

const ALL_SELLERS = [
  { id: 1, slug: "golden-aura", name: "Golden Aura" },
  { id: 2, slug: "rudra-retail", name: "Rudra Retail" },
  { id: 3, slug: "ubeauty", name: "Ubeauty" },
  { id: 4, slug: "velvet-vista", name: "Velvet Vista" },
  { id: 5, slug: "dropy-ecom", name: "Dropy Ecom" },
  { id: 6, slug: "costech-ventures", name: "Costech Ventures" },
];

type SellerCounts = {
  main: number;
  listed: number;
  notListed: number;
};

type SellerUI = {
  id: number;
  slug: string;
  name: string;
  main: number;
  listed: number;
  notListed: number;
};

export default function BrandCheckingReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sellers, setSellers] = useState<SellerUI[]>(
    ALL_SELLERS.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      main: 0,
      listed: 0,
      notListed: 0,
    })),
  );

  const handleSellerCardClick = (slug: string) => {
    router.push(`/dashboard/flipkart/brand-checking-review/${slug}`);
  };

  useEffect(() => {
    if (!user) return;

    const fetchCounts = async () => {
      const results: Record<number, SellerCounts> = {};

      await Promise.all(
        ALL_SELLERS.map(async (seller) => {
          const [mainRes, listedRes, notListedRes] = await Promise.all([
            supabase
              .from('brand_checking')
              .select('*', { count: 'exact', head: true })
              .eq('marketplace', 'flipkart')
              .eq('seller_id', seller.id)
              .eq('approval_status', 'approved')
              .eq('listing_status', 'pending'),
            supabase
              .from('brand_checking')
              .select('*', { count: 'exact', head: true })
              .eq('marketplace', 'flipkart')
              .eq('seller_id', seller.id)
              .eq('approval_status', 'approved')
              .eq('listing_status', 'listed'),
            supabase
              .from('brand_checking')
              .select('*', { count: 'exact', head: true })
              .eq('marketplace', 'flipkart')
              .eq('seller_id', seller.id)
              .eq('approval_status', 'approved')
              .eq('listing_status', 'not_listed'),
          ]);

          results[seller.id] = {
            main: mainRes.count || 0,
            listed: listedRes.count || 0,
            notListed: notListedRes.count || 0,
          };
        }),
      );

      setSellers((prev) =>
        prev.map((s) => ({
          ...s,
          main: results[s.id]?.main ?? 0,
          listed: results[s.id]?.listed ?? 0,
          notListed: results[s.id]?.notListed ?? 0,
        })),
      );
    };

    fetchCounts();
  }, [user]);

  if (authLoading) return <div className="min-h-screen bg-[#111111]" />;
  if (!user) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#111111] text-gray-100 p-8 font-sans selection:bg-blue-400/30">
        {/* HEADER */}
        <div className="mb-8">
          <Link
            href="/dashboard/flipkart-selling"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors group font-medium text-sm"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to flipkart Selling Dashboard
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/[0.1] pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]">
                  <ClipboardCheck className="w-6 h-6 text-blue-500" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  Flipkart Brand Checking Review
                </h1>
              </div>
              <p className="text-gray-400 pl-[3.75rem] max-w-2xl">
                Step 2 — review approved products and mark them as Listed or Not Listed.
                <span className="ml-3 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#111111] border border-white/[0.1] text-xs font-mono text-gray-500">
                  Total Sellers: {sellers.length}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* SELLER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sellers.map((seller) => {
            const total = seller.main + seller.listed + seller.notListed;
            const decided = seller.listed + seller.notListed;
            const listedPct = decided === 0 ? 0 : (seller.listed / decided) * 100;
            const notListedPct = decided === 0 ? 0 : (seller.notListed / decided) * 100;

            return (
              <div
                key={seller.id}
                onClick={() => handleSellerCardClick(seller.slug)}
                className="group relative bg-[#1a1a1a] border border-white/[0.1] hover:border-blue-500/30 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/30 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="grid grid-cols-5 gap-6 relative z-10">
                  <div className="col-span-2 flex flex-col">
                    <div className="flex-1 bg-[#1a1a1a] border border-white/[0.1] rounded-xl p-5 flex flex-col items-center justify-center text-center group-hover:border-blue-500/20 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-[#111111] border border-white/[0.1] flex items-center justify-center mb-3 text-gray-400 group-hover:text-blue-500 group-hover:scale-110 transition-all shadow-inner">
                        <LayoutDashboard className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-500 mb-1 pb-1 w-full text-center">
                        {seller.name}
                      </h3>
                      <div className="text-3xl font-bold text-white tracking-tight">
                        {total.toLocaleString()}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-semibold">
                        Approved Total
                      </span>
                    </div>
                  </div>

                  <div className="col-span-3 flex flex-col justify-center space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        Review Status
                        <div className="h-px flex-1 bg-[#111111]"></div>
                      </h4>

                      {/* Pending (Main) */}
                      <div className="mb-4">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-sm text-amber-400 font-medium flex items-center gap-1.5">
                            <Clock className="w-4 h-4" /> Pending Review
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.1]">
                            {seller.main.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Listed */}
                      <div className="mb-3">
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-sm text-emerald-400 font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" /> Listed
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.1]">
                            {seller.listed.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-white/[0.1]">
                          <div
                            className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${listedPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Not Listed */}
                      <div>
                        <div className="flex justify-between items-end mb-1.5">
                          <span className="text-sm text-rose-400 font-medium flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4" /> Not Listed
                          </span>
                          <span className="text-xs font-mono text-gray-400 bg-[#111111] px-1.5 py-0.5 rounded border border-white/[0.1]">
                            {seller.notListed.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-[#111111] rounded-full h-2 overflow-hidden border border-white/[0.1]">
                          <div
                            className="bg-rose-500 h-full rounded-full shadow-[0_0_10px_rgba(244,63,94,0.4)] transition-all duration-700 ease-out"
                            style={{ width: `${notListedPct}%` }}
                          />
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
