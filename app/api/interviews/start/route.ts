import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { panelId, intervieweeId, elevenlabsAgentId } = body;

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
        interviewee_id: intervieweeId ?? null,
        elevenlabs_agent_id: elevenlabsAgentId,
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      interviewId: data.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to start interview' },
      { status: 500 }
    );
  }
}
