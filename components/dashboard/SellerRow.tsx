"use client";

import StatusCell from "./StatusCell";

export default function SellerRow({ data }: any) {
  return (
    <div className="grid grid-cols-[120px_repeat(4,1fr)] gap-4 items-center">
      <div className="font-medium">{data.seller}</div>

      <StatusCell
        seller={data.seller}
        stage="brand"
        leftLabel="Approved"
        leftValue={data.brand.approved}
        rightLabel="Not Approved"
        rightValue={data.brand.notApproved}
      />

      <StatusCell
        seller={data.seller}
        stage="listing"
        leftLabel="Done"
        leftValue={data.listing.done}
        rightLabel="Pending"
        rightValue={data.listing.pending}
      />

      <StatusCell
        seller={data.seller}
        stage="purchasing"
        leftLabel="Done"
        leftValue={data.purchasing.done}
        rightLabel="Pending"
        rightValue={data.purchasing.pending}
      />

      <StatusCell
        seller={data.seller}
        stage="delivered"
        leftLabel="Done"
        leftValue={data.delivered.done}
        rightLabel="Pending"
        rightValue={data.delivered.pending}
      />
    </div>
  );
}
