/**
 * Automatic Calculation Engine for V2
 * Calculates judgement automatically when fields are filled
 */

export interface ProductCalculationInput {
    usd_price: number | null
    product_weight: number | null
    inr_sold: number | null
    inr_purchase: number | null
}

export interface CalculationConstants {
    dollar_rate: number
    card_conversion_rate: number
    cargo_rate_per_kg: number
    commission_rate: number
    packing_cost: number
}

export interface CalculationResult {
    purchase_rate_inr: number
    cargo_charge: number
    final_purchase_rate: number
    india_price: number
    judgement: 'PASS' | 'FAIL' | 'PENDING'
}

/**
 * Calculate all values automatically
 */
export function calculateProductValues(
    product: ProductCalculationInput,
    constants: CalculationConstants
): CalculationResult {
    const purchaseRateUSD = parseFloat(String(product.usd_price)) || 0
    const expectedWt = parseFloat(String(product.product_weight)) || 0
    const soldPriceINR = parseFloat(String(product.inr_sold)) || 0
    const inrPurchase = parseFloat(String(product.inr_purchase)) || 0

    // If all required values are present, calculate
    if (purchaseRateUSD > 0 && expectedWt > 0 && soldPriceINR > 0 && inrPurchase > 0) {
        const dollarRate = parseFloat(String(constants.dollar_rate)) || 82
        const cardConversionRate = parseFloat(String(constants.card_conversion_rate)) || 0.02
        const cargoRatePerKg = parseFloat(String(constants.cargo_rate_per_kg)) || 950
        const commissionRate = parseFloat(String(constants.commission_rate)) || 0.25
        const packingCost = parseFloat(String(constants.packing_cost)) || 10

        // A) Purchase Rate (INR) = Purchase Rate (USD) × Dollar Rate × (1 + Card Conversion Rate)
        const purchaseRateINR = purchaseRateUSD * dollarRate * (1 + cardConversionRate)

        // B) Cargo Charge = (Cargo Rate per KG / 1000) × Expected Weight
        const cargoCharge = (cargoRatePerKg / 1000) * expectedWt

        // C) Final Purchase Rate = Purchase Rate (INR) + Cargo Charge + Packing Cost + (Commission × Sold Price)
        const commission = commissionRate * soldPriceINR
        const finalPurchaseRate = purchaseRateINR + cargoCharge + packingCost + commission

        // D) India Price = same as INR Purchase (user-entered)
        const indiaPrice = finalPurchaseRate

        // E) Judgement = INR Sold > INR Purchase
        // E) Judgement = INR Sold > Final Purchase Rate (V1 logic)
        let judgement: 'PASS' | 'FAIL' | 'PENDING' = 'PENDING'

        if (purchaseRateUSD > 0 && expectedWt > 0 && soldPriceINR > 0) {
            judgement = soldPriceINR > finalPurchaseRate ? 'PASS' : 'FAIL'
        }


        return {
            purchase_rate_inr: parseFloat(purchaseRateINR.toFixed(2)),
            cargo_charge: parseFloat(cargoCharge.toFixed(2)),
            final_purchase_rate: parseFloat(finalPurchaseRate.toFixed(2)),
            india_price: parseFloat(finalPurchaseRate.toFixed(2)),
            judgement
        }

    }

    // Return pending if not all values present
    return {
        purchase_rate_inr: 0,
        cargo_charge: 0,
        final_purchase_rate: 0,
        india_price: inrPurchase,
        judgement: 'PENDING'
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
