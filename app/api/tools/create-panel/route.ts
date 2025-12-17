// app/api/tools/create-panel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    /**
     * This endpoint is called internally by our own webhook handler.
     * It does NOT verify ElevenLabs webhook signatures.
     * ElevenLabs auth happens only when calling their API.
     */

    const body = await request.json();
    console.log('Create panel request:', JSON.stringify(body, null, 2));

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

    // -----------------------------
    // Validation
    // -----------------------------
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Panel name is required' },
        { status: 400 }
      );
    }

    // Parse questions (array preferred)
    let questionsList: string[] = [];
    if (Array.isArray(questions)) {
      questionsList = questions;
    } else if (typeof questions === 'string') {
      questionsList = questions
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean);
    }

    if (questionsList.length === 0) {
      return NextResponse.json(
        { error: 'At least one interview question is required' },
        { status: 400 }
      );
    }

    // -----------------------------
    // ElevenLabs agent creation
    // -----------------------------
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY not configured' },
        { status: 500 }
      );
    }

    const interviewPrompt = `You are an AI interviewer for "${name}".

## Context
${description || 'Conducting interviews to gather insights.'}

## Style
- Tone: ${tone || 'professional yet friendly'}
- Target audience: ${target_audience || 'participants'}
- Duration: ${duration_minutes || 15} minutes

## Interview Flow
1. Start with the greeting
2. Ask one question at a time
3. Ask follow-ups when useful
4. End with the closing message

## Questions
${questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Rules
- One question at a time
- Be conversational and natural
- Keep responses concise
- Stay on topic`;

    const agentConfig = {
      name,
      conversation_config: {
        agent: {
          prompt: { prompt: interviewPrompt },
          first_message:
            greeting ??
            `Hello! Thank you for joining this interview about ${name}. Let’s get started.`,
          language: 'en',
        },
        tts: {
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
          model_id: 'eleven_flash_v2',
        },
        stt: { provider: 'elevenlabs' },
        turn: { mode: 'turn' },
      },
    };

    console.log('Creating ElevenLabs interview agent:', name);

    const createRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentConfig),
      }
    );

    if (!createRes.ok) {
      const error = await createRes.text();
      console.error('ElevenLabs agent creation failed:', error);
      return NextResponse.json(
        { error: 'Failed to create ElevenLabs interview agent' },
        { status: 400 }
      );
    }

    const agent = await createRes.json();
    console.log('ElevenLabs agent created:', agent.agent_id);

    // -----------------------------
    // Persist panel in Supabase
    // -----------------------------
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
        elevenlabs_agent_id: agent.agent_id,
        greeting:
          greeting ??
          agentConfig.conversation_config.agent.first_message,
        questions: questionsList,
        settings: {
          tone: tone || 'professional',
          duration_minutes: duration_minutes || 15,
          target_audience: target_audience || '',
          closing_message:
            closing_message || 'Thank you for your time!',
        },
        status: 'active',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return NextResponse.json(
        { error: `Failed to save panel: ${dbError.message}` },
        { status: 500 }
      );
    }

    console.log('Panel saved:', panel.id);

    return NextResponse.json({
      success: true,
      panelId: panel.id,
      agentId: agent.agent_id,
      interviewUrl: `/i/${panel.id}`,
    });
  } catch (err: any) {
    console.error('Create panel error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create panel' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'create-panel',
  });
}
