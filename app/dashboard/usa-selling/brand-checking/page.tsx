"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";

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
        console.log("✅ Initial progress data:", data);
        
        setSellers((prev) =>
          prev.map((seller) => {
            const row = data.find(
              (d: BrandProgressRow) => d.seller_id === seller.id
            );
            if (!row) {
              console.log(`⚠️ No data for seller ${seller.name} (ID: ${seller.id})`);
              return seller;
            }
            
            console.log(`📈 ${seller.name}: Total=${row.total}, Approved=${row.approved}, Not Approved=${row.not_approved}`);
            
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
  }, []);

  /* ===== REALTIME SUBSCRIPTION ===== */
  useEffect(() => {
    console.log("🔌 Setting up real-time subscription for brand_check_progress");
    
    const channel = supabase
      .channel("brand-check-progress-updates")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "brand_check_progress",
        },
        (payload) => {
          console.log("📡 Real-time update received:", payload);
          console.log("📡 Payload.new:", payload.new);
          console.log("📡 Payload.old:", payload.old);
          
          // Handle both INSERT and UPDATE
          const data = payload.new as BrandProgressRow;
          
          if (!data || !data.seller_id) {
            console.error("❌ Invalid payload data:", data);
            return;
          }
          
          console.log(`📡 Updated data for seller_id ${data.seller_id}:`, {
            total: data.total,
            approved: data.approved,
            not_approved: data.not_approved,
          });

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
            console.log(`✅ Updated sellers state:`, updated);
            return updated;
          });
        }
      )
      .subscribe((status) => {
        console.log("📡 Subscription status:", status);
        if (status === 'SUBSCRIBED') {
          console.log("✅ Successfully subscribed to brand_check_progress changes");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ Subscription error");
        }
      });

    return () => {
      console.log("🔌 Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, []);


  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50 p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/usa-selling"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← Back to USA Selling Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">
            USA Selling - Brand Checking Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Total Sellers: {sellers.length} | Monitor brand checking progress
          </p>
        </div>

        {/* Seller Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sellers.map((seller) => {
            const approvedPercentage =
              seller.totalProducts === 0
                ? 0
                : (seller.approved / seller.totalProducts) * 100;
            const notApprovedPercentage =
              seller.totalProducts === 0
                ? 0
                : (seller.notApproved / seller.totalProducts) * 100;

            return (
              <div
                key={seller.id}
                onClick={() => handleSellerCardClick(seller.id)}
                className="border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                {/* Seller Name */}
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  {seller.name}
                </h2>

                {/* Total Products */}
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-blue-600">
                    {seller.totalProducts.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Total Products
                  </div>
                </div>

                {/* Progress */}
                <div className="w-full">
                  <div className="text-sm font-semibold text-gray-700 mb-2">
                    Brand Checking Progress
                  </div>

                  {/* Progress Bar */}
                  <div className="relative w-full h-8 bg-gray-200 rounded-lg overflow-hidden mb-3">
                    {/* Approved */}
                    <div
                      className="absolute left-0 top-0 h-full bg-green-500 flex items-center justify-center transition-all duration-300"
                      style={{ width: `${approvedPercentage}%` }}
                    >
                      {approvedPercentage > 15 && (
                        <span className="text-xs font-bold text-white">
                          Approved: {seller.approved}
                        </span>
                      )}
                    </div>

                    {/* Not Approved */}
                    <div
                      className="absolute right-0 top-0 h-full bg-red-500 flex items-center justify-center transition-all duration-300"
                      style={{ width: `${notApprovedPercentage}%` }}
                    >
                      {notApprovedPercentage > 15 && (
                        <span className="text-xs font-bold text-white">
                          Not Approved: {seller.notApproved}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-between text-xs text-gray-600">
                    <span className="text-green-600 font-semibold">
                      Approved: {seller.approved} (
                      {approvedPercentage.toFixed(1)}%)
                    </span>
                    <span className="text-red-600 font-semibold">
                      Not Approved: {seller.notApproved} (
                      {notApprovedPercentage.toFixed(1)}%)
                    </span>
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
