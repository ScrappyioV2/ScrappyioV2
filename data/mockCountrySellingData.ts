export const mockUSASellingData = {
  country: "USA",
  totalSellers: 5,
  totalProducts: 3790,
  stages: {
    brandChecking: {
      approved: 1250,
      notApproved: 340,
      pending: 180,
    },
    validation: {
      done: 980,
      pending: 290,
    },
    adminValidation: {
      done: 850,
      pending: 420,
    },
    listing: {
      done: 740,
      pending: 530,
      error: 45,
    },
    purchasing: {
      done: 620,
      pending: 650,
    },
    reorder: {
      required: 85,
      completed: 35,
    },
  },
  sellers: [
    {
      name: "Seller 1",
      products: 758,
      brandApproved: 152,
      brandPending: 36,
      listingDone: 148,
      listingPending: 106,
    },
    {
      name: "Seller 2",
      products: 758,
      brandApproved: 250,
      brandPending: 68,
      listingDone: 195,
      listingPending: 87,
    },
    {
      name: "Seller 3",
      products: 758,
      brandApproved: 305,
      brandPending: 45,
      listingDone: 220,
      listingPending: 130,
    },
    {
      name: "Seller 4",
      products: 758,
      brandApproved: 280,
      brandPending: 58,
      listingDone: 205,
      listingPending: 133,
    },
    {
      name: "Seller 5",
      products: 758,
      brandApproved: 263,
      brandPending: 113,
      listingDone: 172,
      listingPending: 74,
    },
  ],
};

export const mockIndiaSellingData = {
  country: "India",
  totalSellers: 5,
  totalProducts: 3790,
  stages: {
    brandChecking: {
      approved: 1180,
      notApproved: 410,
      pending: 200,
    },
    validation: {
      done: 920,
      pending: 260,
    },
    adminValidation: {
      done: 790,
      pending: 390,
    },
    listing: {
      done: 680,
      pending: 490,
      error: 60,
    },
    purchasing: {
      done: 570,
      pending: 600,
    },
    reorder: {
      required: 95,
      completed: 40,
    },
  },
  sellers: [
    {
      name: "Seller 1",
      products: 758,
      brandApproved: 145,
      brandPending: 42,
      listingDone: 136,
      listingPending: 98,
    },
    {
      name: "Seller 2",
      products: 758,
      brandApproved: 235,
      brandPending: 82,
      listingDone: 171,
      listingPending: 64,
    },
    {
      name: "Seller 3",
      products: 758,
      brandApproved: 280,
      brandPending: 76,
      listingDone: 195,
      listingPending: 85,
    },
    {
      name: "Seller 4",
      products: 758,
      brandApproved: 260,
      brandPending: 98,
      listingDone: 178,
      listingPending: 102,
    },
    {
      name: "Seller 5",
      products: 758,
      brandApproved: 260,
      brandPending: 112,
      listingDone: 200,
      listingPending: 141,
    },
  ],
};

export const mockUKSellingData = { ...mockUSASellingData, country: "UK" };
export const mockUAESellingData = { ...mockUSASellingData, country: "UAE" };
export const mockFlipkartData = { ...mockIndiaSellingData, country: "Flipkart" };
export const mockJioMartData = { ...mockIndiaSellingData, country: "Jio Mart" };
