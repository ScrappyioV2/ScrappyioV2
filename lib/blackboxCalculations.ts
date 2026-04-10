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

// India-specific inputs for the new fee-based calculation
export interface IndiaProductInput extends ProductCalculationInput {
  amazon_category: string | null
  fulfillment_channel: FulfillmentChannel | null
  shipping_zone: ShippingZone | null
}

export interface CalculationConstants {
  dollar_rate: number           
  bank_conversion_rate: number  
  shipping_charge_per_kg: number  // Used by USA mode only
  commission_rate: number         // Used by USA mode only (Amazon USA commission)
  packing_cost: number          
  target_profit_percent?: number  // India mode: minimum profit % to pass (e.g. 10 = 10%)
}

export interface CalculationResult {
  total_cost: number
  total_revenue: number
  profit: number
  judgement: 'PASS' | 'FAIL' | 'PENDING'
  // India mode detailed breakdown
  referral_fee?: number
  closing_fee?: number
  fulfilment_cost?: number
  gst_on_fees?: number
  amazon_fees_total?: number
  actual_profit_percent?: number
}

import {
  calculateReferralFee,
  calculateClosingFee,
  calculateFulfilmentCost,
  type FulfillmentChannel,
  type ShippingZone,
} from '@/lib/amazonIndiaFees';

/**
 * Main Calculation Function
 * @param mode - 'USA' for Exports, 'INDIA' for Imports
 */
export function calculateProductValues(
  product: ProductCalculationInput | IndiaProductInput,
  constants: CalculationConstants,
  mode: CalculationMode 
): CalculationResult {
  
  // 1. Sanitize Inputs
  const inputA = parseFloat(String(product.usd_price)) || 0;
  const weight = parseFloat(String(product.product_weight)) || 0;
  const inputB = parseFloat(String(product.inr_purchase)) || 0;

  // Check if basic fields are filled
  if (inputA > 0 && weight > 0 && inputB > 0) {
    
    // Load Constants
    const dollarRate = parseFloat(String(constants.dollar_rate)) || 90;
    const bankFeePercent = parseFloat(String(constants.bank_conversion_rate)) || 0.02;
    const shippingPerKg = parseFloat(String(constants.shipping_charge_per_kg)) || 950;
    const commissionPercent = parseFloat(String(constants.commission_rate)) || 0.25;
    const packingCost = parseFloat(String(constants.packing_cost)) || 25;

    let totalCost = 0;
    let totalRevenue = 0;

    // ====================================================================
    // LOGIC 1: USA SELLING (EXPORT)
    // Buy in INR -> Sell in USD
    // Unchanged — same formula as before
    // ====================================================================
    if (mode === 'USA') {
      const sellingPriceUSD = inputA;
      const buyingPriceINR = inputB;

      const usdInINR = sellingPriceUSD * dollarRate;
      totalRevenue = usdInINR * (1 - bankFeePercent);

      const shippingCost = (weight * shippingPerKg) / 1000;
      const commissionCost = usdInINR * commissionPercent;
      
      totalCost = buyingPriceINR + shippingCost + packingCost + commissionCost;

      const profit = totalRevenue - totalCost;
      const judgement: 'PASS' | 'FAIL' = profit > 0 ? 'PASS' : 'FAIL';

      return {
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        judgement
      };
    }

    // ====================================================================
    // LOGIC 2: INDIA SELLING (IMPORT) — NEW FEE-BASED CALCULATION
    // Buy in USD -> Sell in INR
    // Uses Amazon India fee structure (referral, closing, fulfilment, GST)
    // ====================================================================
    else if (mode === 'INDIA') {
      const buyingPriceUSD = inputA;
      const sellingPriceINR = inputB;

      // Cast to IndiaProductInput to access category/channel/zone
      const indiaProduct = product as IndiaProductInput;
      const category = indiaProduct.amazon_category || null;
      const channel: FulfillmentChannel = indiaProduct.fulfillment_channel || 'Seller Flex';
      const zone: ShippingZone = indiaProduct.shipping_zone || 'Regional';

      // A. Revenue
      totalRevenue = sellingPriceINR;

      // B. Product Cost + International Shipping
      const baseProductCost = buyingPriceUSD * dollarRate;
      const bankFeeCost = baseProductCost * bankFeePercent;
      const internationalShipping = (weight * (parseFloat(String(constants.shipping_charge_per_kg)) || 950)) / 1000;

      // C. Amazon India Fees
      const referralFee = category
        ? calculateReferralFee(category, sellingPriceINR)
        : sellingPriceINR * 0.1; // fallback 10% if no category selected

      const closingFee = calculateClosingFee(sellingPriceINR, channel);
      const fulfilmentCost = calculateFulfilmentCost(weight, zone, channel);

      // D. GST on Amazon fees (18%)
      const gstOnFees = (referralFee + closingFee + fulfilmentCost) * 0.18;

      // E. Total Amazon Fees
      const amazonFeesTotal = referralFee + closingFee + fulfilmentCost + gstOnFees;

      // F. Total Cost = Product + Bank + Intl Shipping + Packing + Amazon Fees
      totalCost = baseProductCost + bankFeeCost + internationalShipping + packingCost + amazonFeesTotal;

      // G. Profit & Judgement
      const profit = totalRevenue - totalCost;
      const actualProfitPercent = totalRevenue > 0
        ? (profit / totalRevenue) * 100
        : 0;

      const targetProfitPercent = parseFloat(String(constants.target_profit_percent)) || 10;
      const judgement: 'PASS' | 'FAIL' = actualProfitPercent >= targetProfitPercent ? 'PASS' : 'FAIL';

      return {
        total_cost: parseFloat(totalCost.toFixed(2)),
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        judgement,
        referral_fee: parseFloat(referralFee.toFixed(2)),
        closing_fee: parseFloat(closingFee.toFixed(2)),
        fulfilment_cost: parseFloat(fulfilmentCost.toFixed(2)),
        gst_on_fees: parseFloat(gstOnFees.toFixed(2)),
        amazon_fees_total: parseFloat(amazonFeesTotal.toFixed(2)),
        actual_profit_percent: parseFloat(actualProfitPercent.toFixed(2)),
      };
    }
  }

  // Pending if data is missing
  return { total_cost: 0, total_revenue: 0, profit: 0, judgement: 'PENDING' };
}

export function getDefaultConstants(): CalculationConstants {
  return {
    dollar_rate: 90.0,
    bank_conversion_rate: 0.02,
    shipping_charge_per_kg: 950.0,  // USA mode
    commission_rate: 0.25,           // USA mode
    packing_cost: 25.0,
    target_profit_percent: 10,       // India mode: 10% minimum
  }
}