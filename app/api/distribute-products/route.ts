import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { determineCategory, generateAmazonLink } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars:', { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    } // ✅ THIS CLOSING BRACE WAS MISSING!

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sellerId } = await request.json();

    if (!sellerId || ![1, 2, 3].includes(sellerId)) {
      return NextResponse.json(
        { error: 'Invalid seller ID' },
        { status: 400 }
      );
    }

    // Fetch products from unified seller_products table (brand_checking stage)
    const { data: products, error: fetchError } = await supabase
      .from('seller_products')
      .select('*')
      .eq('marketplace', 'usa')
      .eq('seller_id', sellerId)
      .eq('product_status', 'brand_checking');

    if (fetchError) throw fetchError;

    if (!products || products.length === 0) {
      return NextResponse.json({ message: 'No products to distribute' });
    }

    let distributed = { high_demand: 0, low_demand: 0, dropshipping: 0 };

    // Distribute products based on monthly_unit
    for (const product of products) {
      const { category, funnel } = determineCategory(product.monthly_unit);

      // Update the row's product_status to the target category in the unified table
      const { error: updateError } = await supabase
        .from('seller_products')
        .update({
          product_status: category,
          funnel: funnel,
          amz_link: generateAmazonLink(product.asin),
          working: false,
        })
        .eq('id', product.id);

      if (!updateError) {
        distributed[category]++;
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
