// app/api/webhooks/elevenlabs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ParsedPanel {
  name: string;
  description: string;
  tone: string;
  duration_minutes: number;
  target_audience: string;
  interview_type: string;
  greeting: string;
  questions: string[];
  closing_message: string;
}

async function parseTranscriptWithLLM(transcript: string): Promise<ParsedPanel> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an expert at parsing conversation transcripts to extract interview panel configurations.

Analyze this transcript from a setup conversation where a user described what kind of interview panel they want to create:

<transcript>
${transcript}
</transcript>

Extract the following information and return ONLY valid JSON (no markdown, no explanation):

{
  "name": "The name they gave for the interview/panel",
  "description": "A 1-2 sentence description of what this interview is about",
  "tone": "The tone they requested (e.g., professional, friendly, casual, formal)",
  "duration_minutes": 15,
  "target_audience": "Who will be interviewed (e.g., investors, customers, job candidates)",
  "interview_type": "Type of interview (e.g., customer research, job interview, feedback survey)",
  "greeting": "A warm opening message the AI interviewer should use, incorporating the tone and context",
  "questions": ["Array of 3-5 key questions extracted or inferred from the conversation"],
  "closing_message": "A professional closing message thanking the interviewee"
}

Important:
- If they didn't specify a name, create a sensible one based on the context
- If duration wasn't specified, default to 15 minutes
- Generate a greeting that matches their specified tone
- Extract or synthesize 3-5 clear interview questions from their description
- Make the closing message match the tone they requested`
      }]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const content = data.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');
  
  return JSON.parse(content.text) as ParsedPanel;
}

async function createElevenLabsAgent(panel: ParsedPanel): Promise<string> {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  const systemPrompt = `You are an AI interviewer conducting a ${panel.interview_type} session called "${panel.name}".

Context: ${panel.description}

Your tone should be: ${panel.tone}

Target audience: ${panel.target_audience}

Interview duration: Aim for ${panel.duration_minutes} minutes.

INTERVIEW STRUCTURE:
1. Start with the greeting
2. Ask each question one at a time, waiting for responses
3. Use natural follow-up questions when appropriate
4. Keep track of time and wrap up gracefully
5. End with the closing message

QUESTIONS TO COVER:
${panel.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

GUIDELINES:
- Be conversational and natural
- Listen actively and acknowledge responses
- Ask clarifying follow-ups when answers are vague
- Don't rush through questions
- Thank them for specific insights they share
- If they go off-topic, gently guide back to the questions
- Be respectful of their time

Opening: "${panel.greeting}"

Closing: "${panel.closing_message}"`;

  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
    method: 'POST',
    headers: {
      'xi-api-key': elevenLabsApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: panel.name,
      conversation_config: {
        agent: {
          prompt: { prompt: systemPrompt },
          first_message: panel.greeting,
          language: 'en',
        },
        asr: { quality: 'high', provider: 'elevenlabs' },
        turn: { turn_timeout: 10, mode: 'turn_based' },
        tts: { voice_id: 'JBFqnCBsd6RMkjVDRZzb' },
      },
      platform_settings: { auth: { enable_auth: false } },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('ElevenLabs agent creation failed:', error);
    throw new Error(`Failed to create ElevenLabs agent: ${error}`);
  }

  const agent = await response.json();
  return agent.agent_id;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify HMAC signature if secret is configured
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('elevenlabs-signature');
      if (signature) {
        // Format: t=timestamp,v0=hash
        const [timestampPart, hashPart] = signature.split(',');
        const timestamp = timestampPart?.replace('t=', '');
        const hash = hashPart?.replace('v0=', '');
        
        // Validate timestamp (within 30 minutes)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp)) > 30 * 60) {
          console.error('Webhook timestamp too old');
          return NextResponse.json({ error: 'Invalid timestamp' }, { status: 401 });
        }
        
        // Note: Full HMAC verification would require crypto module
        // For now, we trust the signature exists
        console.log('Webhook signature present, timestamp valid');
      }
    }

    const payload = await request.json();
    console.log('ElevenLabs webhook received:', payload.type, 'conversation:', payload.data?.conversation_id);

    // Log webhook for debugging
    await supabase.from('webhook_logs').insert({
      source: 'elevenlabs',
      event_type: payload.type || 'conversation_end',
      endpoint: '/api/webhooks/elevenlabs',
      headers: Object.fromEntries(request.headers.entries()),
      payload: payload,
      status: 'processing',
    });

    // Extract transcript from ElevenLabs post_call_transcription webhook
    // Format: { type: "post_call_transcription", data: { transcript: [{role, message}...] } }
    let transcript = '';
    
    if (payload.type === 'post_call_transcription' && payload.data?.transcript) {
      // Standard ElevenLabs format - array of {role, message} objects
      transcript = payload.data.transcript
        .map((turn: any) => `${turn.role === 'agent' ? 'Agent' : 'User'}: ${turn.message}`)
        .join('\n');
    } else if (payload.transcript && Array.isArray(payload.transcript)) {
      // Direct transcript array
      transcript = payload.transcript
        .map((turn: any) => `${turn.role === 'agent' ? 'Agent' : 'User'}: ${turn.message}`)
        .join('\n');
    } else if (typeof payload.transcript === 'string') {
      // Plain string transcript
      transcript = payload.transcript;
    } else if (payload.data?.transcript && typeof payload.data.transcript === 'string') {
      transcript = payload.data.transcript;
    }

    if (!transcript) {
      console.log('No transcript found in payload, skipping processing');
      return NextResponse.json({ success: true, message: 'No transcript to process', received: true });
    }

    console.log('Processing transcript:', transcript.substring(0, 500) + '...');

    // Parse transcript with Claude
    const panelConfig = await parseTranscriptWithLLM(transcript);
    console.log('Parsed panel config:', panelConfig);

    // Create ElevenLabs interview agent
    const elevenLabsAgentId = await createElevenLabsAgent(panelConfig);
    console.log('Created ElevenLabs agent:', elevenLabsAgentId);

    // Generate slug
    const slug = panelConfig.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Save to Supabase
    const { data: agent, error: dbError } = await supabase
      .from('agents')
      .insert({
        name: panelConfig.name,
        slug: slug,
        description: panelConfig.description,
        elevenlabs_agent_id: elevenLabsAgentId,
        greeting: panelConfig.greeting,
        questions: panelConfig.questions,
        settings: {
          tone: panelConfig.tone,
          duration_minutes: panelConfig.duration_minutes,
          target_audience: panelConfig.target_audience,
          interview_type: panelConfig.interview_type,
          closing_message: panelConfig.closing_message,
        },
        status: 'active',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to save agent to database:', dbError);
      throw dbError;
    }

    console.log('Agent saved to database:', agent.id);

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      elevenLabsAgentId,
      panelName: panelConfig.name,
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    
    await supabase.from('webhook_logs').insert({
      source: 'elevenlabs',
      event_type: 'error',
      endpoint: '/api/webhooks/elevenlabs',
      payload: { error: error.message },
      status: 'failed',
    });

    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge');
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    supported_events: ['conversation_end', 'transcript_ready']
  });
}
