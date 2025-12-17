import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * 3. Persist the FULL transcript JSON (single row)
 * 4. Attach analysis + metadata if present
 * 5. Mark interview as completed
 * 6. Be fully idempotent (safe on retries)
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // ---------------------------------------------------------------------
    // Only handle completed transcripts
    // ---------------------------------------------------------------------
    if (payload.type !== 'post_call_transcription') {
      return NextResponse.json({ status: 'ignored', reason: 'unsupported_event' });
    }

    const agentId = payload.agent_id;
    const conversationId = payload.conversation_id;
    const transcript = payload.transcript;

    if (!agentId || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({
        status: 'ignored',
        reason: 'missing_agent_or_transcript',
      });
    }

    // ---------------------------------------------------------------------
    // 1️⃣ Find the ACTIVE interview created on "Start Interview"
    // ---------------------------------------------------------------------
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

    // ---------------------------------------------------------------------
    // 2️⃣ Idempotency: do not re-insert transcript
    // ---------------------------------------------------------------------
    const { data: existingTranscript } = await supabase
      .from('interview_transcripts')
      .select('id')
      .eq('interview_id', interview.id)
      .single();

    if (existingTranscript) {
      return NextResponse.json({
        status: 'duplicate',
        interviewId: interview.id,
      });
    }

    // ---------------------------------------------------------------------
    // 3️⃣ Persist FULL transcript payload (JSONB)
    // ---------------------------------------------------------------------
    await supabase.from('interview_transcripts').insert({
      interview_id: interview.id,
      elevenlabs_conversation_id: conversationId ?? null,
      elevenlabs_agent_id: agentId,
      transcript: transcript,                 // FULL transcript array
      analysis: payload.analysis ?? null,      // optional
      metadata: payload.metadata ?? null,      // optional
      status: 'completed',
      received_at: new Date().toISOString(),
    });

    // ---------------------------------------------------------------------
    // 4️⃣ Mark interview as completed
    // ---------------------------------------------------------------------
    await supabase
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', interview.id);

    return NextResponse.json({
      success: true,
      interviewId: interview.id,
      turns: transcript.length,
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
