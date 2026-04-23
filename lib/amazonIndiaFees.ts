/**
 * Amazon India Fee Structure 2025-26
 * Referral Rates, Closing Fees, Fulfilment/Shipping Rates
 */

// ─── REFERRAL RATES (235 categories, tiered by price) ──────────────
// Structure: up to 4 tiers. Rate applies to the portion of price in that tier.
// threshold = upper bound of that tier. Rate = percentage as decimal.
// "—" in Excel means no tier boundary (rate applies to everything above previous tier)

export interface ReferralTier {
  threshold: number | null; // null = no upper bound (applies to rest)
  rate: number;
}

export interface CategoryReferral {
  category: string;
  tiers: ReferralTier[];
}

export const REFERRAL_RATES: CategoryReferral[] = [
  { category: "School Textbook Bundles", tiers: [{ threshold: 250, rate: 0.02 }, { threshold: 1000, rate: 0.03 }, { threshold: 1500, rate: 0.04 }, { threshold: null, rate: 0.045 }] },
  { category: "Books", tiers: [{ threshold: 250, rate: 0 }, { threshold: 500, rate: 0.02 }, { threshold: 1000, rate: 0.04 }, { threshold: null, rate: 0.135 }] },
  { category: "Movies", tiers: [{ threshold: 500, rate: 0.065 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Software Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 2000, rate: 0.075 }, { threshold: null, rate: 0.095 }] },
  { category: "Music", tiers: [{ threshold: 500, rate: 0.065 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Video Games - Consoles", tiers: [{ threshold: 500, rate: 0.07 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.09 }] },
  { category: "Video Games - Accessories", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.135 }] },
  { category: "Video Games - Online Game Services", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 2000, rate: 0.02 }, { threshold: null, rate: 0.03 }] },
  { category: "Video Games - Other Products", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.12 }] },
  { category: "Toys - Drones", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.3 }] },
  { category: "Toys - Party Supplies Balloons Banners", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Toys - Games Puzzles Board Games", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Toys - Infant Pre-school", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Toys - Outdoor Activity Sports", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.105 }] },
  { category: "Toys - Plush Action Figures Dolls", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.105 }] },
  { category: "Toys - Remote Controlled Vehicles", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Toys - STEM Art Craft Learning", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Toys - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Pet Foods", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.065 }, { threshold: null, rate: 0.095 }] },
  { category: "Pet - Aquatics Supplies", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Pet Accessories Apparel Collar Leash", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Pet Comforters Bed Feeder Cages", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Pet Essentials Health Grooming", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Pet - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Beauty - Haircare Bath Shower", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Beauty - Make-up", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.07 }] },
  { category: "Deodorants", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.065 }, { threshold: null, rate: 0.07 }] },
  { category: "Facial Steamers", tiers: [{ threshold: 500, rate: 0 }, { threshold: null, rate: 0.07 }] },
  { category: "Beauty - Fragrance", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.14 }, { threshold: null, rate: 0.1 }] },
  { category: "Face Wash", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.095 }] },
  { category: "Moisturiser Cream", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.095 }] },
  { category: "Sunscreen", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.095 }] },
  { category: "Beauty - Other Products", tiers: [{ threshold: 500, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "Luxury Beauty", tiers: [{ threshold: 500, rate: 0 }, { threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.1 }] },
  { category: "Feminine Hygiene and Care", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Health - Medical Equipment Sexual Wellness", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.02 }] },
  { category: "Health - Sports Nutrition Shakes", tiers: [{ threshold: 300, rate: 0 }, { threshold: 500, rate: 0.09 }, { threshold: null, rate: 0.095 }] },
  { category: "Health - Ayurvedic Homeopathic", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.07 }] },
  { category: "Health - Household Cleaning Laundry", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Health - Vitamins Mineral Supplements", tiers: [{ threshold: 300, rate: 0 }, { threshold: 500, rate: 0.09 }, { threshold: 1000, rate: 0.105 }, { threshold: null, rate: 0.11 }] },
  { category: "Health - Regulated Healthcare", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.02 }] },
  { category: "Health - Other Products", tiers: [{ threshold: 300, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Baby Hardlines Swings Carriers Safety", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Baby Strollers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "Baby Kids Furniture Home Decor", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Baby Walker", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Body Support Wearables Soft Aids", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.02 }] },
  { category: "Baby - Diapers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.095 }] },
  { category: "Baby - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "Breast Pumps", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "Diaper Bags", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "Grocery - Herbs and Spices", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Grocery - Dried Fruits and Nuts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "Grocery - Hampers and Gifting", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Grocery and Gourmet - Oils", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Grocery and Gourmet - Beverages", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "Grocery and Gourmet - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "OTC Medicine", tiers: [{ threshold: 500, rate: 0.12 }, { threshold: null, rate: 0.15 }] },
  { category: "Pharmacy - Prescription Medicines", tiers: [{ threshold: null, rate: 0.08 }] },
  { category: "PCA - Weighing Scales Fat Analysers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.135 }] },
  { category: "PCA - Grooming and Styling", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.095 }] },
  { category: "PCA - Electric Massagers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.145 }] },
  { category: "PCA - Glucometer Strips", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.055 }] },
  { category: "PCA - Thermometers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.105 }] },
  { category: "PCA - Blood Pressure Monitors", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "PCA - Electric Pain Relief Devices", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "PCA - Electric Toothbrush Oral", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "PCA - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "Apparel - Womens Innerwear Lingerie", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.18 }] },
  { category: "Apparel - Sarees Dress Materials", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.15 }] },
  { category: "Apparel - Sweat Shirts Jackets", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.18 }] },
  { category: "Apparel - Dress", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Apparel - Shirts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.21 }] },
  { category: "Apparel - Socks Stockings", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Apparel - Thermals", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Pants Trousers Jeans Trackpants", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Apparel - Other Innerwear", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.185 }] },
  { category: "Sleepwear", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Apparel - Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Apparel - Mens T-Shirts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.23 }] },
  { category: "Apparel - Ethnic Wear", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.165 }] },
  { category: "Apparel - Baby", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.07 }] },
  { category: "Apparel - Shorts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.24 }] },
  { category: "Apparel - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.19 }] },
  { category: "Eyewear Sunglasses Frames", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.185 }] },
  { category: "Watches", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.15 }] },
  { category: "Flip Flops", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.15 }] },
  { category: "Kids Shoes", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Shoes", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Wallets", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Backpacks", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.145 }] },
  { category: "Handbags", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Luggage - Suitcase Trolleys", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.055 }] },
  { category: "Luggage - Travel Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Luggage - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Silver Jewellery", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Silver Coins and Bars", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Fine Jewellery - Unstudded Solitaire", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Fine Jewellery - Studded", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Fine Jewellery - Gold Coins", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Fashion Jewellery", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.225 }] },
  { category: "Kitchen Tools Choppers Knives Bakeware", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Cookware Tableware Dinnerware", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Kitchen Glassware Ceramicware", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Gas Stoves Pressure Cookers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 1500, rate: 0.06 }, { threshold: null, rate: 0.1 }] },
  { category: "Small Appliances", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.045 }, { threshold: null, rate: 0.08 }] },
  { category: "Fans and Robotic Vacuums", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.045 }, { threshold: null, rate: 0.08 }] },
  { category: "Water Purifier and Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.065 }, { threshold: null, rate: 0.075 }] },
  { category: "Water Heaters and Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.08 }, { threshold: null, rate: 0.09 }] },
  { category: "Inverter and Batteries", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.045 }] },
  { category: "Cleaning Home Appliances", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.075 }, { threshold: null, rate: 0.085 }] },
  { category: "Containers Boxes Bottles Storage", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Slipcovers Kitchen Linens", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.155 }] },
  { category: "Kitchen - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Wall Art", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.135 }] },
  { category: "Home Fragrance and Candles", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Home Furnishing excl Curtain", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.11 }] },
  { category: "Netting Cover", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Bedsheets Blankets Covers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Home Storage excl Kitchen", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.15 }] },
  { category: "Shelves Cabinets Racks Stands", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Home Waste and Recycling", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Craft Materials", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Home Decor Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.17 }] },
  { category: "Clocks", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "LED Bulbs and Battens", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Indoor Lighting Wall Ceiling Fixture", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.125 }] },
  { category: "Indoor Lighting - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Cushion Covers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "Curtains and Curtain Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.165 }] },
  { category: "Rugs and Doormats", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "Doors Windows Wood Metal PVC", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 5000, rate: 0.06 }, { threshold: null, rate: 0.02 }] },
  { category: "Sanitaryware Toilets Bathtubs", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 10000, rate: 0.08 }, { threshold: null, rate: 0.06 }] },
  { category: "Tiles and Flooring", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Wires Electrical Cables", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "Home - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.18 }] },
  { category: "Home Improvement Wallpapers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Wall Paints and Tools", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Home Improvement Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.135 }] },
  { category: "Safes and Lockers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Home Improvement Kitchen Bath Fittings", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Ladders", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Home Safety Security Systems", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Home Improvement - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.135 }] },
  { category: "Lawn Garden - Solar Panels", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.02 }] },
  { category: "Lawn Garden - Leaf Blower Water Pump", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Lawn Garden - Solar Devices Inverters", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Lawn Garden - Chemical Pest Control", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.09 }] },
  { category: "Lawn Garden - Outdoor Saws Mowers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.065 }] },
  { category: "Lawn Garden - Plants Seeds Tools", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.11 }] },
  { category: "Lawn Garden - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.1 }, { threshold: null, rate: 0.05 }] },
  { category: "Automotive - Tyres and Rims", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.03 }] },
  { category: "Automotive - Batteries Air Fresheners", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Automotive Accessories Floor Mats Covers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Automotive Helmets Riding Gloves", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Automotive Vehicles 2W 4W EV", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 50000, rate: 0.05 }, { threshold: null, rate: 0.02 }] },
  { category: "Automotive Car Bike Parts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Vehicle Tools and Appliances", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Oils Lubricants", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Automotive Cleaning Kits Polish", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Automotive - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Major Appliances Accessories", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Chimneys", tiers: [{ threshold: null, rate: 0.095 }] },
  { category: "Refrigerators", tiers: [{ threshold: null, rate: 0.05 }] },
  { category: "Major Appliances - Other Products", tiers: [{ threshold: null, rate: 0.055 }] },
  { category: "Mattresses", tiers: [{ threshold: 500, rate: 0.255 }, { threshold: 1000, rate: 0 }, { threshold: 20000, rate: 0.16 }, { threshold: null, rate: 0.135 }] },
  { category: "Bean Bags and Inflatables", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Office Furniture Study Table Chairs", tiers: [{ threshold: 500, rate: 0.165 }, { threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.155 }, { threshold: null, rate: 0.11 }] },
  { category: "Large Furniture Sofa Beds Wardrobes", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.155 }, { threshold: null, rate: 0.11 }] },
  { category: "Furniture - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.155 }, { threshold: null, rate: 0.11 }] },
  { category: "Business and Scientific Supplies", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.115 }, { threshold: null, rate: 0.07 }] },
  { category: "3D Printers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.12 }] },
  { category: "Business Industrial Electrical Testing", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Business Industrial Food Handling", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.055 }] },
  { category: "Stethoscopes", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.105 }] },
  { category: "Packing Materials", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Power Hand Tools Water Dispenser", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "Masks", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Business Industrial - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 15000, rate: 0.08 }, { threshold: null, rate: 0.05 }] },
  { category: "Bicycles", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.06 }] },
  { category: "Gym Equipment", tiers: [{ threshold: 1000, rate: 0 }, { threshold: 35000, rate: 0.12 }, { threshold: null, rate: 0.1 }] },
  { category: "Gym Weights", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.055 }] },
  { category: "Sports - Footwear", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.16 }] },
  { category: "Sports - Cricket Badminton Tennis etc", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.085 }] },
  { category: "Sports - Bats Racquets Paddles", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.075 }] },
  { category: "Sports - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Sports Collectibles", tiers: [{ threshold: 300, rate: 0 }, { threshold: null, rate: 0.17 }] },
  { category: "Consumable Physical Gift Card", tiers: [{ threshold: null, rate: 0.05 }] },
  { category: "E-mail Gift Card", tiers: [{ threshold: null, rate: 0 }] },
  { category: "Entertainment Collectibles", tiers: [{ threshold: 300, rate: 0.13 }, { threshold: null, rate: 0.17 }] },
  { category: "Coins Collectibles", tiers: [{ threshold: 300, rate: 0 }, { threshold: null, rate: 0.15 }] },
  { category: "Mobile Phones", tiers: [{ threshold: null, rate: 0.05 }] },
  { category: "Tablets", tiers: [{ threshold: 300, rate: 0 }, { threshold: 12000, rate: 0.06 }, { threshold: null, rate: 0.1 }] },
  { category: "Laptops", tiers: [{ threshold: null, rate: 0.06 }] },
  { category: "Scanners and Printers", tiers: [{ threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.105 }] },
  { category: "PC Components RAM Motherboards", tiers: [{ threshold: 300, rate: 0 }, { threshold: null, rate: 0.055 }] },
  { category: "Desktops", tiers: [{ threshold: null, rate: 0.08 }] },
  { category: "Monitors", tiers: [{ threshold: 1000, rate: 0.065 }, { threshold: null, rate: 0.08 }] },
  { category: "Laptop Camera Battery", tiers: [{ threshold: 300, rate: 0.14 }, { threshold: 500, rate: 0.125 }, { threshold: 1000, rate: 0.14 }, { threshold: null, rate: 0.155 }] },
  { category: "Laptop Bags and Sleeves", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.145 }] },
  { category: "USB Flash Drives Pen Drives", tiers: [{ threshold: null, rate: 0.16 }] },
  { category: "Hard Disks", tiers: [{ threshold: 1000, rate: 0.095 }, { threshold: null, rate: 0.125 }] },
  { category: "Amazon Kindle Accessories", tiers: [{ threshold: null, rate: 0.25 }] },
  { category: "Memory Cards", tiers: [{ threshold: 500, rate: 0.16 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.16 }] },
  { category: "Modems Networking Devices", tiers: [{ threshold: null, rate: 0.14 }] },
  { category: "Car Electronics Devices", tiers: [{ threshold: 300, rate: 0 }, { threshold: 500, rate: 0.075 }, { threshold: 1000, rate: 0.095 }, { threshold: null, rate: 0.12 }] },
  { category: "Car Electronics Accessories", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.15 }] },
  { category: "Electronic Devices excl TV Camera", tiers: [{ threshold: 1000, rate: 0.09 }, { threshold: null, rate: 0.11 }] },
  { category: "Landline Phones", tiers: [{ threshold: null, rate: 0.07 }] },
  { category: "Smart Watches and Accessories", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.17 }] },
  { category: "Television", tiers: [{ threshold: null, rate: 0.06 }] },
  { category: "Camera and Camcorder", tiers: [{ threshold: 1000, rate: 0.05 }, { threshold: 19000, rate: 0.07 }, { threshold: 49000, rate: 0.09 }, { threshold: null, rate: 0.07 }] },
  { category: "Camera Lenses", tiers: [{ threshold: 1000, rate: 0.07 }, { threshold: null, rate: 0.1 }] },
  { category: "Camera Accessories", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.135 }] },
  { category: "GPS Devices", tiers: [{ threshold: 300, rate: 0.135 }, { threshold: 500, rate: 0.125 }, { threshold: null, rate: 0.135 }] },
  { category: "Speakers", tiers: [{ threshold: 500, rate: 0.11 }, { threshold: 1000, rate: 0.115 }, { threshold: null, rate: 0.14 }] },
  { category: "Headsets Headphones Earphones", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.18 }] },
  { category: "Keyboards and Mouse", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.17 }] },
  { category: "Power Banks and Chargers", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.205 }] },
  { category: "Accessories Electronics PC Wireless", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.17 }] },
  { category: "Cases Covers Skins Screen Guards", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.25 }] },
  { category: "Cables Adapters Electronics PC", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.2 }] },
  { category: "Car Cradles Lens Kits Tablet Cases", tiers: [{ threshold: 300, rate: 0 }, { threshold: 1000, rate: 0.05 }, { threshold: null, rate: 0.285 }] },
  { category: "Warranty Services", tiers: [{ threshold: 300, rate: 0.1 }, { threshold: 500, rate: 0.29 }, { threshold: null, rate: 0.3 }] },
  { category: "Office Products - Arts Crafts", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.05 }] },
  { category: "Office Products - Office Supplies", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.13 }] },
  { category: "Office Products - Writing Instruments", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.14 }] },
  { category: "Office - Electronic Devices", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Office - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Projectors Home Theatre Binoculars", tiers: [{ threshold: null, rate: 0.06 }] },
  { category: "Musical Instruments - Guitars", tiers: [{ threshold: 500, rate: 0.1 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.1 }] },
  { category: "Musical Instruments - Keyboards", tiers: [{ threshold: 500, rate: 0.08 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.08 }] },
  { category: "Musical Instruments - Microphones", tiers: [{ threshold: 300, rate: 0.095 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.115 }] },
  { category: "Musical Instruments - DJ VJ Recording", tiers: [{ threshold: 300, rate: 0.06 }, { threshold: 500, rate: 0.045 }, { threshold: 1000, rate: 0 }, { threshold: null, rate: 0.11 }] },
  { category: "Musical Instruments - Other Products", tiers: [{ threshold: 1000, rate: 0 }, { threshold: null, rate: 0.11 }] },
];

// ─── Helper: Get all category names (for dropdown) ─────────────────
export const CATEGORY_NAMES = REFERRAL_RATES.map(r => r.category).sort();

// ─── Calculate Referral Fee (tiered) ───────────────────────────────
export function calculateReferralFee(category: string, sellingPrice: number): number {
  const cat = REFERRAL_RATES.find(r => r.category === category);
  if (!cat) return sellingPrice * 0.1; // fallback 10%

  // Apply rate for the tier the price falls into
  // The rate applies to the FULL selling price (not just the portion in that tier)
  for (const tier of cat.tiers) {
    if (tier.threshold === null || sellingPrice <= tier.threshold) {
      return sellingPrice * tier.rate;
    }
  }
  // If price exceeds all thresholds, use the last rate
  const lastTier = cat.tiers[cat.tiers.length - 1];
  return sellingPrice * lastTier.rate;
}

// ─── CLOSING FEES ──────────────────────────────────────────────────
export type FulfillmentChannel = 'Easy Ship' | 'Self-Ship' | 'Seller Flex';

interface ClosingFeeSlab {
  minPrice: number;
  maxPrice: number | null;
  fees: Record<FulfillmentChannel, number>;
}

const CLOSING_FEE_SLABS: ClosingFeeSlab[] = [
  { minPrice: 0, maxPrice: 300, fees: { 'Easy Ship': 1, 'Self-Ship': 20, 'Seller Flex': 6 } },
  { minPrice: 301, maxPrice: 500, fees: { 'Easy Ship': 22, 'Self-Ship': 26, 'Seller Flex': 12 } },
  { minPrice: 501, maxPrice: 1000, fees: { 'Easy Ship': 45, 'Self-Ship': 51, 'Seller Flex': 35 } },
  { minPrice: 1001, maxPrice: null, fees: { 'Easy Ship': 76, 'Self-Ship': 101, 'Seller Flex': 66 } },
];

export function calculateClosingFee(sellingPrice: number, channel: FulfillmentChannel): number {
  for (const slab of CLOSING_FEE_SLABS) {
    if (slab.maxPrice === null || sellingPrice <= slab.maxPrice) {
      return slab.fees[channel];
    }
  }
  return CLOSING_FEE_SLABS[CLOSING_FEE_SLABS.length - 1].fees[channel];
}

// ─── FULFILMENT / SHIPPING RATES (Weight Handling) ─────────────────
export type ShippingZone = 'Local' | 'Regional' | 'National';

interface ShippingRate {
  maxWeightKg: number;
  fees: Record<ShippingZone, number>;
}

const SHIPPING_RATES: ShippingRate[] = [
  { maxWeightKg: 0.5, fees: { Local: 29, Regional: 40, National: 55 } },
  { maxWeightKg: 1, fees: { Local: 38, Regional: 52, National: 72 } },
  { maxWeightKg: 1.5, fees: { Local: 50, Regional: 68, National: 92 } },
  { maxWeightKg: 2, fees: { Local: 62, Regional: 84, National: 112 } },
  { maxWeightKg: 2.5, fees: { Local: 74, Regional: 100, National: 132 } },
  { maxWeightKg: 3, fees: { Local: 86, Regional: 116, National: 152 } },
  { maxWeightKg: 3.5, fees: { Local: 100, Regional: 135, National: 178 } },
  { maxWeightKg: 4, fees: { Local: 114, Regional: 154, National: 204 } },
  { maxWeightKg: 4.5, fees: { Local: 128, Regional: 173, National: 230 } },
  { maxWeightKg: 5, fees: { Local: 142, Regional: 192, National: 256 } },
  { maxWeightKg: 6, fees: { Local: 170, Regional: 230, National: 308 } },
  { maxWeightKg: 7, fees: { Local: 198, Regional: 268, National: 360 } },
  { maxWeightKg: 8, fees: { Local: 226, Regional: 306, National: 412 } },
  { maxWeightKg: 9, fees: { Local: 254, Regional: 344, National: 464 } },
  { maxWeightKg: 10, fees: { Local: 282, Regional: 382, National: 516 } },
];

export function calculateShippingFee(weightGrams: number, zone: ShippingZone): number {
  const weightKg = weightGrams / 1000;

  for (const rate of SHIPPING_RATES) {
    if (weightKg <= rate.maxWeightKg) {
      return rate.fees[zone];
    }
  }

  // Above 10kg: extrapolate from last two entries
  const last = SHIPPING_RATES[SHIPPING_RATES.length - 1];
  const prev = SHIPPING_RATES[SHIPPING_RATES.length - 2];
  const perKgRate = last.fees[zone] - prev.fees[zone];
  const extraKg = Math.ceil(weightKg - last.maxWeightKg);
  return last.fees[zone] + (extraKg * perKgRate);
}

// ─── TECH FEE (Seller Flex only) ───────────────────────────────────
export const SELLER_FLEX_TECH_FEE = 14;

export function calculateFulfilmentCost(
  weightGrams: number,
  zone: ShippingZone,
  channel: FulfillmentChannel
): number {
  const shippingFee = calculateShippingFee(weightGrams, zone);
  const techFee = channel === 'Seller Flex' ? SELLER_FLEX_TECH_FEE : 0;
  return shippingFee + techFee;
}