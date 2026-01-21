"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import PageGuard from '@/app/components/PageGuard';
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
type ListingProgressRow = {
  seller_id: number;
  total_pending: number;
  listed: number;
  error: number;
};

type SellerUI = {
  id: number;
  slug: string;
  name: string;
  color: string;
  totalPending: number;
  listed: number;
  error: number;
};

/* ================= PAGE ================= */
export default function ListingErrorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Initialize sellers with 0 progress
  const [sellers, setSellers] = useState<SellerUI[]>(
    ALL_SELLERS.map((s) => ({
      ...s,
      totalPending: 0,
      listed: 0,
      error: 0, 
    }))
  );

  const handleSellerCardClick = (sellerSlug: string) => {
    router.push(`/dashboard/usa-selling/listing-error/${sellerSlug}`);
  };

  /* ===== DATA FETCHING ===== */
  useEffect(() => {
    const fetchProgress = async () => {
      // Fetching all rows - No limit applied
      const { data, error } = await supabase
        .from("listing_error_progress")
        .select("*");

      if (error) {
        console.error("❌ Error fetching progress:", error);
      } else if (data) {
        setSellers((prev) =>
          prev.map((seller) => {
            const row = data.find((d: ListingProgressRow) => d.seller_id === seller.id);
            return row ? {
              ...seller,
              totalPending: row.total_pending,
              listed: row.listed,
              error: row.error,
            } : seller;
          })
        );
      }
      setLoading(false);
    };

    fetchProgress();

    /* ===== REALTIME SUBSCRIPTION ===== */
    const channel = supabase
      .channel("listing-error-progress-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_error_progress" },
        (payload) => {
          const data = payload.new as ListingProgressRow;
          if (data && data.seller_id) {
            setSellers((prev) => prev.map((seller) =>
              seller.id === data.seller_id
                ? {
                    ...seller,
                    totalPending: data.total_pending,
                    listed: data.listed,
                    error: data.error,
                  }
                : seller
            ));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <PageTransition>
      <PageGuard>
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
          
          {/* === HEADER === */}
          <header className="flex items-center justify-between mb-10 pb-6 border-b border-slate-800/60">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]">
                  <LayoutDashboard className="w-6 h-6 text-indigo-400" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Listing Overview</h1>
              </div>
              <p className="text-slate-400 pl-[3.5rem] max-w-lg">
                Real-time overview of product distribution, listings, and error resolution across all marketplaces.
              </p>
            </div>
          </header>

          {/* === GRID === */}
          {loading ? (
             <div className="flex items-center justify-center h-64 text-slate-500 gap-3">
               <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
               <span className="text-sm font-medium tracking-widest">LOADING METRICS...</span>
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
                    className="group relative bg-slate-900/40 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 cursor-pointer backdrop-blur-sm transition-all hover:bg-slate-900/60 hover:shadow-2xl hover:shadow-black/50 overflow-hidden"
                  >
                    {/* Glow Effect on Hover */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-gradient-to-br ${seller.color}`} />

                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="text-xl font-bold text-slate-100 group-hover:text-white transition-colors">{seller.name}</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">USA Marketplace</p>
                      </div>
                      
                      {/* Pending Badge */}
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20 mb-1">
                          <Clock className="w-4 h-4" />
                          <span className="font-bold font-mono">{seller.totalPending}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">PENDING</span>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    <div className="space-y-5 relative z-10">
                      
                      {/* Listed Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Listed</span>
                          </div>
                          <span className="text-slate-300 font-mono">{seller.listed}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${listedPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          />
                        </div>
                      </div>

                      {/* Error Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium">
                          <div className="flex items-center gap-1.5 text-rose-400">
                            <AlertOctagon className="w-3.5 h-3.5" />
                            <span>Errors</span>
                          </div>
                          <span className="text-slate-300 font-mono">{seller.error}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${errorPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                          />
                        </div>
                      </div>

                    </div>

                    {/* Action Footer */}
                    <div className="mt-6 pt-4 border-t border-slate-800/50 flex items-center justify-between text-sm group-hover:text-white transition-colors relative z-10">
                      <span className="text-slate-500 group-hover:text-slate-300 transition-colors">Manage Listings</span>
                      <div className={`p-2 rounded-full bg-slate-800 group-hover:bg-gradient-to-r ${seller.color} transition-all duration-300`}>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </PageGuard>
    </PageTransition>
  );
}