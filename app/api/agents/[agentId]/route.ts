// app/api/agents/[agentId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  const { agentId } = params;
  
  // Try by UUID first, then by slug
  let data, error;
  
  // Check if it looks like a UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
  
  if (isUUID) {
    ({ data, error } = await supabase.from('agents').select('*').eq('id', agentId).single());
  } else {
    ({ data, error } = await supabase.from('agents').select('*').eq('slug', agentId).single());
  }
  
  if (error || !data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  return NextResponse.json({ agent: data });
}
