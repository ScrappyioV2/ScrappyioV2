export interface GeneratedLink {
  id: number;
  sellerName: string;
  merchantToken: string;
  page: number;
  filterType: string;
  sellerProfileLink: string;
  status: "Copied" | "Pending";
}

export const mockGeneratedLinks: GeneratedLink[] = [
  {
    id: 1,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 1,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Copied",
  },
  {
    id: 2,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 2,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
  {
    id: 3,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 3,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Copied",
  },
  {
    id: 4,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 4,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
  {
    id: 5,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 5,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
  {
    id: 6,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 6,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
  {
    id: 7,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 7,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
  {
    id: 8,
    sellerName: "ShopFix123",
    merchantToken: "A10HVELLWOG7ZM",
    page: 8,
    filterType: "Best Sellers",
    sellerProfileLink: "https://www.amazon.in/s?i=merchant-items&me=A10HVELLWOG7ZM...",
    status: "Pending",
  },
];
