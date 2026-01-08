export interface Seller {
  id: number;
  name: string;
  merchantToken: string;
  page: number;
  totalProducts: number;
  country: string; // ✅ ADD THIS LINE
  stages: {
    details: boolean;
    verified: boolean;
    highPrice: boolean;
    avgCostPrice: boolean;
    noInvoice: boolean;
    uploadedSeller: boolean;
  };
}

export const mockSellers: Seller[] = [
  {
    id: 1,
    name: "ABC",
    merchantToken: "AC626B",
    page: 20,
    totalProducts: 250,
    country: "usa", // ✅ Make sure this exists
    stages: {
      details: false,
      verified: false,
      highPrice: false,
      avgCostPrice: false,
      noInvoice: false,
      uploadedSeller: false,
    },
  },
  // ... add more sellers with country property
];

export const sellerCountByCountry = [
  { country: "usa", label: "Add USA Seller", count: 758 },
  { country: "india", label: "Add India Seller", count: 758 },
  { country: "uae", label: "Add UAE Seller", count: 758 },
  { country: "uk", label: "Add UK Seller", count: 758 },
];
