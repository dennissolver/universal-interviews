import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // Optional shared-secret protection (internal calls / webhooks only)
    // -----------------------------------------------------------------------
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('X-Shared-Secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // -----------------------------------------------------------------------
    // Parse request body
    // -----------------------------------------------------------------------
    const body = await request.json();

    const {
      name,
      description,
      tone,
      greeting,
      questions,
      closing_message,
      target_audience,
      duration_minutes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Panel name is required' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Normalize questions
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Build the FINAL interviewing agent system prompt
    // -----------------------------------------------------------------------
    const interviewPrompt = `
You are an AI interviewer conducting an interview called "${name}".

## Context
${description || 'Conducting structured interviews to gather insights.'}

## Interview Structure

### Part 1 — Participant Details (MANDATORY)
At the start of EVERY interview, you MUST collect the following details.
Ask ONE question at a time and wait for a response before proceeding.

Ask in this exact order:
1. Full name
2. Company or fund name (or "Independent")
3. Country they are based in
4. General investment thesis or focus
   (e.g. pre-seed, seed, Series A, growth, mixed)
5. Primary sectors of interest
   (e.g. technology, climate, fintech, health, infrastructure)

Rules for this section:
- Never combine questions
- Briefly acknowledge each answer
- Accept high-level responses
- Do not repeat unless unclear

After all five are collected, say:
"Thank you — now I’ll move into the main interview questions."

### Part 2 — Main Interview Questions
${questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Style & Behaviour Rules
- Tone: ${tone || 'professional and friendly'}
- Target audience: ${target_audience || 'participants'}
- Interview duration: ${duration_minutes || 15} minutes
- Ask ONE question at a time
- Be conversational and natural
- Ask follow-ups only when useful
- Keep responses concise
- End by thanking the participant

Opening message:
"${greeting || 'Hello! Thank you for joining today. I’ll start with a few quick questions to get to know you.'}"

Closing message:
"${closing_message || 'Thank you for your time and insights — they are greatly appreciated.'}"
`;

    // -----------------------------------------------------------------------
    // Create ElevenLabs agent
    // -----------------------------------------------------------------------
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
                'Hello! Thank you for joining today. I’ll start with a few quick questions to get to know you.',
              language: 'en',
            },
            asr: {
              provider: 'elevenlabs',
              quality: 'high',
            },
            tts: {
              voice_id: 'JBFqnCBsd6RMkjVDRZzb',
            },
            turn: {
              mode: 'turn_based',
              turn_timeout: 10,
            },
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
    const elevenlabsAgentId = agent.agent_id;

    // -----------------------------------------------------------------------
    // Persist panel in Supabase
    // -----------------------------------------------------------------------
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
        elevenlabs_agent_id: elevenlabsAgentId,
        greeting,
        questions: questionsList,
        status: 'active',
        settings: {
          tone: tone || 'professional',
          duration_minutes: duration_minutes || 15,
          target_audience: target_audience || '',
          closing_message:
            closing_message ||
            'Thank you for your time and insights — they are greatly appreciated.',
        },
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // -----------------------------------------------------------------------
    // Success response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      panelId: panel.id,
      elevenlabsAgentId,
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
