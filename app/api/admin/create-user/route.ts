import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, full_name, role, allowed_pages } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (authError) throw authError;

    const { error: dbError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        email,
        full_name,
        role,
        allowed_pages: allowed_pages || [],
        is_active: true,
      });

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      user: { id: authData.user.id, email, full_name, role },
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Delete chat references first (FK constraints)
    await supabaseAdmin.from('chat_read_receipts').delete().eq('user_id', userId);
    await supabaseAdmin.from('chat_user_presence').delete().eq('user_id', userId);
    await supabaseAdmin.from('chat_messages').delete().eq('sender_id', userId);
    await supabaseAdmin.from('chat_participants').delete().eq('user_id', userId);
    await supabaseAdmin.from('chat_conversations').delete().eq('created_by', userId);

    // Delete from user_roles
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);

    // Delete from auth (now safe — no FK references)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete user' }, { status: 500 });
  }
}
