import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // ✅ FIX: Refresh session to extend expiry
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json({ session: null, error: error.message }, { status: 401 });
    }

    // ✅ FIX: If session exists, refresh it to prevent auto-logout
    if (session) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn("⚠️ Session refresh warning:", refreshError.message);
      }
    }

    return NextResponse.json({ session }, { status: 200 });
  } catch (error: any) {
    console.error('Session API error:', error);
    return NextResponse.json({ session: null, error: error.message }, { status: 500 });
  }
}



// import { createClient } from '@/lib/supabaseServer';
// import { NextResponse } from 'next/server';

// export const dynamic = 'force-dynamic';

// export async function GET() {
//   try {
//     const supabase = await createClient();
    
//     const {
//       data: { session },
//       error,
//     } = await supabase.auth.getSession();

//     if (error) {
//       return NextResponse.json({ session: null, error: error.message }, { status: 401 });
//     }

//     return NextResponse.json({ session }, { status: 200 });
//   } catch (error: any) {
//     console.error('Session API error:', error);
//     return NextResponse.json({ session: null, error: error.message }, { status: 500 });
//   }
// }
