import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { panelId, elevenlabsAgentId, intervieweeId } = await req.json();

  if (!panelId || !elevenlabsAgentId) {
    return NextResponse.json(
      { error: 'panelId and elevenlabsAgentId required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert({
      panel_id: panelId,
      elevenlabs_agent_id: elevenlabsAgentId,
      interviewee_id: intervieweeId ?? null,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create interview:', error);
    return NextResponse.json({ error: 'Failed to start interview' }, { status: 500 });
  }

  return NextResponse.json({ interviewId: data.id });
}
