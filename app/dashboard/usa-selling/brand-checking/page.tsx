"use client";

import { useRouter } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";

// Mock data - Replace with Supabase fetch later
const sellersData = [
  {
    id: 1,
    name: "Seller 1",
    totalProducts: 758,
    approved: 535,
    notApproved: 223,
  },
  {
    id: 2,
    name: "Seller 2",
    totalProducts: 758,
    approved: 610,
    notApproved: 148,
  },
  {
    id: 3,
    name: "Seller 3",
    totalProducts: 758,
    approved: 458,
    notApproved: 300,
  },
  {
    id: 4,
    name: "Seller 4",
    totalProducts: 758,
    approved: 680,
    notApproved: 78,
  },
  {
    id: 5,
    name: "Seller 5",
    totalProducts: 758,
    approved: 520,
    notApproved: 238,
  },
];

export default function BrandCheckingPage() {
  const router = useRouter();

  const handleSellerCardClick = (sellerId: number) => {
    router.push(`/dashboard/usa-selling/brand-checking/seller-${sellerId}`);
  };

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
          <h1 className="text-3xl font-bold text-gray-800">USA Selling - Brand Checking Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Total Sellers: {sellersData.length} | Monitor brand checking progress
          </p>
        </div>

        {/* Main Content: Seller Cards + Progress Bars */}
        <div className="space-y-6">
          {sellersData.map((seller) => {
            const approvedPercentage = (seller.approved / seller.totalProducts) * 100;
            const notApprovedPercentage = (seller.notApproved / seller.totalProducts) * 100;

            return (
              <div 
                key={seller.id} 
                className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                {/* Left Side: Seller Card */}
                <div 
                  onClick={() => handleSellerCardClick(seller.id)}
                  className="border-2 border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {seller.name}
                  </h3>
                  <div className="text-center">
                    <p className="text-4xl font-bold text-blue-600">{seller.totalProducts}</p>
                    <p className="text-sm text-gray-500 mt-1">Total Products</p>
                  </div>
                </div>

                {/* Right Side: Progress Bar */}
                <div className="flex flex-col justify-center">
                  <div className="mb-3">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">
                      Brand Checking Progress
                    </h4>
                  </div>
                  
                  {/* Progress Bar Container */}
                  <div className="relative w-full h-16 bg-gray-200 rounded-lg overflow-hidden shadow-inner">
                    {/* Green Section (Approved) */}
                    <div 
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white font-semibold text-sm px-4 transition-all duration-500"
                      style={{ width: `${approvedPercentage}%` }}
                    >
                      {approvedPercentage > 15 && (
                        <span>Approved: {seller.approved}</span>
                      )}
                    </div>
                    
                    {/* Red Section (Not Approved) */}
                    <div 
                      className="absolute right-0 top-0 h-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white font-semibold text-sm px-4 transition-all duration-500"
                      style={{ width: `${notApprovedPercentage}%` }}
                    >
                      {notApprovedPercentage > 15 && (
                        <span>Not Approved: {seller.notApproved}</span>
                      )}
                    </div>
                  </div>

                  {/* Stats Below Progress Bar */}
                  <div className="flex justify-between mt-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-gray-700">
                        Approved: <strong>{seller.approved}</strong> ({approvedPercentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-gray-700">
                        Not Approved: <strong>{seller.notApproved}</strong> ({notApprovedPercentage.toFixed(1)}%)
                      </span>
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
