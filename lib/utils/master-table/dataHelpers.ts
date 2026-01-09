import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Normalize raw uploaded data for DB insertion
 */
const toSafeString = (value: any): string | null => {
    if (value === null || value === undefined) return null
    return String(value).trim() || null
}

export const normalizeDataForDB = (rows: any[]) => {
    return rows
        .filter((row) => row.asin)
        .map((row) => ({
            asin: toSafeString(row.asin),
            link: toSafeString(row.link),
            product_name: toSafeString(row.product_name),
            brand: toSafeString(row.brand),
            seller: toSafeString(row.seller),
            category: toSafeString(row.category),
            dimensions: toSafeString(row.dimensions),
            weight: toSafeString(row.weight),

            price:
                row.price !== undefined && row.price !== ''
                    ? Number(row.price)
                    : null,

            monthly_unit:
                row.monthly_unit !== undefined && row.monthly_unit !== ''
                    ? Number(row.monthly_unit)
                    : null,

            monthly_sales:
                row.monthly_sales !== undefined && row.monthly_sales !== ''
                    ? Number(row.monthly_sales)
                    : null,

            bsr:
                row.bsr !== undefined && row.bsr !== ''
                    ? Number(row.bsr)
                    : null,

            created_at: new Date().toISOString(),
        }))
}

/**
 * Filter out duplicate ASINs already present in DB
 */
export const filterDuplicateASINs = async (
    data: any[],
    tableName: string,
    supabase: SupabaseClient
) => {
    const asins = data.map((item) => item.asin)

    const { data: existing, error } = await supabase
        .from(tableName)
        .select('asin')
        .in('asin', asins)

    if (error) throw error

    const existingSet = new Set(existing.map((e) => e.asin))

    const newProducts = data.filter(
        (item) => !existingSet.has(item.asin)
    )

    return {
        newProducts,
        duplicateCount: data.length - newProducts.length,
    }
}
