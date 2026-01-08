"use client";

import SellerMatrix from "./SellerMatrix";
import { mockSellerMatrix } from "@/data/mockSellerMatrix";

export default function SellerOverview() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Seller Overview</h2>
      <SellerMatrix data={mockSellerMatrix} />
    </div>
  );
}
