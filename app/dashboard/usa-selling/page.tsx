"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth"; // ✅ Import Auth
import PageTransition from "@/components/layout/PageTransition";
import {
  ShieldCheck,
  FileCheck,
  UserCheck,
  LayoutList,
  ShoppingBag,
  RefreshCw,
  TrendingUp,
  Loader2 // ✅ Import Loader
} from 'lucide-react';

// Mock data for sellers (Logic Kept Intact)
const sellers = [
  { id: 1, name: "Seller 1", totalProducts: 758 },
  { id: 2, name: "Seller 2", totalProducts: 758 },
  { id: 3, name: "Seller 3", totalProducts: 758 },
  { id: 4, name: "Seller 4", totalProducts: 758 },
];

// Mock data for each stage (Logic Kept Intact)
const stagesData = {
  brandChecking: {
    totalApproved: 1250,
    totalNotApproved: 340,
    totalPending: 180,
    sellers: [
      { id: 1, approved: 123, notApproved: 411 },
      { id: 2, approved: 250, notApproved: 68 },
      { id: 3, approved: 305, notApproved: 45 },
      { id: 4, approved: 572, notApproved: 116 },
    ],
  },
  validation: {
    totalDone: 980,
    totalPending: 290,
    sellers: [
      { id: 1, approved: 341, notApproved: 10 },
      { id: 2, approved: 220, notApproved: 15 },
      { id: 3, approved: 210, notApproved: 12 },
      { id: 4, approved: 209, notApproved: 8 },
    ],
  },
  adminValidation: {
    totalDone: 850,
    totalPending: 420,
    sellers: [
      { id: 1, approved: 111, notApproved: 5 },
      { id: 2, approved: 200, notApproved: 8 },
      { id: 3, approved: 280, notApproved: 6 },
      { id: 4, approved: 259, notApproved: 4 },
    ],
  },
  listing: {
    totalDone: 740,
    totalPending: 530,
    totalError: 45,
    sellers: [
      { id: 1, approved: 148, notApproved: 106 },
      { id: 2, approved: 195, notApproved: 87 },
      { id: 3, approved: 220, notApproved: 130 },
      { id: 4, approved: 177, notApproved: 207 },
    ],
  },
  purchasing: {
    totalDone: 620,
    totalPending: 650,
    sellers: [
      { id: 1, approved: 127, notApproved: 896 },
      { id: 2, approved: 180, notApproved: 780 },
      { id: 3, approved: 165, notApproved: 650 },
      { id: 4, approved: 148, notApproved: 724 },
    ],
  },
  reorder: {
    totalRequired: 85,
    totalCompleted: 35,
    sellers: [
      { id: 1, required: 20, completed: 8 },
      { id: 2, required: 22, completed: 10 },
      { id: 3, required: 21, completed: 9 },
      { id: 4, required: 22, completed: 8 },
    ],
  },
};

export default function USASellingPage() {
  const router = useRouter();
  const { userRole, loading } = useAuth();

  // ✅ REDIRECT LOGIC
  useEffect(() => {
    if (!loading && userRole) {
      const pages = userRole.allowed_pages || [];

      // 1. If they have specific access to Validation, go there
      if (pages.includes('validation')) {
        router.replace('/dashboard/usa-selling/validation');
        return;
      }

      // 2. If they ONLY have access to Brand Checking, go there
      if (pages.includes('brand-checking')) {
        router.replace('/dashboard/usa-selling/brand-checking');
        return;
      }

      // 3. If they are just "Purchase" role
      if (pages.includes('purchase')) {
        router.replace('/dashboard/usa-selling/purchases');
        return;
      }
    }
  }, [loading, userRole, router]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">

        {/* === HEADER === */}
        <div className="mb-10 border-b border-slate-800/60 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">USA Selling Dashboard</h1>
          </div>
          <p className="text-slate-400 pl-[3.75rem]">
            Overview of all processing stages. Total Sellers: <span className="text-indigo-400 font-mono font-bold">{sellers.length}</span> | Total Products: <span className="text-indigo-400 font-mono font-bold">3790</span>
          </p>
        </div>

        <div className="space-y-8">

          {/* 1. Brand Checking Stage */}
          <div id="brand-checking" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Brand Checking Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.brandChecking.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Approved</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Not Approved</span>
                      <span className="font-mono font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">{seller.notApproved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Validation Stage */}
          <div id="validation" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <FileCheck className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Validation Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.validation.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Approved</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Not Approved</span>
                      <span className="font-mono font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">{seller.notApproved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Admin Validation Stage */}
          <div id="admin-validation" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <UserCheck className="w-5 h-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Admin Validation Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.adminValidation.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Approved</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Not Approved</span>
                      <span className="font-mono font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">{seller.notApproved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Listing Stage */}
          <div id="listing-error" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20">
                <LayoutList className="w-5 h-5 text-pink-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Listing & Error Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.listing.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Listed</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Errors</span>
                      <span className="font-mono font-bold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">{seller.notApproved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Purchasing Stage */}
          <div id="purchases" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Purchasing Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.purchasing.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Purchased</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.approved}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Pending</span>
                      <span className="font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">{seller.notApproved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Reorder Stage */}
          <div id="reorder" className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Reorder Status</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {stagesData.reorder.sellers.map((seller) => (
                <div key={seller.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors shadow-lg shadow-black/20">
                  <h3 className="font-semibold text-center mb-4 text-slate-200 border-b border-slate-800 pb-2">
                    Seller {seller.id}
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Required</span>
                      <span className="font-mono font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">{seller.required}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Completed</span>
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">{seller.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}