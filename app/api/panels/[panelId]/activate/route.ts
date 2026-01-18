// app/api/panels/[panelId]/activate/route.ts
// Called when client clicks "Create Panel" on the draft edit page
// Creates the ElevenLabs interview agent and activates the panel

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

// Voice IDs
const VOICE_IDS = {
  female: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  male: 'pNInz6obpgDQGcFmaJgB',   // Adam
};

export async function POST(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const panelId = params.panelId;

  console.log(`[activate] Activating panel: ${panelId}`);

  try {
    // 1. Fetch the draft panel
    const { data: panel, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', panelId)
      .single();

    if (fetchError || !panel) {
      console.error('[activate] Panel not found:', fetchError);
      return NextResponse.json({ error: 'Panel not found' }, { status: 404 });
    }

    if (panel.status === 'active' && panel.elevenlabs_agent_id) {
      console.log('[activate] Panel already active');
      return NextResponse.json({
        success: true,
        panelId: panel.id,
        message: 'Panel already active'
      });
    }

    // 2. Build the interview agent prompt
    const agentName = panel.agent_name || 'Alex';
    const tone = panel.tone || 'friendly and professional';
    const duration = panel.duration_minutes || 15;
    const targetAudience = panel.target_audience || 'participants';
    const closingMessage = panel.closing_message || 'Thank you so much for your time and insights today!';

    // Format questions
    const questions = Array.isArray(panel.questions)
      ? panel.questions
      : (panel.questions || '').split('\n').filter((q: string) => q.trim());

    const questionsFormatted = questions
      .map((q: string, i: number) => `${i + 1}. ${q}`)
      .join('\n');

    const prompt = `You are ${agentName}, a ${tone} AI interviewer conducting research interviews.

## Your Role
You are conducting a research interview about: ${panel.description || panel.name}

## Target Interviewees
${targetAudience}

## Interview Guidelines
- Keep the conversation ${tone}
- Target duration: ${duration} minutes
- Ask follow-up questions to get deeper insights
- Listen actively and acknowledge responses before moving on
- Stay on topic but allow natural conversation flow
- Be warm and make the participant feel comfortable

## Questions to Cover
${questionsFormatted}

## Conversation Flow
1. Start with a warm greeting and introduce yourself
2. Briefly explain the purpose and expected duration
3. Ask questions one at a time, with natural follow-ups
4. Thank them and close warmly

## Closing
When all questions are covered or time is up, thank the participant:
"${closingMessage}"

## Important Rules
- Ask ONE question at a time
- Wait for complete responses before moving on
- Use natural transitions between topics
- If a response is brief, probe deeper with follow-up questions
- Keep track of time and wrap up gracefully`;

    // 3. Create ElevenLabs agent
    const voiceId = VOICE_IDS[panel.voice_gender as keyof typeof VOICE_IDS] || VOICE_IDS.female;

    const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Interview Platform';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${process.env.VERCEL_URL}`;
    const webhookUrl = `${siteUrl}/api/webhooks/elevenlabs`;

    const agentConfig = {
      name: `${platformName} - ${panel.name}`,
      conversation_config: {
        agent: {
          prompt: {
            prompt: prompt,
          },
          first_message: `Hi! I'm ${agentName}. Thank you for taking the time to speak with me today. This interview should take about ${duration} minutes. I'll be asking you some questions about ${panel.name.toLowerCase()}. Ready to get started?`,
          language: 'en',
        },
        tts: {
          voice_id: voiceId,
          model_id: 'eleven_turbo_v2_5',
        },
        stt: {
          provider: 'elevenlabs',
        },
        turn: {
          mode: 'turn',
        },
        conversation: {
          max_duration_seconds: (duration + 5) * 60, // Add 5 min buffer
        },
      },
      platform_settings: {
        auth: {
          enable_auth: false,
        },
        webhook: {
          url: webhookUrl,
          events: ['conversation.ended'],
        },
      },
    };

    console.log(`[activate] Creating ElevenLabs agent: ${agentConfig.name}`);
    console.log(`[activate] Voice: ${panel.voice_gender} (${voiceId})`);
    console.log(`[activate] Webhook URL: ${webhookUrl}`);

    const elevenLabsRes = await fetch(`${ELEVENLABS_API}/convai/agents/create`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig),
    });

    if (!elevenLabsRes.ok) {
      const errorText = await elevenLabsRes.text();
      console.error('[activate] ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: `Failed to create interview agent: ${errorText}` },
        { status: 500 }
      );
    }

    const elevenLabsData = await elevenLabsRes.json();
    const elevenLabsAgentId = elevenLabsData.agent_id;

    console.log(`[activate] Created ElevenLabs agent: ${elevenLabsAgentId}`);

    // 4. Update panel in database
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        status: 'active',
        elevenlabs_agent_id: elevenLabsAgentId,
        activated_at: new Date().toISOString(),
      })
      .eq('id', panelId);

    if (updateError) {
      console.error('[activate] Failed to update panel:', updateError);
      return NextResponse.json(
        { error: 'Failed to update panel status' },
        { status: 500 }
      );
    }

    console.log(`[activate] Panel ${panelId} activated successfully`);

    return NextResponse.json({
      success: true,
      panelId: panelId,
      elevenLabsAgentId: elevenLabsAgentId,
      interviewUrl: `${siteUrl}/i/${panelId}`,
    });

  } catch (error: any) {
    console.error('[activate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}