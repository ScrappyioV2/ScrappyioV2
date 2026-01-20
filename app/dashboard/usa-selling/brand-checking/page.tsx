"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";
import PageGuard from '../../../components/PageGuard'

const SELLER_TABLE_GROUPS: Record<number, string[]> = {
  1: [
    'usa_seller_1_high_demand',
    'usa_seller_1_low_demand',
    'usa_seller_1_dropshipping',
    'usa_seller_1_not_approved',
    // 'usa_seller_1_reject',
  ],
  2: [
    'usa_seller_2_high_demand',
    'usa_seller_2_low_demand',
    'usa_seller_2_dropshipping',
    'usa_seller_2_not_approved',
    // 'usa_seller_2_reject',
  ],
  3: [
    'usa_seller_3_high_demand',
    'usa_seller_3_low_demand',
    'usa_seller_3_dropshipping',
    'usa_seller_3_not_approved',
    // 'usa_seller_3_reject',
  ],
  4: [
    'usa_seller_4_high_demand',
    'usa_seller_4_low_demand',
    'usa_seller_4_dropshipping',
    'usa_seller_4_not_approved',
    // 'usa_seller_4_reject',
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
  // rejected: number;
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
      notApproved: 0, // ✅ ADD THIS
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
              rejected: row.rejected,
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
                  hasMovement: true,
                }
                : seller
            );

            return updated;
          });

          // ✅ ADD THIS LINE
          setHasAnyMovementYet(true);

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

  // const fetchSellerTotals = async () => {
  //   const updates = await Promise.all(
  //     ALL_SELLERS.map(async (seller) => {
  //       const tables = SELLER_TABLE_GROUPS[seller.id];

  //       let total = 0;

  //       for (const table of tables) {
  //         const { count, error } = await supabase
  //           .from(table)
  //           .select("*", { count: "exact", head: true });

  //         if (error) {
  //           console.error(`❌ Error counting ${table}`, error);
  //           continue;
  //         }

  //         total += count || 0;
  //       }

  //       console.log(`📦 ${seller.name} TOTAL products (all tabs):`, total);

  //       return { seller_id: seller.id, total };
  //     })
  //   );

  //   setSellers((prev) =>
  //     prev.map((s) => {
  //       const row = updates.find((u) => u.seller_id === s.id);
  //       return row ? { ...s, totalProducts: row.total } : s;
  //     })
  //   );
  // };


  // useEffect(() => {
  //   fetchSellerTotals();
  // }, []);


  const fetchApprovedBreakdown = async () => {
    const result: Record<number, SellerApprovalBreakdown> = {};

    for (const seller of ALL_SELLERS) {
      const [
        high,
        low,
        drop,
      ] = await Promise.all([
        supabase.from(`usa_seller_${seller.id}_high_demand`)
          .select('*', { count: 'exact', head: true }),
        supabase.from(`usa_seller_${seller.id}_low_demand`)
          .select('*', { count: 'exact', head: true }),
        supabase.from(`usa_seller_${seller.id}_dropshipping`)
          .select('*', { count: 'exact', head: true }),
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
    fetchApprovedBreakdown();
  }, []);

  return (
    <PageTransition>
      <PageGuard>
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/dashboard/usa-selling"
              className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
            >
              ← Back to USA Selling Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-2">USA Selling - Brand Checking Dashboard</h1>
            <p className="text-gray-600">
              Total Sellers: {sellers.length} | Monitor brand checking progress
            </p>
          </div>

          {/* Seller Grid - 2 columns layout */}
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
                  className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all bg-white"
                >
                  <div className="grid grid-cols-5 gap-4">
                    {/* Left: Seller Card */}
                    <div className="col-span-1 border-2 border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b border-gray-300 pb-1 w-full text-center">
                        {seller.name}
                      </h3>
                      <div className="text-4xl font-bold text-gray-800">
                        {seller.totalProducts.toLocaleString()}
                      </div>
                    </div>

                    {/* Right: Progress Bars */}
                    <div className="col-span-4 flex flex-col justify-center">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        Brand Checking Progress bar
                      </h3>

                      {/* Approved Progress Bar */}
                      <div className="mb-3">
                        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-green-500 h-full flex items-center justify-end pr-2"
                            style={{ width: `${approvedPercentage}%` }}
                          >
                            {approvedPercentage > 10 && (
                              <span className="text-white text-xs font-semibold">
                                {Math.round(approvedPercentage)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-green-600 font-medium mt-1">
                          Approved: {seller.approved}
                        </p>
                      </div>

                      {/* Not Approved Progress Bar */}
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-red-500 h-full flex items-center justify-end pr-2"
                            style={{ width: `${notApprovedPercentage}%` }}
                          >
                            {notApprovedPercentage > 10 && (
                              <span className="text-white text-xs font-semibold">
                                {Math.round(notApprovedPercentage)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-red-600 font-medium mt-1">
                          Not Approved: {seller.notApproved}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PageGuard>
    </PageTransition>
  );
}



