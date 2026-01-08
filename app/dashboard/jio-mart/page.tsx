"use client";

import { mockJioMartData } from "@/data/mockCountrySellingData";
import StageNavigationBar from "@/components/marketplace/StageNavigationBar";
import SellerProgressGrid from "@/components/marketplace/SellerProgressGrid";
import StageStatsCards from "@/components/marketplace/StageStatsCards";
import PageTransition from "@/components/layout/PageTransition";

export default function JioMartPage() {
  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-800">Jio Mart Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Total Sellers: {mockJioMartData.totalSellers} | Total Products: {mockJioMartData.totalProducts}
          </p>
        </div>

        <StageNavigationBar country="jio-mart" />
        <StageStatsCards data={mockJioMartData.stages} />

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Brand Checking Progress by Seller</h2>
          <SellerProgressGrid sellers={mockJioMartData.sellers} />
        </div>
      </div>
    </PageTransition>
  );
}
