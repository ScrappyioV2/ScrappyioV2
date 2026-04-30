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

interface UkSellersTableProps {
  sellers: Seller[];
}

export default function UkSellersTable({ sellers }: UkSellersTableProps) {
  const ukSellers = sellers.filter((s) => s.country === "uk");

  return (
    <div>
      <SellerTableLayout sellers={ukSellers} countryName="UK" />
    </div>
  );
}
