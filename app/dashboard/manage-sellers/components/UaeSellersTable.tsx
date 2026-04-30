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

interface UaeSellersTableProps {
  sellers: Seller[];
}

export default function UaeSellersTable({ sellers }: UaeSellersTableProps) {
  const uaeSellers = sellers.filter((s) => s.country === "uae");

  return (
    <div>
      <SellerTableLayout sellers={uaeSellers} countryName="UAE" />
    </div>
  );
}
