"use client";

type SellerStat = {
  country: string;
  count: number;
};

export default function SellerCountGrid({ data }: { data: SellerStat[] }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Seller Count by Country</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((item) => (
          <div key={item.country} className="bg-blue-50 p-4 rounded border">
            <div className="text-sm text-gray-600">{item.country}</div>
            <div className="text-2xl font-bold text-blue-600">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
