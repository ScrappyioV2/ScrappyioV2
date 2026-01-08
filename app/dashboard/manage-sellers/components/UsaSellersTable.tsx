"use client";

import React from "react";
import SellerTableLayout from "./SellerTableLayout";

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

interface UsaSellersTableProps {
  sellers: Seller[];
}

export default function UsaSellersTable({ sellers }: UsaSellersTableProps) {
  const usaSellers = sellers.filter((s) => s.country === "usa");

  return (
    <div>
      <SellerTableLayout sellers={usaSellers} countryName="USA" />
    </div>
  );
}
