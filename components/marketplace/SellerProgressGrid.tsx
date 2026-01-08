"use client";

type Seller = {
  name: string;
  products: number;
  brandApproved: number;
  brandPending: number;
  listingDone: number;
  listingPending: number;
};

export default function SellerProgressGrid({ sellers }: { sellers: Seller[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="p-4 font-semibold">Seller Name</th>
            <th className="p-4 font-semibold">Total Products</th>
            <th className="p-4 font-semibold text-green-600">Brand Approved</th>
            <th className="p-4 font-semibold text-yellow-600">Brand Pending</th>
            <th className="p-4 font-semibold text-green-600">Listing Done</th>
            <th className="p-4 font-semibold text-yellow-600">Listing Pending</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller) => (
            <tr key={seller.name} className="border-b hover:bg-gray-50">
              <td className="p-4 font-medium">{seller.name}</td>
              <td className="p-4">{seller.products}</td>
              <td className="p-4 text-green-600 font-bold">{seller.brandApproved}</td>
              <td className="p-4 text-yellow-600 font-bold">{seller.brandPending}</td>
              <td className="p-4 text-green-600 font-bold">{seller.listingDone}</td>
              <td className="p-4 text-yellow-600 font-bold">{seller.listingPending}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

