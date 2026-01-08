"use client";

import SellerRow from "./SellerRow";

type Props = {
  data: any[];
};

export default function SellerMatrix({ data }: Props) {
  return (
    <div className="bg-white border rounded">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="grid grid-cols-[120px_repeat(4,1fr)] gap-4 text-sm font-semibold p-4">
          <div></div>
          <div>Brand Checking Status</div>
          <div>Listing Status</div>
          <div>Purchasing Status</div>
          <div>Delivered Status</div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
        {data.map((seller) => (
          <SellerRow key={seller.seller} data={seller} />
        ))}
      </div>
    </div>
  );
}
