// app/api/invites/update-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { intervieweeId, status } = await request.json();
    if (!intervieweeId || !status) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    const updates: any = { status };
    if (status === 'started') updates.started_at = new Date().toISOString();
    else if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from('interviewees').update(updates).eq('id', intervieweeId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}