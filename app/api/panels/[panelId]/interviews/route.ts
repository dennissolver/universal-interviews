// app/api/panels/[panelId]/interviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  try {
    const panelId = params.panelId;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch interviews for this agent, ordered by most recent first
    const { data: interviews, error } = await supabase
      .from('interviews')
      .select(`
        id,
        status,
        interviewee_profile,
        started_at,
        completed_at,
        duration_seconds,
        sentiment_overall,
        word_count,
        messages,
        created_at
      `)
      .eq('agent_id', panelId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch interviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch interviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({ interviews: interviews || [] });
  } catch (error) {
    console.error('Interviews API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}