import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { interviewId: string } }
) {
  const { interviewId } = params;

  const { data: interview, error } = await supabase
    .from('interviews')
    .select(
      `
      participant_name,
      participant_company,
      participant_country,
      participant_investment_stage,
      participant_sectors
    `
    )
    .eq('id', interviewId)
    .single();

  if (error || !interview) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: transcriptRow } = await supabase
    .from('interview_transcripts')
    .select('transcript')
    .eq('interview_id', interviewId)
    .single();

  return NextResponse.json({
    ...interview,
    transcript: transcriptRow?.transcript ?? [],
  });
}
