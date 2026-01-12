import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { determineCategory, generateAmazonLink } from '@/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { sellerId } = await request.json();

    if (!sellerId || ![1, 2, 3].includes(sellerId)) {
      return NextResponse.json(
        { error: 'Invalid seller ID' },
        { status: 400 }
      );
    }

    // Fetch products from brand checking table
    const { data: products, error: fetchError } = await supabase
      .from(`usa_brand_checking_seller_${sellerId}`)
      .select('*');

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No products to distribute' });
    }

    let distributed = { high_demand: 0, low_demand: 0, dropshipping: 0 };

    // Distribute products based on monthly_unit
    for (const product of products) {
      const { category, funnel } = determineCategory(product.monthly_unit);
      const targetTable = `usa_seller_${sellerId}_${category}`;

      // Prepare data with auto-generated AMZ link
      const dataToInsert = {
        asin: product.asin,
        product_name: product.product_name,
        brand: product.brand,
        funnel: funnel,
        monthly_unit: product.monthly_unit,
        product_link: product.link,
        amz_link: generateAmazonLink(product.asin),
        working: false,
      };

      // Insert into target category table
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(dataToInsert);

      if (!insertError) {
        distributed[category]++;
        
        // Delete from brand checking table
        await supabase
          .from(`usa_brand_checking_seller_${sellerId}`)
          .delete()
          .eq('id', product.id);
      }
    }

    return NextResponse.json({
      success: true,
      distributed,
      message: `Distributed ${products.length} products successfully`,
    });
  } catch (error: any) {
    console.error('Distribution error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
