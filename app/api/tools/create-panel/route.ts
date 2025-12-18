// app/api/tools/create-panel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateInterviewPrompt } from '@/lib/prompts/interview-agent';

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
      agent_name,
      company_name,
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
    // Generate interview agent system prompt
    // ---------------------------------------------------------------------
    const interviewPrompt = generateInterviewPrompt({
      name,
      agentName: agent_name || 'Alex',
      description,
      durationMinutes: duration,
      questions: questionsList,
      tone: finalTone,
      targetAudience: target_audience,
      companyName: company_name,
      greeting,
      closingMessage: closing_message,
    });

    // ---------------------------------------------------------------------
    // Generate first message (friendly, asks for name)
    // ---------------------------------------------------------------------
    const agentDisplayName = agent_name || 'Alex';
    const firstMessage = greeting ||
      `Hi! I'm ${agentDisplayName}, and I'll be chatting with you today about ${name}. Thanks so much for being here — could you start by telling me your name?`;

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
              first_message: firstMessage,
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
        greeting: firstMessage,
        questions: questionsList,
        status: 'active',
        settings: {
          tone: finalTone,
          duration_minutes: duration,
          target_audience: target_audience || '',
          closing_message: closing_message || 'Thank you for your time and insights.',
          agent_name: agentDisplayName,
          company_name: company_name || '',
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