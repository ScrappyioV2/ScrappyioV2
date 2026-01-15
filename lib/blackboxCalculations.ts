/**
 * Automatic Calculation Engine for V2 - SIMPLIFIED
 * Calculates judgement automatically when fields are filled
 */

export interface ProductCalculationInput {
  usd_price: number | null // USA Selling Rate in Dollar
  product_weight: number | null // Weight in grams
  inr_purchase: number | null // Product Purchase Rate in INR
}

export interface CalculationConstants {
  dollar_rate: number // Dollar to INR conversion rate
  bank_conversion_rate: number // Bank fee percentage (as decimal, e.g., 0.02 for 2%)
  shipping_charge_per_kg: number // Shipping charge per 1000 grams
  commission_rate: number // Amazon commission percentage (as decimal, e.g., 0.25 for 25%)
  packing_cost: number // Packing cost per item
}

export interface CalculationResult {
  total_cost: number // All expenses combined
  total_revenue: number // Money received after bank fees
  profit: number // Revenue - Cost
  judgement: 'PASS' | 'FAIL' | 'PENDING'
}

/**
 * Calculate all values automatically using simplified 3-step logic
 */
export function calculateProductValues(
  product: ProductCalculationInput,
  constants: CalculationConstants
): CalculationResult {
  const usaSellingRate = parseFloat(String(product.usd_price)) || 0
  const weight = parseFloat(String(product.product_weight)) || 0
  const purchaseRate = parseFloat(String(product.inr_purchase)) || 0

  // Check if all required inputs are present
  if (usaSellingRate > 0 && weight > 0 && purchaseRate > 0) {
    const dollarRate = parseFloat(String(constants.dollar_rate)) || 90
    const bankFee = parseFloat(String(constants.bank_conversion_rate)) || 0.02
    const shippingPerKg = parseFloat(String(constants.shipping_charge_per_kg)) || 950
    const commissionRate = parseFloat(String(constants.commission_rate)) || 0.25
    const packingCost = parseFloat(String(constants.packing_cost)) || 25

    // STEP 1: Total Cost (All Expenses Combined)
    // Formula: Purchase + (Weight × Shipping/1000) + Packing + (USD × Dollar_Rate × Commission%)
    const shippingCost = (weight * shippingPerKg) / 1000
    const usdInINR = usaSellingRate * dollarRate
    const commissionCost = usdInINR * commissionRate
    const totalCost = purchaseRate + shippingCost + packingCost + commissionCost

    // STEP 2: Total Revenue (Money Received)
    // Formula: (USD × Dollar_Rate) × (1 - Bank_Fee%)
    const totalRevenue = usdInINR * (1 - bankFee)

    // STEP 3: Profit & Judgement
    // Profit = Revenue - Cost
    // Judgement = Profit > 0 ? "PASS" : "FAIL"
    const profit = totalRevenue - totalCost
    const judgement: 'PASS' | 'FAIL' = profit > 0 ? 'PASS' : 'FAIL'

    return {
      total_cost: parseFloat(totalCost.toFixed(2)),
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      profit: parseFloat(profit.toFixed(2)),
      judgement
    }
  }

  // Return pending if not all values present
  return {
    total_cost: 0,
    total_revenue: 0,
    profit: 0,
    judgement: 'PENDING'
  }
}

/**
 * Get default calculation constants (matching Excel values)
 */
export function getDefaultConstants(): CalculationConstants {
  return {
    dollar_rate: 90.0, // Dollar Rate in INR
    bank_conversion_rate: 0.02, // 2% bank fee
    shipping_charge_per_kg: 950.0, // ₹950 per 1000 grams
    commission_rate: 0.25, // 25% Amazon commission
    packing_cost: 25.0 // ₹25 per item
  }
}

/**
 * Check if all required inputs are filled for calculation
 */
export function isCalculationReady(product: ProductCalculationInput): boolean {
  return (
    product.usd_price !== null &&
    product.usd_price > 0 &&
    product.product_weight !== null &&
    product.product_weight > 0 &&
    product.inr_purchase !== null &&
    product.inr_purchase > 0
  )
}
