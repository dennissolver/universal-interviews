// app/api/webhooks/elevenlabs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('ElevenLabs webhook received:', JSON.stringify(payload, null, 2));

    // Handle different event types from ElevenLabs
    const eventType = payload.type || payload.event_type || 'unknown';

    // Extract conversation_id from various possible locations
    const conversation_id = payload.conversation_id
      || payload.data?.conversation_id
      || payload.conversation?.conversation_id;

    // If no conversation_id, just acknowledge the webhook
    if (!conversation_id) {
      console.log('Webhook received without conversation_id, event type:', eventType);
      return NextResponse.json({ success: true, message: 'Event acknowledged', eventType });
    }

    const {
      agent_id: elevenlabs_agent_id,
      status,
      transcript,
      analysis,
      metadata,
    } = payload.data || payload;

    // Find the interview by elevenlabs_conversation_id
    const { data: interview } = await supabase
      .from('interviews')
      .select('id, agent_id, interviewee_id')
      .eq('elevenlabs_conversation_id', conversation_id)
      .single();

    // Format transcript text
    let transcriptText = '';
    if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map((t: any) => `${t.role}: ${t.message}`)
        .join('\n\n');
    } else if (typeof transcript === 'string') {
      transcriptText = transcript;
    }

    // Only store if we have transcript data
    if (transcriptText || transcript) {
      const { data: stored, error: storeError } = await supabase
        .from('transcripts')
        .upsert({
          elevenlabs_conversation_id: conversation_id,
          elevenlabs_agent_id,
          interview_id: interview?.id || null,
          agent_id: interview?.agent_id || null,
          interviewee_id: interview?.interviewee_id || null,
          transcript: transcriptText,
          transcript_json: transcript,
          analysis,
          metadata,
          status,
          received_at: new Date().toISOString(),
        }, {
          onConflict: 'elevenlabs_conversation_id'
        })
        .select()
        .single();

      if (storeError) {
        console.error('Failed to store transcript:', storeError);
      }

      // Update interview status if found
      if (interview?.id) {
        await supabase
          .from('interviews')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            transcript: transcriptText,
          })
          .eq('id', interview.id);

        if (interview.interviewee_id) {
          await supabase
            .from('interviewees')
            .update({ status: 'completed' })
            .eq('id', interview.interviewee_id);
        }
      }

      console.log('Transcript stored:', { conversation_id, interviewId: interview?.id });
    }

    return NextResponse.json({
      success: true,
      eventType,
      conversationId: conversation_id,
      interviewId: interview?.id
    });

  } catch (error) {
    console.error('ElevenLabs webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ElevenLabs webhook endpoint active' });
}