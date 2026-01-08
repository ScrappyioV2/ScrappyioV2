'use client';

import { useState } from 'react';

export default function DashboardPage() {
  // Mock data - replace with real database data later
  const [sellers] = useState([
    { 
      id: 1, 
      name: 'Manage Sellers',
      icon: '📊',
      brandChecking: { approved: 12, notApproved: 3 },
      listing: { done: 8, pending: 7 },
      purchasing: { done: 5, pending: 10 },
      delivered: { done: 4, pending: 11 }
    },
    { 
      id: 2, 
      name: 'USA Selling',
      icon: 'US',
      brandChecking: { approved: 25, notApproved: 5 },
      listing: { done: 18, pending: 12 },
      purchasing: { done: 15, pending: 15 },
      delivered: { done: 10, pending: 20 }
    },
    { 
      id: 3, 
      name: 'India Selling',
      icon: 'IN',
      brandChecking: { approved: 8, notApproved: 2 },
      listing: { done: 6, pending: 4 },
      purchasing: { done: 3, pending: 7 },
      delivered: { done: 2, pending: 8 }
    },
    { 
      id: 4, 
      name: 'UK Selling',
      icon: 'GB',
      brandChecking: { approved: 15, notApproved: 4 },
      listing: { done: 11, pending: 8 },
      purchasing: { done: 9, pending: 10 },
      delivered: { done: 7, pending: 12 }
    },
    { 
      id: 5, 
      name: 'UAE Selling',
      icon: 'AE',
      brandChecking: { approved: 10, notApproved: 2 },
      listing: { done: 7, pending: 5 },
      purchasing: { done: 4, pending: 8 },
      delivered: { done: 3, pending: 9 }
    },
  ]);

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: '#f2f2f2', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 uppercase">Dashboard</h1>
        <p className="text-zinc-600 mt-1">Welcome back!</p>
      </div>

      {/* Vertical Seller Cards */}
      <div className="space-y-6">
        {sellers.map((seller) => (
          <div
            key={seller.id}
            className="bg-white rounded-xl p-6 shadow-md border border-zinc-200"
          >
            {/* Seller Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="text-4xl font-bold text-zinc-900">{seller.icon}</div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-900 uppercase">{seller.name}</h2>
                <p className="text-zinc-600 text-sm">Workflow tracking</p>
              </div>
            </div>

            {/* Status Tables Grid */}
            <div className="grid grid-cols-4 gap-4">
              
              {/* Brand Checking Status */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-300">
                <h3 className="text-zinc-900 font-semibold text-center mb-3 text-sm uppercase">Brand checking Status</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-300">
                      <th className="text-zinc-700 text-xs p-2 uppercase">Approved</th>
                      <th className="text-zinc-700 text-xs p-2 border-l border-zinc-300 uppercase">not - Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center p-3">
                        <span className="text-2xl font-bold text-zinc-900">{seller.brandChecking.approved}</span>
                      </td>
                      <td className="text-center p-3 border-l border-zinc-300">
                        <span className="text-2xl font-bold text-zinc-900">{seller.brandChecking.notApproved}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Listing Status */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-300">
                <h3 className="text-zinc-900 font-semibold text-center mb-3 text-sm uppercase">Listing Status</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-300">
                      <th className="text-zinc-700 text-xs p-2 uppercase">Done</th>
                      <th className="text-zinc-700 text-xs p-2 border-l border-zinc-300 uppercase">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center p-3">
                        <span className="text-2xl font-bold text-zinc-900">{seller.listing.done}</span>
                      </td>
                      <td className="text-center p-3 border-l border-zinc-300">
                        <span className="text-2xl font-bold text-zinc-900">{seller.listing.pending}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Purchasing Status */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-300">
                <h3 className="text-zinc-900 font-semibold text-center mb-3 text-sm uppercase">Purchasing Status</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-300">
                      <th className="text-zinc-700 text-xs p-2 uppercase">Done</th>
                      <th className="text-zinc-700 text-xs p-2 border-l border-zinc-300 uppercase">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center p-3">
                        <span className="text-2xl font-bold text-zinc-900">{seller.purchasing.done}</span>
                      </td>
                      <td className="text-center p-3 border-l border-zinc-300">
                        <span className="text-2xl font-bold text-zinc-900">{seller.purchasing.pending}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Delivered Status */}
              <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-300">
                <h3 className="text-zinc-900 font-semibold text-center mb-3 text-sm uppercase">Deliverd status</h3>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-300">
                      <th className="text-zinc-700 text-xs p-2 uppercase">Done</th>
                      <th className="text-zinc-700 text-xs p-2 border-l border-zinc-300 uppercase">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center p-3">
                        <span className="text-2xl font-bold text-zinc-900">{seller.delivered.done}</span>
                      </td>
                      <td className="text-center p-3 border-l border-zinc-300">
                        <span className="text-2xl font-bold text-zinc-900">{seller.delivered.pending}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <div className="mt-8 text-center">
        <p className="text-sm text-zinc-500">
          🎉 Dashboard loaded successfully! Database integration coming soon.
        </p>
      </div>
    </div>
  );
}
