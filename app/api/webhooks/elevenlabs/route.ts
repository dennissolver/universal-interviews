// app/api/webhooks/elevenlabs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
async function handleSetupConversation(data: any, conversation_id: string): Promise<NextResponse> {
  console.log('Processing SETUP conversation:', conversation_id);

  const { agent_id, status, transcript, analysis, metadata } = data;
  const transcriptText: string = formatTranscript(transcript);

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
async function handleInterviewTranscript(data: any, conversation_id: string): Promise<NextResponse> {
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

  const transcriptText: string = formatTranscript(transcript);
  const participant = extractParticipantInfo(transcript);
  const wordCount: number = transcriptText?.split(/\s+/).length || 0;

  // Log extracted participant info for debugging
  console.log('Extracted participant info:', participant);

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
      participant_city: participant.city,

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
    participant_name: participant.name,
    participant_company: participant.company,
    participant_city: participant.city,
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
// DATABASE LOOKUP HELPERS
// ============================================================================

async function findInterviewByConversationId(conversation_id: string): Promise<any | null> {
  const { data } = await supabase
    .from('interviews')
    .select('id, panel_id, interviewee_id')
    .eq('elevenlabs_conversation_id', conversation_id)
    .single();
  return data;
}

async function findInterviewByAgentFallback(agent_id: string): Promise<any | null> {
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

// ============================================================================
// TRANSCRIPT FORMATTING
// ============================================================================

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

// ============================================================================
// PARTICIPANT INFO EXTRACTION (Improved)
// ============================================================================

interface ParticipantInfo {
  name: string | null;
  company: string | null;
  city: string | null;
}

function extractParticipantInfo(transcript: any): ParticipantInfo {
  if (!Array.isArray(transcript)) {
    return { name: null, company: null, city: null };
  }

  let name: string | null = null;
  let company: string | null = null;
  let city: string | null = null;

  // Look through the first exchanges for demographics
  for (let i = 1; i < Math.min(transcript.length, 15); i++) {
    const turn = transcript[i];
    if (turn.role !== 'user' || !turn.message) continue;

    const userResponse = turn.message.trim();

    // Skip very short or nonsense responses
    if (userResponse.length < 2) continue;

    // Check what the agent asked in the previous turn
    const prevTurn = transcript[i - 1];
    if (prevTurn?.role !== 'agent' || !prevTurn?.message) continue;

    const agentQuestion = prevTurn.message.toLowerCase();

    // ========== NAME DETECTION ==========
    if (!name && (
      agentQuestion.includes('your name') ||
      agentQuestion.includes('your full name') ||
      agentQuestion.includes('who am i speaking') ||
      agentQuestion.includes('may i get your') ||
      agentQuestion.includes('could i get your')
    )) {
      name = cleanName(userResponse);
    }

    // ========== COMPANY DETECTION ==========
    if (!company && (
      agentQuestion.includes('company') ||
      agentQuestion.includes('organization') ||
      agentQuestion.includes('organisation') ||
      agentQuestion.includes('where do you work') ||
      agentQuestion.includes('who are you with') ||
      agentQuestion.includes('what company') ||
      agentQuestion.includes('which company')
    )) {
      company = cleanCompany(userResponse);
    }

    // ========== CITY DETECTION ==========
    if (!city && (
      agentQuestion.includes('city') ||
      agentQuestion.includes('based in') ||
      agentQuestion.includes('located') ||
      agentQuestion.includes('where are you') ||
      agentQuestion.includes('location') ||
      agentQuestion.includes('what city')
    )) {
      city = cleanCity(userResponse);
    }

    // Early exit if we have all three
    if (name && company && city) break;
  }

  return { name, company, city };
}

// ============================================================================
// CLEANING HELPERS
// ============================================================================

function cleanName(response: string): string | null {
  let cleaned = response
    // Remove common greetings at the start
    .replace(/^(hi|hello|hey|g'day|good morning|good afternoon|good evening)[,.\s]*/i, '')
    // Remove "I'm", "My name is", etc.
    .replace(/^(i'm|i am|my name is|this is|it's|its)\s*/i, '')
    .replace(/^(you can call me|call me|they call me|people call me)\s*/i, '')
    // Remove "nice to meet you" and similar at the end
    .replace(/[,.\s]*(nice to meet you|pleased to meet you|thanks for having me).*$/i, '')
    // Remove trailing punctuation
    .replace(/[.,!?]+$/, '')
    .trim();

  // If still too long (probably not just a name), take first 2-3 words
  const words = cleaned.split(/\s+/);
  if (words.length > 4) {
    // Likely includes extra text - just take what looks like a name
    cleaned = words.slice(0, 3).join(' ');
  }

  // Validate: should be reasonable length
  if (cleaned.length < 2 || cleaned.length > 50) return null;

  // Filter out non-name responses
  const invalidResponses = ['hi', 'hello', 'hey', 'yes', 'no', 'sure', 'okay', 'ok', 'um', 'uh'];
  if (invalidResponses.includes(cleaned.toLowerCase())) return null;

  return cleaned || null;
}

function cleanCompany(response: string): string | null {
  const lowerResponse = response.toLowerCase();

  // Check for "no company" type responses
  if (
    lowerResponse.includes('individual') ||
    lowerResponse.includes('myself') ||
    lowerResponse.includes('self-employed') ||
    lowerResponse.includes('self employed') ||
    lowerResponse.includes('freelance') ||
    lowerResponse.includes('independent') ||
    lowerResponse.includes('consultant') ||
    lowerResponse.includes('n/a') ||
    lowerResponse.includes('none') ||
    lowerResponse.includes('no company') ||
    lowerResponse.includes("don't have a company") ||
    lowerResponse.includes("do not have a company") ||
    lowerResponse.includes('just me') ||
    lowerResponse.includes('my own')
  ) {
    return 'Independent/Self-employed';
  }

  let cleaned = response
    // Remove common prefixes
    .replace(/^(i work at|i work for|i work with|working at|working for)\s*/i, '')
    .replace(/^(i'm with|i am with|i'm at|i am at|i'm from|i am from)\s*/i, '')
    .replace(/^(we're|we are|it's|its|it is)\s*/i, '')
    .replace(/^(called|named)\s*/i, '')
    .replace(/^(a company called|an organization called|an organisation called)\s*/i, '')
    .replace(/^(the company is|the company's|my company is)\s*/i, '')
    // Remove trailing punctuation and common suffixes
    .replace(/[.,!?]+$/, '')
    .replace(/\s*(here|today|at the moment)$/i, '')
    .trim();

  // If response is too long, it's probably not just a company name
  if (cleaned.length > 100) return null;
  if (cleaned.length < 2) return null;

  // Filter out non-company responses
  const invalidResponses = ['yes', 'no', 'sure', 'okay', 'ok', 'um', 'uh', 'well'];
  if (invalidResponses.includes(cleaned.toLowerCase())) return null;

  return cleaned || null;
}

function cleanCity(response: string): string | null {
  let cleaned = response
    // Remove common prefixes
    .replace(/^(i'm in|i am in|i'm based in|i am based in)\s*/i, '')
    .replace(/^(i'm from|i am from|i live in|i'm living in|i am living in)\s*/i, '')
    .replace(/^(based in|located in|from|in)\s*/i, '')
    .replace(/^(it's|its|we're in|we are in)\s*/i, '')
    .replace(/^(currently in|right now in)\s*/i, '')
    // Remove trailing punctuation
    .replace(/[.,!?]+$/, '')
    .trim();

  // Extract just the city if they gave more (e.g., "Sydney, Australia" or "Sydney, NSW")
  const parts = cleaned.split(/[,]/);
  if (parts.length > 0) {
    cleaned = parts[0].trim();
  }

  // Validate
  if (cleaned.length < 2 || cleaned.length > 50) return null;

  // Filter out non-city responses
  const invalidResponses = ['yes', 'no', 'sure', 'okay', 'ok', 'um', 'uh', 'well', 'here'];
  if (invalidResponses.includes(cleaned.toLowerCase())) return null;

  return cleaned || null;
}

// ============================================================================
// GET ENDPOINT (Health Check)
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ElevenLabs webhook endpoint active',
    setup_agent_id: SETUP_AGENT_ID,
    version: '2.0.0',
    features: ['demographic_extraction', 'city_capture', 'improved_cleaning']
  });
}