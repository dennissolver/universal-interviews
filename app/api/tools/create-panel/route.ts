// app/api/tools/create-panel/route.ts
// Creates interview panel with ElevenLabs agent
// Can either create fresh OR finalize an existing draft

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateInterviewPrompt } from '@/lib/prompts/interview-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ElevenLabs voice IDs
const VOICE_IDS = {
  female: 'EXAVITQu4vr4xnSDxMaL', // Sarah - Warm & Professional
  male: 'pNInz6obpgDQGcFmaJgB',   // Adam - Deep & Confident
} as const;

export async function POST(request: NextRequest) {
  try {
    // Optional shared-secret protection
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('X-Shared-Secret');
      if (providedSecret !== webhookSecret) {
        // Allow requests without secret if coming from our own frontend
        const origin = request.headers.get('origin') || '';
        const isInternal = origin.includes('localhost') || origin.includes('vercel.app');
        if (!isInternal) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
      }
    }

    const body = await request.json();
    console.log('create-panel received:', JSON.stringify(body, null, 2));

    const {
      draft_id,  // If provided, we're finalizing a draft
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
      voice_gender,
      company_name,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Panel name is required' },
        { status: 400 }
      );
    }

    // Normalize questions
    let questionsList: string[] = [];
    if (Array.isArray(questions)) {
      questionsList = questions;
    } else if (typeof questions === 'string') {
      questionsList = questions
        .split(/[,\n]+/)
        .map((q: string) => q.trim())
        .filter(Boolean);
    }

    if (questionsList.length === 0) {
      questionsList = [
        'Can you tell me about your current situation?',
        'What challenges are you facing?',
        'What would an ideal solution look like for you?',
      ];
    }

    const duration = duration_minutes || 15;
    const finalTone = tone || 'friendly and professional';
    const agentDisplayName = agent_name || 'Alex';
    const voiceGender = voice_gender?.toLowerCase() === 'male' ? 'male' : 'female';
    const voiceId = VOICE_IDS[voiceGender];

    console.log(`Interviewer: ${agentDisplayName}, voice=${voiceGender}, voiceId=${voiceId}`);

    // Generate interview agent system prompt
    const interviewPrompt = generateInterviewPrompt({
      name,
      agentName: agentDisplayName,
      description,
      durationMinutes: duration,
      questions: questionsList,
      tone: finalTone,
      targetAudience: target_audience,
      companyName: company_name,
      greeting,
      closingMessage: closing_message,
    });

    // Generate first message
    const firstMessage = `Hi! I'm ${agentDisplayName}, and I'll be chatting with you today about ${name}. Thanks so much for being here - could you start by telling me your name?`;

    // Create ElevenLabs interview agent
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
          name: `${name} - ${agentDisplayName}`,
          conversation_config: {
            agent: {
              prompt: { prompt: interviewPrompt },
              first_message: firstMessage,
              language: 'en',
            },
            asr: { 
              provider: 'elevenlabs', 
              quality: 'high' 
            },
            tts: { 
              voice_id: voiceId,
              model_id: 'eleven_flash_v2',
            },
            turn: { 
              mode: 'turn', 
              turn_timeout: 10 
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
      console.error('ElevenLabs error:', err);
      throw new Error(`ElevenLabs agent creation failed: ${err}`);
    }

    const agent = await createAgentRes.json();

    // Generate proper slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    let panel;

    if (draft_id) {
      // Finalize existing draft
      const { data, error: dbError } = await supabase
        .from('agents')
        .update({
          name,
          slug,
          description: description || '',
          interview_type: interview_type || 'customer research',
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
            voice_gender: voiceGender,
            company_name: company_name || '',
          },
        })
        .eq('id', draft_id)
        .select()
        .single();

      if (dbError) {
        console.error('Supabase error:', dbError);
        throw dbError;
      }
      panel = data;
    } else {
      // Create fresh panel
      const { data, error: dbError } = await supabase
        .from('agents')
        .insert({
          name,
          slug,
          description: description || '',
          interview_type: interview_type || 'customer research',
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
            voice_gender: voiceGender,
            company_name: company_name || '',
          },
        })
        .select()
        .single();

      if (dbError) {
        console.error('Supabase error:', dbError);
        throw dbError;
      }
      panel = data;
    }

    console.log('Panel created:', panel.id, `(${agentDisplayName}, ${voiceGender} voice)`);

    return NextResponse.json({
      success: true,
      panelId: panel.id,
      elevenlabsAgentId: agent.agent_id,
      interviewUrl: `/i/${panel.id}`,
      interviewer: {
        name: agentDisplayName,
        voice: voiceGender,
      },
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
    supportedVoices: ['male', 'female'],
  });
}
