// app/api/tools/create-panel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('X-Shared-Secret');
      if (providedSecret !== webhookSecret) {
        console.error('Invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

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

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: 'Panel name is required' }, { status: 400 });
    }

    // Parse questions - could be string (comma-separated) or array
    let questionsList: string[] = [];
    if (typeof questions === 'string') {
      questionsList = questions.split(',').map((q: string) => q.trim()).filter((q: string) => q.length > 0);
    } else if (Array.isArray(questions)) {
      questionsList = questions;
    }

    // Create ElevenLabs interview agent
    const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenlabsApiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 });
    }

    const interviewPrompt = `You are an AI interviewer for "${name}".

## Context
${description || 'Conducting interviews to gather insights.'}

## Your Style
- Tone: ${tone || 'professional yet friendly'}
- Target audience: ${target_audience || 'participants'}
- Duration: ${duration_minutes || 15} minutes

## Interview Flow
1. Start with your greeting
2. Ask the questions one at a time
3. Listen carefully and ask follow-up questions if needed
4. Thank them and end with your closing message

## Questions to Cover
${questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')}

## Rules
- Be conversational and natural
- ONE question at a time
- Listen actively and acknowledge responses
- Keep responses under 50 words
- Stay on topic but allow natural conversation flow`;

    const agentConfig = {
      name: name,
      conversation_config: {
        agent: {
          prompt: { prompt: interviewPrompt },
          first_message: greeting || `Hello! Thank you for joining this interview about ${name}. I have a few questions for you today. Let's get started!`,
          language: 'en',
        },
        tts: {
          voice_id: 'EXAVITQu4vr4xnSDxMaL', // Female voice
          model_id: 'eleven_flash_v2',
        },
        stt: { provider: 'elevenlabs' },
        turn: { mode: 'turn' },
      },
    };

    console.log('Creating ElevenLabs interview agent:', name);

    const createRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!createRes.ok) {
      const error = await createRes.json();
      console.error('ElevenLabs agent creation failed:', error);
      return NextResponse.json(
        { error: `Failed to create interview agent: ${error.detail?.message || JSON.stringify(error)}` },
        { status: 400 }
      );
    }

    const agent = await createRes.json();
    console.log('ElevenLabs interview agent created:', agent.agent_id);

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

    // Save to Supabase
    const { data: panel, error: dbError } = await supabase
      .from('agents')
      .insert({
        name: name,
        slug: slug,
        description: description || '',
        elevenlabs_agent_id: agent.agent_id,
        greeting: greeting || agentConfig.conversation_config.agent.first_message,
        questions: questionsList,
        settings: {
          tone: tone || 'professional',
          duration_minutes: duration_minutes || 15,
          target_audience: target_audience || '',
          closing_message: closing_message || 'Thank you for your time!',
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

    console.log('Panel saved to Supabase:', panel.id);

    return NextResponse.json({
      success: true,
      message: `Interview panel "${name}" created successfully!`,
      panelId: panel.id,
      agentId: agent.agent_id,
      interviewUrl: `/i/${panel.id}`,
    });

  } catch (error: any) {
    console.error('Create panel error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create panel' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'active', endpoint: 'create-panel' });
}
