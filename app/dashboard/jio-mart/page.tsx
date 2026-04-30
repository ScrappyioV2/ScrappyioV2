"use client";

import StageNavigationBar from "@/components/marketplace/StageNavigationBar";
import PageTransition from "@/components/layout/PageTransition";

export default function CountryDashboardPage() {
  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <div className="bg-[#111111] p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-100">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-2">
            Real data integration coming soon.
          </p>
        </div>

        <StageNavigationBar country="disabled" />

        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <p className="text-yellow-800 font-medium">
            ⚠ This page was using mock data and has been temporarily disabled.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
