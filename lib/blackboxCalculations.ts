/**
 * Automatic Calculation Engine - NEW FORMULA
 * Updated: Jan 14, 2026
 */

export interface ProductCalculationInput {
  usd_price: number | null
  product_weight: number | null
  inr_sold: number | null
}

export interface CalculationConstants {
  dollar_rate: number
  card_conversion_rate: number
  cargo_rate_per_kg: number
  commission_rate: number
  packing_cost: number
}

export interface CalculationResult {
  purchase_rate_inr: number      // INR buying cost (USD with card × dollar rate)
  cargo_charge: number            // Cargo cost based on weight
  final_purchase_rate: number     // Total INR Purchase cost
  india_price: number             // Same as final_purchase_rate
  judgement: 'PASS' | 'FAIL' | 'PENDING'
}

/**
 * NEW CALCULATION LOGIC
 * 
 * Step 1: Cargo = (weight / 1000) * 950
 * Step 2: USD with card = usd_price * 1.02
 * Step 3: INR buying = USD_with_card * 82
 * Step 4: Commission = inr_sold * 0.25
 * Step 5: INR Purchase = INR_buying + cargo + commission + packing
 * Step 6: Profit = inr_sold - inr_purchase
 * Step 7: Judgement = profit > 0 ? PASS : FAIL
 */
export function calculateProductValues(
  product: ProductCalculationInput,
  constants: CalculationConstants
): CalculationResult {
  const usdPrice = parseFloat(String(product.usd_price)) || 0
  const weight = parseFloat(String(product.product_weight)) || 0
  const inrSold = parseFloat(String(product.inr_sold)) || 0

  // Check if all required values are present
  if (usdPrice <= 0 || weight <= 0 || inrSold <= 0) {
    return {
      purchase_rate_inr: 0,
      cargo_charge: 0,
      final_purchase_rate: 0,
      india_price: 0,
      judgement: 'PENDING'
    }
  }

  const dollarRate = constants.dollar_rate
  const cardConversion = constants.card_conversion_rate
  const cargoRate = constants.cargo_rate_per_kg
  const commissionRate = constants.commission_rate
  const packingCost = constants.packing_cost

  // Step 1: Cargo
  const cargoCharge = (weight / 1000) * cargoRate

  // Step 2 & 3: USD with card fee → INR buying cost
  const usdWithCard = usdPrice * (1 + cardConversion)
  const purchaseRateINR = usdWithCard * dollarRate

  // Step 4: Commission
  const commission = inrSold * commissionRate

  // Step 5: INR Purchase (total cost)
  const finalPurchaseRate = purchaseRateINR + cargoCharge + commission + packingCost

  // Step 6: Profit
  const profit = inrSold - finalPurchaseRate

  // Step 7: Judgement
  const judgement = profit > 0 ? 'PASS' : 'FAIL'

  return {
    purchase_rate_inr: parseFloat(purchaseRateINR.toFixed(2)),
    cargo_charge: parseFloat(cargoCharge.toFixed(2)),
    final_purchase_rate: parseFloat(finalPurchaseRate.toFixed(2)),
    india_price: parseFloat(finalPurchaseRate.toFixed(2)),
    judgement
  }
}

export function getDefaultConstants(): CalculationConstants {
  return {
    dollar_rate: 82.00,
    card_conversion_rate: 0.02,
    cargo_rate_per_kg: 950.00,
    commission_rate: 0.25,
    packing_cost: 10.00
  }
}
