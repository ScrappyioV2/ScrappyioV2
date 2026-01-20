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

  // Track mount state
  const [mounted, setMounted] = useState(false)

  // Mount tracking
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // INITIAL LOAD ONLY AFTER MOUNT
  useEffect(() => {
    if (!mounted) return

    const fetchSellerTotals = async () => {
      const updates = await Promise.all(
        ALL_SELLERS.map(async (seller) => {
          const tables = SELLER_TABLE_GROUPS[seller.id]
          let total = 0
          for (const table of tables) {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true })

            if (error) {
              console.error(`Error counting ${table}:`, error)
              continue
            }
            total += count ?? 0
          }
          console.log(`${seller.name} TOTAL products (all tabs):`, total)
          return { sellerid: seller.id, total }
        })
      )

      setSellers((prev) =>
        prev.map((s) => {
          const row = updates.find((u) => u.sellerid === s.id)
          return row ? { ...s, totalProducts: row.total } : s
        })
      )
    }

    fetchSellerTotals()
  }, [mounted])

  /* ===== REALTIME SUBSCRIPTION ===== */
  useEffect(() => {
    if (!mounted) return

    console.log('Setting up real-time subscription for brand_check_progress')
    const channel = supabase
      .channel('brand-check-progress-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brand_check_progress',
        },
        (payload) => {
          console.log('Real-time update received:', payload)
          const data = payload.new as BrandProgressRow
          if (!data || !data.seller_id) {
            console.error('Invalid payload data:', data)
            return
          }

          setSellers((prev) => {
            const updated = prev.map((seller) =>
              seller.id === data.seller_id
                ? {
                  ...seller,
                  approved: data.approved,
                  notApproved: data.not_approved,
                  hasMovement: true,
                }
                : seller
            )
            return updated
          })
          setHasAnyMovementYet(true)
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to brand_check_progress changes')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Subscription error')
        }
      })

    return () => {
      console.log('Cleaning up real-time subscription')
      supabase.removeChannel(channel)
    }
  }, [mounted])

  const fetchSellerTotals = async () => {
    const updates = await Promise.all(
      ALL_SELLERS.map(async (seller) => {
        const tables = SELLER_TABLE_GROUPS[seller.id];

        let total = 0;

        for (const table of tables) {
          const { count, error } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          if (error) {
            console.error(`❌ Error counting ${table}`, error);
            continue;
          }

          total += count || 0;
        }

        console.log(`📦 ${seller.name} TOTAL products (all tabs):`, total);

        return { seller_id: seller.id, total };
      })
    );

    setSellers((prev) =>
      prev.map((s) => {
        const row = updates.find((u) => u.seller_id === s.id);
        return row ? { ...s, totalProducts: row.total } : s;
      })
    );
  };


  useEffect(() => {
    fetchSellerTotals();
  }, []);



  return (
    <PageTransition>
      <PageGuard>
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
              const uiApproved =
                seller.totalProducts === 0 ? 0 : seller.approved;

              const uiNotApproved =
                seller.totalProducts === 0 ? 0 : seller.notApproved;

              const checkedTotal = uiApproved + uiNotApproved;
              const hasProgress = checkedTotal > 0;

              const approvedPercentage =
                checkedTotal === 0 ? 0 : (uiApproved / checkedTotal) * 100;

              const notApprovedPercentage =
                checkedTotal === 0 ? 0 : (uiNotApproved / checkedTotal) * 100;


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
                    {/* Progress Bar */}
                    <div className="relative w-full h-8 bg-gray-200 rounded-lg overflow-hidden mb-3">
                      {hasProgress ? (
                        <>
                          {/* Approved (Green) */}
                          <div
                            className="absolute top-0 h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${approvedPercentage}%`, left: 0 }}
                          />

                          {/* Not Approved (Red) */}
                          <div
                            className="absolute top-0 h-full bg-red-500 transition-all duration-300"
                            style={{
                              width: `${notApprovedPercentage}%`,
                              left: `${approvedPercentage}%`,
                            }}
                          />
                        </>
                      ) : (
                        // Zero-state: no progress yet
                        <div className="absolute inset-0 bg-gray-300" />
                      )}
                    </div>
                    {/* Stats */}
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="text-green-600 font-semibold">
                        Approved: {uiApproved}
                      </span>
                      <span className="text-red-600 font-semibold">
                        Not Approved: {uiNotApproved}
                      </span>
                      {/* <span className="text-gray-600 font-semibold">
                      Rejected: {seller.rejected}
                    </span> */}
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
