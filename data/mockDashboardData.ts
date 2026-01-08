export const mockDashboardData = {
  actionQueue: [
    { label: "Brand Approval Pending", count: 18, status: "danger" },
    { label: "Admin Approval Pending", count: 9, status: "warning" },
    { label: "Scrape Failed", count: 4, status: "error" },
    { label: "Ready for Listing", count: 56, status: "info" },
    { label: "Ready for Dropship", count: 22, status: "success" },
    { label: "Reorder Required", count: 6, status: "danger" }
  ],
  systemHealth: {
    scraping: 82,
    copy: 99,
    automationStatus: "Running"
  },
  kpis: [
    { label: "Total Sellers", value: 124 },
    { label: "Total Products", value: 12480 },
    { label: "Approved", value: 9870 },
    { label: "Pending", value: 1420 },
    { label: "Not Approved", value: 1190 },
    { label: "Active Listings", value: 8650 }
  ],
  topSellers: [
    { name: "Seller One", products: 1240 },
    { name: "Seller Two", products: 980 },
    { name: "Seller Three", products: 860 },
    { name: "Seller Four", products: 720 },
    { name: "Seller Five", products: 610 }
  ]
};
