import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json({ session: null, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ session }, { status: 200 });
  } catch (error: any) {
    console.error('Session API error:', error);
    return NextResponse.json({ session: null, error: error.message }, { status: 500 });
  }
}
