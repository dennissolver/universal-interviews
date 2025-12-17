// app/api/agents/[agentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  const { data, error } = await supabase.from('agents').select('*').eq('id', params.agentId).single();
  if (error || !data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  return NextResponse.json(data);
}