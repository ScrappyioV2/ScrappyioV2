"use client";

import PageTransition from "@/components/layout/PageTransition";
import mockSellerStats from "@/data/mockSellerStats";
import mockScrapingProgress from "@/data/mockScrapingProgress";

export default function ManageSellersPage() {
  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-3xl font-bold text-gray-800">Manage Sellers</h1>
          <p className="text-gray-600 mt-2">Seller Management & Scraping Progress</p>
        </div>

        {/* Main Content - Side by Side Layout */}
        <div className="flex gap-6">
          {/* LEFT SIDE: Seller Count Boxes */}
          <div className="w-64 space-y-4">
            <h2 className="text-xl font-semibold mb-4">No of Sellers</h2>
            
            {mockSellerStats.map((stat) => (
              <div key={stat.country} className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
                <div className="text-sm text-gray-600 border-b border-gray-300 pb-2 mb-3">
                  {stat.country}
                </div>
                <div className="text-4xl font-bold text-gray-800">
                  {stat.count}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT SIDE: Scraping Progress Bars */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold mb-4">Seller Scraping Progress bar</h2>
            
            <div className="space-y-6">
              {mockScrapingProgress.map((progress) => (
                <div key={progress.country} className="bg-white p-6 rounded-lg shadow">
                  <div className="mb-2">
                    <div className="text-sm font-medium text-gray-700">Copy Progress</div>
                    <div className="text-sm text-gray-600">
                      {progress.copied} Copied/ {progress.total} total
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-6">
                        <div
                          className="bg-green-500 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                          style={{ width: `${progress.percent}%` }}
                        >
                          {progress.percent}% Complete
                        </div>
                      </div>
                    </div>
                    
                    <button className="px-4 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">
                      Restart Copied
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
