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

interface IndiaSellersTableProps {
  sellers: Seller[];
}

export default function IndiaSellersTable({ sellers }: IndiaSellersTableProps) {
  const indiaSellers = sellers.filter((s) => s.country === "india");

  return (
    <div>
      <SellerTableLayout sellers={indiaSellers} countryName="India" />
    </div>
  );
}
