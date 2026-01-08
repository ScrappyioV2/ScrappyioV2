"use client";

import { mockUSASellingData } from "@/data/mockCountrySellingData";
import StageNavigationBar from "@/components/marketplace/StageNavigationBar";
import SellerProgressGrid from "@/components/marketplace/SellerProgressGrid";
import StageStatsCards from "@/components/marketplace/StageStatsCards";
import PageTransition from "@/components/layout/PageTransition";

export default function USASellingPage() {
  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-800">USA Selling Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Total Sellers: {mockUSASellingData.totalSellers} | Total Products: {mockUSASellingData.totalProducts}
          </p>
        </div>

        <StageNavigationBar country="usa-selling" />
        <StageStatsCards data={mockUSASellingData.stages} />

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Brand Checking Progress by Seller</h2>
          <SellerProgressGrid sellers={mockUSASellingData.sellers} />
        </div>
      </div>
    </PageTransition>
  );
}
