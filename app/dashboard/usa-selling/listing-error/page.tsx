"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Loader2
} from "lucide-react";

/* ================= STATIC SELLERS ================= */
const ALL_SELLERS = [
  { id: 1, slug: "golden-aura", name: "Golden Aura", color: "from-amber-400 to-orange-500" },
  { id: 2, slug: "rudra-retail", name: "Rudra Retail", color: "from-blue-400 to-indigo-500" },
  { id: 3, slug: "ubeauty", name: "Ubeauty", color: "from-pink-400 to-rose-500" },
  { id: 4, slug: "velvet-vista", name: "Velvet Vista", color: "from-emerald-400 to-teal-500" },
];

/* ================= TYPES ================= */
type SellerUI = {
  id: number;
  slug: string;
  name: string;
  color: string;
  totalPending: number;
  listed: number;
  error: number;
};

export default function ListingErrorDashboard() {
  const router = useRouter();

  // Initialize with Cache
  const [sellers, setSellers] = useState<SellerUI[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('listing_error_real_counts');
      if (cached) {
      const parsed = JSON.parse(cached);
      // ✅ Only use cache if it has exactly 4 sellers
      if (parsed.length === 4) {
        return parsed;
      }
    }
    }
    return ALL_SELLERS.map((s) => ({
      ...s,
      totalPending: 0,
      listed: 0,
      error: 0,
    }));
  });

  const [loading, setLoading] = useState(false);

  const handleSellerCardClick = (sellerSlug: string) => {
    router.push(`/dashboard/usa-selling/listing-error/${sellerSlug}`);
  };

  /* ===== FETCH REAL COUNTS DIRECTLY ===== */
  const fetchRealCounts = useCallback(async () => {
    try {
      // console.log("📊 Fetching counts from usa_listing_error tables...");
      
      const promises = ALL_SELLERS.map(async (seller) => {
        // ✅ UPDATED: Exact table names from your screenshot
        const pendingTable = `usa_listing_error_seller_${seller.id}_pending`; 
        const listedTable = `usa_listing_error_seller_${seller.id}_done`; // 'done' = listed
        const errorTable = `usa_listing_error_seller_${seller.id}_error`; 

        // Run counts in parallel
        const [pending, listed, error] = await Promise.all([
          supabase.from(pendingTable).select('*', { count: 'exact', head: true }),
          supabase.from(listedTable).select('*', { count: 'exact', head: true }),
          supabase.from(errorTable).select('*', { count: 'exact', head: true }),
        ]);

        return {
          id: seller.id,
          totalPending: pending.count || 0,
          listed: listed.count || 0,
          error: error.count || 0,
        };
      });

      const results = await Promise.all(promises);

      setSellers((prev) => {
        const updated = prev.map((s) => {
          const freshData = results.find((r) => r.id === s.id);
          return freshData ? { ...s, ...freshData } : s;
        });

        localStorage.setItem('listing_error_real_counts', JSON.stringify(updated));
        return updated;
      });

    } catch (err) {
      console.error("❌ Error counting rows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ===== LIFECYCLE ===== */
  useEffect(() => {
    fetchRealCounts();

    // Auto-refresh when tab is active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRealCounts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => { 
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchRealCounts]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#111111] text-gray-100 p-8 font-sans selection:bg-orange-400/30">

        {/* === HEADER === */}
        <header className="flex items-center justify-between mb-10 pb-6 border-b border-white/[0.06]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500/100/10 rounded-xl border border-orange-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
                <LayoutDashboard className="w-6 h-6 text-orange-500" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Listing Overview</h1>
            </div>
            <p className="text-gray-400 pl-[3.5rem] max-w-lg">
              Real-time overview of product distribution, listings, and error resolution.
            </p>
          </div>
          
          <button 
             onClick={() => { setLoading(true); fetchRealCounts(); }}
             className="px-4 py-2 bg-[#111111] hover:bg-[#1a1a1a] text-gray-500 text-sm font-medium rounded-lg transition-colors border border-white/[0.06]"
          >
             Refresh Data
          </button>
        </header>

        {/* === GRID === */}
        {loading && sellers[0].totalPending === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            <span className="text-sm font-medium tracking-widest">CALCULATING METRICS...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
            {sellers.map((seller, index) => {
              const totalProcessed = seller.listed + seller.error;
              const listedPercent = totalProcessed === 0 ? 0 : (seller.listed / totalProcessed) * 100;
              const errorPercent = totalProcessed === 0 ? 0 : (seller.error / totalProcessed) * 100;

              return (
                <motion.div
                  key={seller.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  onClick={() => handleSellerCardClick(seller.slug)}
                  className="group relative bg-[#1a1a1a] border border-white/[0.06] hover:border-white/[0.06]/80 rounded-2xl p-6 cursor-pointer transition-all hover:bg-[#111111]/60 hover:shadow-2xl hover:shadow-black/30 overflow-hidden"
                >
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-gradient-to-br ${seller.color}`} />

                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors">{seller.name}</h3>
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-1">USA Marketplace</p>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20 mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="font-bold font-mono">{seller.totalPending}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">PENDING</span>
                    </div>
                  </div>

                  <div className="space-y-5 relative z-10">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Listed</span>
                        </div>
                        <span className="text-gray-500 font-mono">{seller.listed}</span>
                      </div>
                      <div className="h-2 w-full bg-[#111111] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${listedPercent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-emerald-500/100 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <div className="flex items-center gap-1.5 text-rose-400">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          <span>Errors</span>
                        </div>
                        <span className="text-gray-500 font-mono">{seller.error}</span>
                      </div>
                      <div className="h-2 w-full bg-[#111111] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${errorPercent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-rose-500/100 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-sm group-hover:text-white transition-colors relative z-10">
                    <span className="text-gray-500 group-hover:text-gray-200 transition-colors">Manage Listings</span>
                    <div className={`p-2 rounded-full bg-[#111111] group-hover:bg-gradient-to-r ${seller.color} transition-all duration-300`}>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-white" />
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}