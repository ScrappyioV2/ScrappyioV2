import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { products } = await request.json();

        const { data, error } = await supabase.rpc(
            'bulk_insert_india_master_with_distribution',
            { batch_data: products }
        );

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // ✅ Production returns JSON not array
        return NextResponse.json({
            success: true,
            inserted: data.inserted_count || 0,
            updated: 0
        });

    } catch (error: any) {
        console.error('API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
