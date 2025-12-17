// app/api/invites/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const { data, error } = await supabase.from('interviewees').select('id, name, email, status').eq('invite_token', token).single();
  if (error || !data) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  return NextResponse.json({ intervieweeId: data.id, name: data.name, status: data.status });
}