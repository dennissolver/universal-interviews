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

    const {
      conversation_id,
      agent_id: elevenlabs_agent_id,
      status,
      transcript,
      analysis,
      metadata,
    } = payload;

    if (!conversation_id) {
      return NextResponse.json({ error: 'Missing conversation_id' }, { status: 400 });
    }

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

    // Store in transcripts table
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

      // Update interviewee status
      if (interview.interviewee_id) {
        await supabase
          .from('interviewees')
          .update({ status: 'completed' })
          .eq('id', interview.interviewee_id);
      }
    }

    console.log('Transcript stored successfully:', { conversation_id, interviewId: interview?.id });

    return NextResponse.json({
      success: true,
      stored: !!stored,
      interviewId: interview?.id
    });

  } catch (error) {
    console.error('ElevenLabs webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Handle GET for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'ElevenLabs webhook endpoint active' });
}