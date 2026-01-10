"use client";

import PageTransition from "@/components/layout/PageTransition";

// Mock data for sellers
const sellers = [
  { id: 1, name: "Seller 1", totalProducts: 758 },
  { id: 2, name: "Seller 2", totalProducts: 758 },
  { id: 3, name: "Seller 3", totalProducts: 758 },
  { id: 4, name: "Seller 4", totalProducts: 758 },
];

// Mock data for each stage
const stagesData = {
  brandChecking: {
    totalApproved: 1250,
    totalNotApproved: 340,
    totalPending: 180,
    sellers: [
      { id: 1, approved: 123, notApproved: 411 },
      { id: 2, approved: 250, notApproved: 68 },
      { id: 3, approved: 305, notApproved: 45 },
      { id: 4, approved: 572, notApproved: 116 },
    ],
  },
  validation: {
    totalDone: 980,
    totalPending: 290,
    sellers: [
      { id: 1, approved: 341, notApproved: 10 },
      { id: 2, approved: 220, notApproved: 15 },
      { id: 3, approved: 210, notApproved: 12 },
      { id: 4, approved: 209, notApproved: 8 },
    ],
  },
  adminValidation: {
    totalDone: 850,
    totalPending: 420,
    sellers: [
      { id: 1, approved: 111, notApproved: 5 },
      { id: 2, approved: 200, notApproved: 8 },
      { id: 3, approved: 280, notApproved: 6 },
      { id: 4, approved: 259, notApproved: 4 },
    ],
  },
  listing: {
    totalDone: 740,
    totalPending: 530,
    totalError: 45,
    sellers: [
      { id: 1, approved: 148, notApproved: 106 },
      { id: 2, approved: 195, notApproved: 87 },
      { id: 3, approved: 220, notApproved: 130 },
      { id: 4, approved: 177, notApproved: 207 },
    ],
  },
  purchasing: {
    totalDone: 620,
    totalPending: 650,
    sellers: [
      { id: 1, approved: 127, notApproved: 896 },
      { id: 2, approved: 180, notApproved: 780 },
      { id: 3, approved: 165, notApproved: 650 },
      { id: 4, approved: 148, notApproved: 724 },
    ],
  },
  reorder: {
    totalRequired: 85,
    totalCompleted: 35,
    sellers: [
      { id: 1, required: 20, completed: 8 },
      { id: 2, required: 22, completed: 10 },
      { id: 3, required: 21, completed: 9 },
      { id: 4, required: 22, completed: 8 },
    ],
  },
};

export default function USASellingPage() {
  return (
    <PageTransition>
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">USA Selling Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Total Sellers: {sellers.length} | Total Products: 3790
          </p>
        </div>

        {/* Brand Checking Stage */}
        <div id="brand-checking" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Brand Checking Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.brandChecking.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Approved:</span>
                    <span className="font-semibold text-green-600">{seller.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Not Approved:</span>
                    <span className="font-semibold text-red-600">{seller.notApproved}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Validation Stage */}
        <div id="validation" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Validation Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.validation.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Approved:</span>
                    <span className="font-semibold text-green-600">{seller.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Not Approved:</span>
                    <span className="font-semibold text-red-600">{seller.notApproved}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Validation Stage */}
        <div id="admin-validation" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Admin Validation Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.adminValidation.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Approved:</span>
                    <span className="font-semibold text-green-600">{seller.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Not Approved:</span>
                    <span className="font-semibold text-red-600">{seller.notApproved}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Listing Stage */}
        <div id="listing-error" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Listing & Error Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.listing.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Approved:</span>
                    <span className="font-semibold text-green-600">{seller.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Not Approved:</span>
                    <span className="font-semibold text-red-600">{seller.notApproved}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Purchasing Stage */}
        <div id="purchases" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Purchasing Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.purchasing.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Approved:</span>
                    <span className="font-semibold text-green-600">{seller.approved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Not Approved:</span>
                    <span className="font-semibold text-red-600">{seller.notApproved}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reorder Stage */}
        <div id="reorder" className="mb-8 bg-white p-6 rounded-lg shadow scroll-mt-20">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Reorder Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stagesData.reorder.sellers.map((seller) => (
              <div key={seller.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-center mb-3 text-gray-700">
                  Seller {seller.id}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Required:</span>
                    <span className="font-semibold text-orange-600">{seller.required}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Completed:</span>
                    <span className="font-semibold text-green-600">{seller.completed}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
