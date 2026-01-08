"use client";

import { mockUKSellingData } from "@/data/mockCountrySellingData";
import StageNavigationBar from "@/components/marketplace/StageNavigationBar";
import SellerProgressGrid from "@/components/marketplace/SellerProgressGrid";
import StageStatsCards from "@/components/marketplace/StageStatsCards";
import PageTransition from "@/components/layout/PageTransition";

export default function UKSellingPage() {
  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-800">UK Selling Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Total Sellers: {mockUKSellingData.totalSellers} | Total Products: {mockUKSellingData.totalProducts}
          </p>
        </div>

        <StageNavigationBar country="uk-selling" />
        <StageStatsCards data={mockUKSellingData.stages} />

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Brand Checking Progress by Seller</h2>
          <SellerProgressGrid sellers={mockUKSellingData.sellers} />
        </div>
      </div>
    </PageTransition>
  );
}
