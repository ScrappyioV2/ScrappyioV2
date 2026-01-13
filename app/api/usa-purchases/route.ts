import { supabase } from '@/lib/supabaseClient';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch purchases by status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase.from('usa_purchases').select('*').order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }
}

// POST - Create new purchase from validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passFileData, purchaseData } = body;

    // 1. Insert into usa_purchases
    const { data: purchaseRecord, error: purchaseError } = await supabase
      .from('usa_purchases')
      .insert({
        asin: passFileData.asin,
        product_link: purchaseData.product_link,
        product_name: passFileData.product_name,
        target_price: purchaseData.target_price,
        target_quantity: purchaseData.target_quantity,
        funnel_quantity: purchaseData.funnel_quantity,
        funnel_seller: purchaseData.funnel_seller,
        buying_price: purchaseData.buying_price,
        buying_quantity: purchaseData.buying_quantity,
        seller_link: purchaseData.seller_link,
        seller_phone: purchaseData.seller_phone,
        payment_method: purchaseData.payment_method,
        origin_india: passFileData.origin_india,
        origin_china: passFileData.origin_china,
        status: 'sent_to_admin',
        sent_to_admin_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // 2. Insert into usa_admin_validation
    const { error: adminError } = await supabase.from('usa_admin_validation').insert({
      purchase_id: purchaseRecord.id,
      asin: passFileData.asin,
      product_link: purchaseData.product_link,
      product_name: passFileData.product_name,
      target_price: purchaseData.target_price,
      target_quantity: purchaseData.target_quantity,
      funnel_quantity: purchaseData.funnel_quantity,
      funnel_seller: purchaseData.funnel_seller,
      buying_price: purchaseData.buying_price,
      buying_quantity: purchaseData.buying_quantity,
      seller_link: purchaseData.seller_link,
      seller_phone: purchaseData.seller_phone,
      payment_method: purchaseData.payment_method,
      origin_india: passFileData.origin_india,
      origin_china: passFileData.origin_china,
      admin_status: 'pending',
    });

    if (adminError) throw adminError;

    // 3. Update pass_file to mark as sent
    const { error: updateError } = await supabase
      .from('usa_validation_pass_file')
      .update({ sent_to_admin: true })
      .eq('id', passFileData.id);

    if (updateError) throw updateError;

    return NextResponse.json({ data: purchaseRecord, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }
}

// PATCH - Update purchase
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    const { data, error } = await supabase.from('usa_purchases').update(updates).eq('id', id).select().single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete purchase
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw new Error('Purchase ID is required');

    const { error } = await supabase.from('usa_purchases').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, error: null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
