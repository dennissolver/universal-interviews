/*
// app/api/webhooks/elevenlabs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sandra's setup agent ID
const SETUP_AGENT_ID = process.env.ELEVENLABS_SETUP_AGENT_ID || 'agent_8101kcn42dk7ec0va4pvzg5f0b90';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('ElevenLabs webhook received:', JSON.stringify(payload, null, 2));

    const eventType = payload.type || payload.event_type || 'unknown';
    const data = payload.data || payload;
    const conversation_id = data.conversation_id || payload.conversation_id;
    const agent_id = data.agent_id;

    if (!conversation_id) {
      console.log('Webhook without conversation_id, event:', eventType);
      return NextResponse.json({ success: true, message: 'Acknowledged' });
    }

    // Route based on agent type
    if (agent_id === SETUP_AGENT_ID) {
      return handleSetupConversation(data, conversation_id);
    } else {
      return handleInterviewTranscript(data, conversation_id);
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// ============================================================================
// SETUP CONVERSATIONS (Sandra - Panel Creation)
// ============================================================================
async function handleSetupConversation(data: any, conversation_id: string) {
  console.log('Processing SETUP conversation:', conversation_id);

  const { agent_id, status, transcript, analysis, metadata } = data;
  const transcriptText = formatTranscript(transcript);

  const { error } = await supabase
    .from('setup_conversations')
    .upsert({
      elevenlabs_conversation_id: conversation_id,
      elevenlabs_agent_id: agent_id,
      transcript_text: transcriptText,
      transcript_json: transcript,
      analysis,
      metadata,
      status,
      call_duration_seconds: metadata?.call_duration_secs,
      conversation_started_at: metadata?.start_time_unix_secs
        ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
        : null,
    }, { onConflict: 'elevenlabs_conversation_id' });

  if (error) {
    console.error('Failed to store setup conversation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('Setup conversation stored:', conversation_id);
  return NextResponse.json({ success: true, type: 'setup', conversation_id });
}

// ============================================================================
// INTERVIEW TRANSCRIPTS
// ============================================================================
async function handleInterviewTranscript(data: any, conversation_id: string) {
  console.log('Processing INTERVIEW transcript:', conversation_id);

  const { agent_id, status, transcript, analysis, metadata } = data;

  // Try to find interview by conversation_id first (if frontend linked it)
  let interview = await findInterviewByConversationId(conversation_id);

  // Fallback: find most recent unlinked interview for this agent
  if (!interview) {
    console.log('No direct link found, trying fallback match...');
    interview = await findInterviewByAgentFallback(agent_id);

    // Link the conversation_id if we found via fallback
    if (interview) {
      console.log('Fallback match found, linking interview:', interview.id);
      await supabase
        .from('interviews')
        .update({ elevenlabs_conversation_id: conversation_id })
        .eq('id', interview.id);
    }
  }

  const transcriptText = formatTranscript(transcript);
  const participant = extractParticipantInfo(transcript);
  const wordCount = transcriptText?.split(/\s+/).length || 0;

  const { error } = await supabase
    .from('interview_transcripts')
    .upsert({
      elevenlabs_conversation_id: conversation_id,
      elevenlabs_agent_id: agent_id,
      interview_id: interview?.id || null,
      panel_id: interview?.panel_id || null,
      interviewee_id: interview?.interviewee_id || null,

      // Participant info extracted from conversation
      participant_name: participant.name,
      participant_company: participant.company,

      // Transcript data
      transcript_text: transcriptText,
      transcript: transcript,  // JSONB column
      analysis,
      summary: analysis?.transcript_summary || null,

      // Metadata
      metadata,
      status,
      call_duration_seconds: metadata?.call_duration_secs,
      word_count: wordCount,
      conversation_started_at: metadata?.start_time_unix_secs
        ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
        : null,
    }, { onConflict: 'elevenlabs_conversation_id' });

  if (error) {
    console.error('Failed to store interview transcript:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update interview record if found
  if (interview?.id) {
    await supabase
      .from('interviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        transcript: transcriptText,
        transcript_received: true,
        participant_name: participant.name,
        participant_company: participant.company,
        duration_seconds: metadata?.call_duration_secs,
      })
      .eq('id', interview.id);

    // Update interviewee status if exists
    if (interview.interviewee_id) {
      await supabase
        .from('interviewees')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', interview.interviewee_id);
    }
  }

  console.log('Interview transcript stored:', {
    conversation_id,
    interview_id: interview?.id,
    participant: participant.name,
    word_count: wordCount
  });

  return NextResponse.json({
    success: true,
    type: 'interview',
    conversation_id,
    interview_id: interview?.id,
    linked: !!interview
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findInterviewByConversationId(conversation_id: string) {
  const { data } = await supabase
    .from('interviews')
    .select('id, panel_id, interviewee_id')
    .eq('elevenlabs_conversation_id', conversation_id)
    .single();
  return data;
}

async function findInterviewByAgentFallback(agent_id: string) {
  // Find most recent unlinked interview for this agent (within last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('interviews')
    .select('id, panel_id, interviewee_id')
    .eq('elevenlabs_agent_id', agent_id)
    .is('elevenlabs_conversation_id', null)
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

function formatTranscript(transcript: any): string {
  if (!transcript) return '';

  if (Array.isArray(transcript)) {
    return transcript
      .filter((t: any) => t.message) // Skip null messages
      .map((t: any) => `${t.role}: ${t.message}`)
      .join('\n\n');
  }

  if (typeof transcript === 'string') {
    return transcript;
  }

  return '';
}

function extractParticipantInfo(transcript: any): { name: string | null; company: string | null } {
  if (!Array.isArray(transcript)) {
    return { name: null, company: null };
  }

  let name: string | null = null;
  let company: string | null = null;

  // Look through first few exchanges for name/company
  for (let i = 0; i < Math.min(transcript.length, 10); i++) {
    const turn = transcript[i];
    if (turn.role !== 'user' || !turn.message) continue;

    const msg = turn.message.toLowerCase();
    const originalMsg = turn.message;

    // Check if previous agent message asked for name
    if (i > 0) {
      const prevAgent = transcript[i - 1];
      if (prevAgent?.role === 'agent' && prevAgent?.message) {
        const agentMsg = prevAgent.message.toLowerCase();

        // Name detection
        if (agentMsg.includes('your name') || agentMsg.includes('telling me your name')) {
          // Extract first word or full short response as name
          const words = originalMsg.replace(/[.,!?]/g, '').trim().split(/\s+/);
          if (words.length <= 3) {
            name = originalMsg.replace(/[.,!?]/g, '').trim();
          } else {
            name = words[0];
          }
        }

        // Company detection
        if (agentMsg.includes('company') || agentMsg.includes('joining us from')) {
          // Look for company name in response
          if (!msg.includes('individual') && !msg.includes('myself')) {
            const companyMatch = originalMsg.match(/(?:called|from|with|at)\s+([A-Z][A-Za-z0-9\s]+)/i);
            if (companyMatch) {
              company = companyMatch[1].trim();
            } else if (originalMsg.length < 50) {
              company = originalMsg.replace(/[.,!?]/g, '').trim();
            }
          }
        }
      }
    }
  }

  return { name, company };
}

export async function GET() {
  return NextResponse.json({
    status: 'ElevenLabs webhook endpoint active',
    setup_agent_id: SETUP_AGENT_ID
  });
}*/

// app/api/webhooks/elevenlabs/route.ts
import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Sandra's setup agent ID
const SETUP_AGENT_ID = process.env.ELEVENLABS_SETUP_AGENT_ID || 'agent_8101kcn42dk7ec0va4pvzg5f0b90';

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const payload = await request.json();
        console.log('ElevenLabs webhook received:', JSON.stringify(payload, null, 2));

        const eventType: string = payload.type || payload.event_type || 'unknown';
        const data = payload.data || payload;
        const conversation_id: string = data.conversation_id || payload.conversation_id;
        const agent_id: string = data.agent_id;

        if (!conversation_id) {
            console.log('Webhook without conversation_id, event:', eventType);
            return NextResponse.json({success: true, message: 'Acknowledged'});
        }

        // Route based on agent type
        if (agent_id === SETUP_AGENT_ID) {
            return handleSetupConversation(data, conversation_id);
        } else {
            return handleInterviewTranscript(data, conversation_id);
        }

    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({error: 'Processing failed'}, {status: 500});
    }
}

// ============================================================================
// SETUP CONVERSATIONS (Sandra - Panel Creation)
// ============================================================================
async function handleSetupConversation(data: any, conversation_id: string): Promise<NextResponse> {
    console.log('Processing SETUP conversation:', conversation_id);

    const {agent_id, status, transcript, analysis, metadata} = data;
    const transcriptText: string = formatTranscript(transcript);

    const {error} = await supabase
        .from('setup_conversations')
        .upsert({
            elevenlabs_conversation_id: conversation_id,
            elevenlabs_agent_id: agent_id,
            transcript_text: transcriptText,
            transcript_json: transcript,
            analysis,
            metadata,
            status,
            call_duration_seconds: metadata?.call_duration_secs,
            conversation_started_at: metadata?.start_time_unix_secs
                ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
                : null,
        }, {onConflict: 'elevenlabs_conversation_id'});

    if (error) {
        console.error('Failed to store setup conversation:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }

    console.log('Setup conversation stored:', conversation_id);
    return NextResponse.json({success: true, type: 'setup', conversation_id});
}

// ============================================================================
// INTERVIEW TRANSCRIPTS
// ============================================================================
async function handleInterviewTranscript(data: any, conversation_id: string): Promise<NextResponse> {
    console.log('Processing INTERVIEW transcript:', conversation_id);

    const {agent_id, status, transcript, analysis, metadata} = data;

    // Try to find interview by conversation_id first (if frontend linked it)
    let interview = await findInterviewByConversationId(conversation_id);

    // Fallback: find most recent unlinked interview for this agent
    if (!interview) {
        console.log('No direct link found, trying fallback match...');
        interview = await findInterviewByAgentFallback(agent_id);

        // Link the conversation_id if we found via fallback
        if (interview) {
            console.log('Fallback match found, linking interview:', interview.id);
            await supabase
                .from('interviews')
                .update({elevenlabs_conversation_id: conversation_id})
                .eq('id', interview.id);
        }
    }

    const transcriptText: string = formatTranscript(transcript);
    const participant = extractParticipantInfo(transcript);
    const wordCount: number = transcriptText?.split(/\s+/).length || 0;

    const {error} = await supabase
        .from('interview_transcripts')
        .upsert({
            elevenlabs_conversation_id: conversation_id,
            elevenlabs_agent_id: agent_id,
            interview_id: interview?.id || null,
            panel_id: interview?.panel_id || null,
            interviewee_id: interview?.interviewee_id || null,

            // Participant info extracted from conversation
            participant_name: participant.name,
            participant_company: participant.company,

            // Transcript data
            transcript_text: transcriptText,
            transcript: transcript,  // JSONB column
            analysis,
            summary: analysis?.transcript_summary || null,

            // Metadata
            metadata,
            status,
            call_duration_seconds: metadata?.call_duration_secs,
            word_count: wordCount,
            conversation_started_at: metadata?.start_time_unix_secs
                ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
                : null,
        }, {onConflict: 'elevenlabs_conversation_id'});

    if (error) {
        console.error('Failed to store interview transcript:', error);
        return NextResponse.json({error: error.message}, {status: 500});
    }

    // Update interview record if found
    if (interview?.id) {
        await supabase
            .from('interviews')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                transcript: transcriptText,
                transcript_received: true,
                participant_name: participant.name,
                participant_company: participant.company,
                duration_seconds: metadata?.call_duration_secs,
            })
            .eq('id', interview.id);

        // Update interviewee status if exists
        if (interview.interviewee_id) {
            await supabase
                .from('interviewees')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', interview.interviewee_id);
        }
    }

    console.log('Interview transcript stored:', {
        conversation_id,
        interview_id: interview?.id,
        participant: participant.name,
        word_count: wordCount
    });

    return NextResponse.json({
        success: true,
        type: 'interview',
        conversation_id,
        interview_id: interview?.id,
        linked: !!interview
    });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findInterviewByConversationId(conversation_id: string): Promise<any | null> {
    const {data} = await supabase
        .from('interviews')
        .select('id, panel_id, interviewee_id')
        .eq('elevenlabs_conversation_id', conversation_id)
        .single();
    return data;
}

async function findInterviewByAgentFallback(agent_id: string): Promise<any | null> {
    // Find most recent unlinked interview for this agent (within last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const {data} = await supabase
        .from('interviews')
        .select('id, panel_id, interviewee_id')
        .eq('elevenlabs_agent_id', agent_id)
        .is('elevenlabs_conversation_id', null)
        .gte('created_at', twoHoursAgo)
        .order('created_at', {ascending: false})
        .limit(1)
        .single();

    return data;
}

function formatTranscript(transcript: any): string {
    if (!transcript) return '';

    if (Array.isArray(transcript)) {
        return transcript
            .filter((t: any) => t.message) // Skip null messages
            .map((t: any) => `${t.role}: ${t.message}`)
            .join('\n\n');
    }

    if (typeof transcript === 'string') {
        return transcript;
    }

    return '';
}

function extractParticipantInfo(transcript: any): { name: string | null; company: string | null } {
    if (!Array.isArray(transcript)) {
        return {name: null, company: null};
    }

    let name: string | null = null;
    let company: string | null = null;

    // Look through first few exchanges for name/company
    for (let i = 0; i < Math.min(transcript.length, 10); i++) {
        const turn = transcript[i];
        if (turn.role !== 'user' || !turn.message) continue;

        const msg = turn.message.toLowerCase();
        const originalMsg = turn.message;

        // Check if previous agent message asked for name
        if (i > 0) {
            const prevAgent = transcript[i - 1];
            if (prevAgent?.role === 'agent' && prevAgent?.message) {
                const agentMsg = prevAgent.message.toLowerCase();

                // Name detection
                if (agentMsg.includes('your name') || agentMsg.includes('telling me your name')) {
                    // Extract first word or full short response as name
                    const words = originalMsg.replace(/[.,!?]/g, '').trim().split(/\s+/);
                    if (words.length <= 3) {
                        name = originalMsg.replace(/[.,!?]/g, '').trim();
                    } else {
                        name = words[0];
                    }
                }

                // Company detection
                if (agentMsg.includes('company') || agentMsg.includes('joining us from')) {
                    // Look for company name in response
                    if (!msg.includes('individual') && !msg.includes('myself')) {
                        const companyMatch = originalMsg.match(/(?:called|from|with|at)\s+([A-Z][A-Za-z0-9\s]+)/i);
                        if (companyMatch) {
                            company = companyMatch[1].trim();
                        } else if (originalMsg.length < 50) {
                            company = originalMsg.replace(/[.,!?]/g, '').trim();
                        }
                    }
                }
            }
        }
    }

    return {name, company};
}

export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        status: 'ElevenLabs webhook endpoint active',
        setup_agent_id: SETUP_AGENT_ID
    });
}