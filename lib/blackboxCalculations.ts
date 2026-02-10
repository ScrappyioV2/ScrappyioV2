/**
 * Automatic Calculation Engine for V2 - SIMPLIFIED
 * Calculates judgement automatically when fields are filled
 */

// export interface ProductCalculationInput {
//   usd_price: number | null // USA Selling Rate in Dollar
//   product_weight: number | null // Weight in grams
//   inr_purchase: number | null // Product Purchase Rate in INR
// }

// export interface CalculationConstants {
//   dollar_rate: number // Dollar to INR conversion rate
//   bank_conversion_rate: number // Bank fee percentage (as decimal, e.g., 0.02 for 2%)
//   shipping_charge_per_kg: number // Shipping charge per 1000 grams
//   commission_rate: number // Amazon commission percentage (as decimal, e.g., 0.25 for 25%)
//   packing_cost: number // Packing cost per item
// }

// export interface CalculationResult {
//   total_cost: number // All expenses combined
//   total_revenue: number // Money received after bank fees
//   profit: number // Revenue - Cost
//   judgement: 'PASS' | 'FAIL' | 'PENDING'
// }

// /**
//  * Calculate all values automatically using simplified 3-step logic
//  */
// export function calculateProductValues(
//   product: ProductCalculationInput,
//   constants: CalculationConstants
// ): CalculationResult {
//   const usaSellingRate = parseFloat(String(product.usd_price)) || 0
//   const weight = parseFloat(String(product.product_weight)) || 0
//   const purchaseRate = parseFloat(String(product.inr_purchase)) || 0

//   // Check if all required inputs are present
//   if (usaSellingRate > 0 && weight > 0 && purchaseRate > 0) {
//     const dollarRate = parseFloat(String(constants.dollar_rate)) || 90
//     const bankFee = parseFloat(String(constants.bank_conversion_rate)) || 0.02
//     const shippingPerKg = parseFloat(String(constants.shipping_charge_per_kg)) || 950
//     const commissionRate = parseFloat(String(constants.commission_rate)) || 0.25
//     const packingCost = parseFloat(String(constants.packing_cost)) || 25

//     // STEP 1: Total Cost (All Expenses Combined)
//     // Formula: Purchase + (Weight × Shipping/1000) + Packing + (USD × Dollar_Rate × Commission%)
//     const shippingCost = (weight * shippingPerKg) / 1000
//     const usdInINR = usaSellingRate * dollarRate
//     const commissionCost = usdInINR * commissionRate
//     const totalCost = purchaseRate + shippingCost + packingCost + commissionCost

//     // STEP 2: Total Revenue (Money Received)
//     // Formula: (USD × Dollar_Rate) × (1 - Bank_Fee%)
//     const totalRevenue = usdInINR * (1 - bankFee)

//     // STEP 3: Profit & Judgement
//     // Profit = Revenue - Cost
//     // Judgement = Profit > 0 ? "PASS" : "FAIL"
//     const profit = totalRevenue - totalCost
//     const judgement: 'PASS' | 'FAIL' = profit > 0 ? 'PASS' : 'FAIL'

//     return {
//       total_cost: parseFloat(totalCost.toFixed(2)),
//       total_revenue: parseFloat(totalRevenue.toFixed(2)),
//       profit: parseFloat(profit.toFixed(2)),
//       judgement
//     }
//   }

//   // Return pending if not all values present
//   return {
//     total_cost: 0,
//     total_revenue: 0,
//     profit: 0,
//     judgement: 'PENDING'
//   }
// }

// /**
//  * Get default calculation constants (matching Excel values)
//  */
// export function getDefaultConstants(): CalculationConstants {
//   return {
//     dollar_rate: 90.0, // Dollar Rate in INR
//     bank_conversion_rate: 0.02, // 2% bank fee
//     shipping_charge_per_kg: 950.0, // ₹950 per 1000 grams
//     commission_rate: 0.25, // 25% Amazon commission
//     packing_cost: 25.0 // ₹25 per item
//   }
// }

// /**
//  * Check if all required inputs are filled for calculation
//  */
// export function isCalculationReady(product: ProductCalculationInput): boolean {
//   return (
//     product.usd_price !== null &&
//     product.usd_price > 0 &&
//     product.product_weight !== null &&
//     product.product_weight > 0 &&
//     product.inr_purchase !== null &&
//     product.inr_purchase > 0
//   )
// }


/**
 * Unified Calculation Engine for V2
 * Supports both USA (Export) and INDIA (Import) business models
 */

export type CalculationMode = 'USA' | 'INDIA';

export interface ProductCalculationInput {
  usd_price: number | null      // USA Mode: Selling($) | INDIA Mode: Buying($)
  product_weight: number | null // Weight in grams
  inr_purchase: number | null   // USA Mode: Buying(₹)  | INDIA Mode: Selling(₹)
}

export interface CalculationConstants {
  dollar_rate: number           
  bank_conversion_rate: number  
  shipping_charge_per_kg: number 
  commission_rate: number       
  packing_cost: number          
}

export interface CalculationResult {
  total_cost: number
  total_revenue: number
  profit: number
  judgement: 'PASS' | 'FAIL' | 'PENDING'
}

/**
 * Main Calculation Function
 * @param mode - 'USA' for Exports, 'INDIA' for Imports
 */
export function calculateProductValues(
  product: ProductCalculationInput,
  constants: CalculationConstants,
  mode: CalculationMode 
): CalculationResult {
  
  // 1. Sanitize Inputs
  const inputA = parseFloat(String(product.usd_price)) || 0;
  const weight = parseFloat(String(product.product_weight)) || 0;
  const inputB = parseFloat(String(product.inr_purchase)) || 0;

  // Check if fields are filled
  if (inputA > 0 && weight > 0 && inputB > 0) {
    
    // Load Constants
    const dollarRate = parseFloat(String(constants.dollar_rate)) || 90;
    const bankFeePercent = parseFloat(String(constants.bank_conversion_rate)) || 0.02;
    const shippingPerKg = parseFloat(String(constants.shipping_charge_per_kg)) || 950;
    const commissionPercent = parseFloat(String(constants.commission_rate)) || 0.25; // USA commission
    const indiaCommissionPercent = 0.18; // Example: Flipkart/Amazon India might differ (adjust as needed)
    const packingCost = parseFloat(String(constants.packing_cost)) || 25;

    let totalCost = 0;
    let totalRevenue = 0;

    // ====================================================================
    // LOGIC 1: USA SELLING (EXPORT)
    // Buy in INR -> Sell in USD
    // ====================================================================
    if (mode === 'USA') {
      const sellingPriceUSD = inputA; // Revenue
      const buyingPriceINR = inputB;  // Cost

      // A. Calculate Revenue (Money coming IN from USA)
      const usdInINR = sellingPriceUSD * dollarRate;
      totalRevenue = usdInINR * (1 - bankFeePercent); // Deduct bank fee immediately

      // B. Calculate Cost (Money going OUT)
      const shippingCost = (weight * shippingPerKg) / 1000;
      const commissionCost = usdInINR * commissionPercent; // Commission on Selling Price
      
      totalCost = buyingPriceINR + shippingCost + packingCost + commissionCost;
    }

    // ====================================================================
    // LOGIC 2: INDIA SELLING (IMPORT)
    // Buy in USD -> Sell in INR
    // ====================================================================
    else if (mode === 'INDIA') {
      const buyingPriceUSD = inputA;  // Cost
      const sellingPriceINR = inputB; // Revenue

      // A. Calculate Revenue (Money coming IN from India Customer)
      totalRevenue = sellingPriceINR;

      // B. Calculate Cost (Money going OUT)
      const baseProductCost = buyingPriceUSD * dollarRate;
      const bankFeeCost = baseProductCost * bankFeePercent; // Fee on sending money out
      const shippingCost = (weight * shippingPerKg) / 1000;
      
      // Note: Commission is usually on the Selling Price (INR)
      const commissionCost = sellingPriceINR * commissionPercent; 

      totalCost = baseProductCost + bankFeeCost + shippingCost + packingCost + commissionCost;
    }

    // ====================================================================
    // FINAL RESULTS
    // ====================================================================
    const profit = totalRevenue - totalCost;
    const judgement: 'PASS' | 'FAIL' = profit > 0 ? 'PASS' : 'FAIL';

    return {
      total_cost: parseFloat(totalCost.toFixed(2)),
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      judgement
    };
  }

  // Pending if data is missing
  return { total_cost: 0, total_revenue: 0, profit: 0, judgement: 'PENDING' };
}

export function getDefaultConstants(): CalculationConstants {
  return {
    dollar_rate: 90.0,
    bank_conversion_rate: 0.02,
    shipping_charge_per_kg: 950.0,
    commission_rate: 0.25,
    packing_cost: 25.0
  }
}