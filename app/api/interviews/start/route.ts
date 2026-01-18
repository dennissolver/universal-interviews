// app/api/interviews/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  const { panelId } = await req.json();

  if (!panelId) {
    return NextResponse.json(
      { error: 'panelId required' },
      { status: 400 }
    );
  }

  // Verify panel exists and get its elevenlabs_agent_id
  const { data: panel, error: panelError } = await supabase
    .from('agents')
    .select('id, elevenlabs_agent_id')
    .eq('id', panelId)
    .single();

  if (panelError || !panel) {
    console.error('Panel not found:', panelError);
    return NextResponse.json({ error: 'Panel not found' }, { status: 404 });
  }

  if (!panel.elevenlabs_agent_id) {
    console.error('Panel has no ElevenLabs agent configured');
    return NextResponse.json({ error: 'Panel not configured' }, { status: 400 });
  }

  // Create interview record (only using columns that exist in the table)
  const { data, error } = await supabase
    .from('interviews')
    .insert({
      panel_id: panelId,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create interview:', error);
    return NextResponse.json({ error: 'Failed to start interview' }, { status: 500 });
  }

  return NextResponse.json({
    interviewId: data.id,
    elevenlabsAgentId: panel.elevenlabs_agent_id
  });
}

