import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractParticipantDetails } from '@/app/lib/interviews/extractParticipant';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * ElevenLabs Webhook
 *
 * Responsibilities:
 * 1. Receive post_call_transcription events
 * 2. Locate the ACTIVE interview created at interview start
 * 3. Persist the FULL transcript JSON
 * 4. Extract + persist participant details
 * 5. Mark interview as completed
 * 6. Be idempotent
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // -------------------------------------------------------------
    // Only handle transcript completion events
    // -------------------------------------------------------------
    if (payload.type !== 'post_call_transcription') {
      return NextResponse.json({ status: 'ignored', reason: 'unsupported_event' });
    }

    const agentId =
      payload.agent_id ?? payload.data?.agent_id ?? null;

    const conversationId =
      payload.conversation_id ?? payload.data?.conversation_id ?? null;

    const transcript =
      payload.transcript ??
      payload.data?.transcript ??
      null;

    if (!agentId || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({
        status: 'ignored',
        reason: 'missing_agent_or_transcript',
      });
    }

    // -------------------------------------------------------------
    // 1️⃣ Find ACTIVE interview
    // -------------------------------------------------------------
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('id')
      .eq('elevenlabs_agent_id', agentId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (interviewError || !interview) {
      console.error('No active interview found for agent:', agentId);
      return NextResponse.json({
        status: 'ignored',
        reason: 'no_active_interview',
      });
    }

    // -------------------------------------------------------------
    // 2️⃣ Idempotency check
    // -------------------------------------------------------------
    const { data: existing } = await supabase
      .from('interview_transcripts')
      .select('id')
      .eq('interview_id', interview.id)
      .single();

    if (existing) {
      return NextResponse.json({
        status: 'duplicate',
        interviewId: interview.id,
      });
    }

    // -------------------------------------------------------------
    // 3️⃣ Extract participant details from transcript
    // -------------------------------------------------------------
    const participant = extractParticipantDetails(transcript);

    // -------------------------------------------------------------
    // 4️⃣ Persist transcript
    // -------------------------------------------------------------
    await supabase.from('interview_transcripts').insert({
      interview_id: interview.id,
      elevenlabs_conversation_id: conversationId,
      elevenlabs_agent_id: agentId,
      transcript,
      analysis: payload.analysis ?? payload.data?.analysis ?? null,
      metadata: payload.metadata ?? payload.data?.metadata ?? null,
      status: 'completed',
      received_at: new Date().toISOString(),
    });

    // -------------------------------------------------------------
    // 5️⃣ Mark interview completed + persist participant fields
    // -------------------------------------------------------------
    await supabase
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        participant_name: participant.name,
        participant_company: participant.company,
        participant_country: participant.country,
        participant_investment_stage: participant.stage,
        participant_sectors: participant.sectors,
      })
      .eq('id', interview.id);

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      transcriptTurns: transcript.length,
    });
  } catch (err: any) {
    console.error('ElevenLabs webhook error:', err);
    return NextResponse.json(
      { error: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'elevenlabs-webhook',
  });
}
