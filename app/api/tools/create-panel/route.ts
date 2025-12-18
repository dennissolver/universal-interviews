import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------------------
    // Optional shared-secret protection (internal calls only)
    // ---------------------------------------------------------------------
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('X-Shared-Secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // ---------------------------------------------------------------------
    // Parse + validate request body
    // ---------------------------------------------------------------------
    const body = await request.json();

    const {
      name,
      description,
      interview_type,
      tone,
      greeting,
      questions,
      closing_message,
      target_audience,
      duration_minutes,
    } = body;

    if (!name || !interview_type) {
      return NextResponse.json(
        { error: 'Panel name and interview_type are required' },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------------------
    // Normalize questions
    // ---------------------------------------------------------------------
    let questionsList: string[] = [];

    if (Array.isArray(questions)) {
      questionsList = questions;
    } else if (typeof questions === 'string') {
      questionsList = questions
        .split(',')
        .map((q: string) => q.trim())
        .filter(Boolean);
    }

    if (questionsList.length === 0) {
      return NextResponse.json(
        { error: 'At least one interview question is required' },
        { status: 400 }
      );
    }

    const duration = duration_minutes || 15;
    const finalTone = tone || 'professional and friendly';

    // ---------------------------------------------------------------------
    // FINAL interview agent system prompt (panel-driven, domain-agnostic)
    // ---------------------------------------------------------------------
    const interviewPrompt = `
You are an AI interviewer conducting a "${interview_type}" interview.

INTERVIEW NAME
"${name}"

PURPOSE
${description || 'Conducting an interview to gather insights.'}

TARGET AUDIENCE
${target_audience || 'Participants'}

TONE
${finalTone}

DURATION
Approximately ${duration} minutes.

INTERVIEW RULES
- Ask ONE question at a time
- Wait for the participant to finish before continuing
- Ask neutral follow-up questions only when clarification is needed
- Do NOT assume background, expertise, or intent
- Stay within the interview purpose
- Do not give opinions or advice unless explicitly requested
- Be respectful, calm, and conversational

QUESTIONS TO COVER
${questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')}

OPENING MESSAGE
"${greeting || 'Hello! Thank you for joining today. Let’s get started.'}"

CLOSING MESSAGE
"${closing_message || 'Thank you for your time and insights.'}"
`.trim();

    // ---------------------------------------------------------------------
    // Create ElevenLabs interview agent
    // ---------------------------------------------------------------------
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const createAgentRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          conversation_config: {
            agent: {
              prompt: { prompt: interviewPrompt },
              first_message:
                greeting ||
                'Hello! Thank you for joining today. Let’s begin.',
              language: 'en',
            },
            asr: { provider: 'elevenlabs', quality: 'high' },
            tts: { voice_id: 'JBFqnCBsd6RMkjVDRZzb' },
            turn: { mode: 'turn', turn_timeout: 10 },
          },
          platform_settings: {
            auth: { enable_auth: false },
          },
        }),
      }
    );

    if (!createAgentRes.ok) {
      const err = await createAgentRes.text();
      throw new Error(`ElevenLabs agent creation failed: ${err}`);
    }

    const agent = await createAgentRes.json();

    // ---------------------------------------------------------------------
    // Persist panel
    // ---------------------------------------------------------------------
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const { data: panel, error: dbError } = await supabase
      .from('agents')
      .insert({
        name,
        slug,
        description: description || '',
        interview_type,
        elevenlabs_agent_id: agent.agent_id,
        greeting,
        questions: questionsList,
        status: 'active',
        settings: {
          tone: finalTone,
          duration_minutes: duration,
          target_audience: target_audience || '',
          closing_message:
            closing_message || 'Thank you for your time and insights.',
        },
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // ---------------------------------------------------------------------
    // Success
    // ---------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      panelId: panel.id,
      elevenlabsAgentId: agent.agent_id,
      interviewUrl: `/i/${panel.id}`,
    });
  } catch (error: any) {
    console.error('create-panel error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create interview panel' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'create-panel',
  });
}
