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
      router.push(
        `/dashboard/usa-selling/brand-checking/${seller.slug}`
      );
    }
  };

  /* ===== INITIAL LOAD FROM SUPABASE ===== */
  useEffect(() => {
    supabase
      .from("brand_check_progress")
      .select("*")
      .then(({ data }) => {
        if (!data) return;

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
      });
  }, []);

  /* ===== REALTIME SUBSCRIPTION ===== */
  useEffect(() => {
    const channel = supabase
      .channel("brand-check-progress")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "brand_check_progress",
        },
        (payload) => {
          const data = payload.new as BrandProgressRow;

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <PageTransition>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/usa-selling"
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to USA Selling Dashboard
          </Link>

          <h1 className="text-3xl font-bold text-gray-800">
            USA Selling - Brand Checking Dashboard
          </h1>

          <p className="text-gray-600 mt-1">
            Total Sellers: {sellers.length} | Monitor brand checking progress
          </p>
        </div>

        {/* Seller Cards */}
        <div className="space-y-6">
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
                className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                {/* Seller Card */}
                <div
                  onClick={() => handleSellerCardClick(seller.id)}
                  className="border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {seller.name}
                  </h3>

                  <div className="text-center">
                    <p className="text-4xl font-bold text-blue-600">
                      {seller.totalProducts}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Total Products
                    </p>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex flex-col justify-center">
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Brand Checking Progress
                  </h4>

                  <div className="relative w-full h-16 bg-gray-200 rounded-lg overflow-hidden shadow-inner">
                    {/* Approved */}
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-sm px-4 transition-all duration-500"
                      style={{ width: `${approvedPercentage}%` }}
                    >
                      {approvedPercentage > 15 && (
                        <span>Approved: {seller.approved}</span>
                      )}
                    </div>

                    {/* Not Approved */}
                    <div
                      className="absolute right-0 top-0 h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white font-semibold text-sm px-4 transition-all duration-500"
                      style={{ width: `${notApprovedPercentage}%` }}
                    >
                      {notApprovedPercentage > 15 && (
                        <span>
                          Not Approved: {seller.notApproved}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between mt-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded" />
                      Approved:{" "}
                      <strong>
                        {seller.approved} (
                        {approvedPercentage.toFixed(1)}%)
                      </strong>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded" />
                      Not Approved:{" "}
                      <strong>
                        {seller.notApproved} (
                        {notApprovedPercentage.toFixed(1)}%)
                      </strong>
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
