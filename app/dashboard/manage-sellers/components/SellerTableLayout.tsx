import React from "react";


interface Seller {
  id: number;
  name: string;
  merchantToken: string;
  page: number;
  totalProducts: number;
  country: string;
  stages: {
    details: boolean;
    verified: boolean;
    highPrice: boolean;
    avgCostPrice: boolean;
    noInvoice: boolean;
    uploadedSeller: boolean;
  };
}


interface SellerTableLayoutProps {
  sellers: Seller[];
  countryName: string;
}


export default function SellerTableLayout({ sellers, countryName }: SellerTableLayoutProps) {
  return (
    <div className="bg-[#111111] rounded-xl shadow-lg overflow-hidden border border-white/[0.06]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <tr>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.06] whitespace-nowrap">
                No.
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.06] whitespace-nowrap">
                Seller Name
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.06] whitespace-nowrap">
                Merchant Token
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.06] whitespace-nowrap">
                Page
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.06] whitespace-nowrap">
                Total Products
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold border-r border-white/[0.06] whitespace-nowrap w-20">
                Details
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold border-r border-white/[0.06] whitespace-nowrap w-20">
                Low to High
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold border-r border-white/[0.06] whitespace-nowrap w-20">
                High to Low
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold border-r border-white/[0.06] whitespace-nowrap w-20">
                Avg Cost Price
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold border-r border-white/[0.06] whitespace-nowrap w-20">
                No Invoice
              </th>
              <th className="px-2 py-4 text-center text-xs font-bold whitespace-nowrap w-20">
                Uploaded Seller
              </th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((seller, index) => (
              <tr
                key={seller.id}
                className={`border-b border-white/[0.06] hover:bg-blue-50 transition-colors ${
                  index % 2 === 0 ? "bg-[#111111]" : "bg-[#111111]"
                }`}
              >
                <td className="px-6 py-4.5 border-r border-white/[0.06] font-semibold text-gray-500">
                  {index + 1}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.06] font-medium text-gray-100">
                  {seller.name}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.06] text-gray-500 font-mono text-sm">
                  {seller.merchantToken}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.06] text-gray-500">
                  {seller.page}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.06] text-gray-500 font-semibold">
                  {seller.totalProducts}
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.details}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.verified}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.highPrice}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.avgCostPrice}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.noInvoice}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-2 py-3.5 text-center w-20">
                  <input
                    type="checkbox"
                    checked={seller.stages.uploadedSeller}
                    onChange={() => {}}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                </td>
              </tr>
            ))}


            {/* Empty rows */}
            {Array.from({ length: Math.max(0, 12 - sellers.length) }).map((_, index) => (
              <tr
                key={`empty-${index}`}
                className={`border-b border-white/[0.06] ${
                  (sellers.length + index) % 2 === 0 ? "bg-[#111111]" : "bg-[#111111]"
                }`}
              >
                <td className="px-6 py-4.5 border-r border-white/[0.06] text-gray-500">
                  {sellers.length + index + 1}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.06]">&nbsp;</td>
                <td className="px-6 py-4.5 border-r border-white/[0.06]">&nbsp;</td>
                <td className="px-6 py-4.5 border-r border-white/[0.06]">&nbsp;</td>
                <td className="px-6 py-4.5 border-r border-white/[0.06]">&nbsp;</td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
                <td className="px-2 py-3.5 text-center border-r border-white/[0.06] w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
                <td className="px-2 py-3.5 text-center w-20">
                  <input type="checkbox" disabled className="w-5 h-5 accent-blue-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
