"use client";

type StageStats = {
  brandChecking: { approved: number; notApproved: number; pending: number };
  validation: { done: number; pending: number };
  adminValidation: { done: number; pending: number };
  listing: { done: number; pending: number; error: number };
  purchasing: { done: number; pending: number };
  reorder: { required: number; completed: number };
};

export default function StageStatsCards({ data }: { data: StageStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Brand Checking */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-blue-600">Brand Checking</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Approved:</span>
            <span className="font-bold text-green-600">{data.brandChecking.approved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Not Approved:</span>
            <span className="font-bold text-red-600">{data.brandChecking.notApproved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-yellow-600">{data.brandChecking.pending}</span>
          </div>
        </div>
      </div>

      {/* Validation */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-purple-600">Validation</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Done:</span>
            <span className="font-bold text-green-600">{data.validation.done}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-yellow-600">{data.validation.pending}</span>
          </div>
        </div>
      </div>

      {/* Admin Validation */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-indigo-600">Admin Validation</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Done:</span>
            <span className="font-bold text-green-600">{data.adminValidation.done}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-yellow-600">{data.adminValidation.pending}</span>
          </div>
        </div>
      </div>

      {/* Listing */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-green-600">Listing</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Done:</span>
            <span className="font-bold text-green-600">{data.listing.done}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-yellow-600">{data.listing.pending}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Error:</span>
            <span className="font-bold text-red-600">{data.listing.error}</span>
          </div>
        </div>
      </div>

      {/* Purchasing */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-orange-600">Purchasing</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Done:</span>
            <span className="font-bold text-green-600">{data.purchasing.done}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Pending:</span>
            <span className="font-bold text-yellow-600">{data.purchasing.pending}</span>
          </div>
        </div>
      </div>

      {/* Reorder */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3 text-red-600">Reorder</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Required:</span>
            <span className="font-bold text-red-600">{data.reorder.required}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Completed:</span>
            <span className="font-bold text-green-600">{data.reorder.completed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
