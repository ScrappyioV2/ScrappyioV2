"use client";

import { useParams } from "next/navigation";
import PageTransition from "@/components/layout/PageTransition";
import Link from "next/link";

export default function SellerDetailPage() {
  const params = useParams();
  const sellerName = params.seller;

  return (
    <PageTransition>
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="mb-6">
          {/* <Link 
            href="/dashboard/usa-selling/brand-checking" 
            className="text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Back to Brand Checking Dashboard
          </Link> */}
          <h1 className="text-3xl font-bold text-gray-800 capitalize">
            {sellerName?.toString().replace('-', ' ')} - Detailed View
          </h1>
        </div>

        <div className="bg-white p-8 rounded-lg shadow">
          <p className="text-gray-600 text-lg">
            Detailed information for <strong>{sellerName}</strong> will be displayed here.
          </p>
          <p className="text-gray-500 mt-4">
            This page is ready for your future implementation.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
