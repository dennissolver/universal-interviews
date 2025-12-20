// app/api/panels/[panelId]/activate/route.ts
// Activates a draft panel by creating the ElevenLabs agent and setting status to 'active'
// Called from browser (draft edit page), NOT from ElevenLabs webhook

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params

  console.log('=== ACTIVATE PANEL ENDPOINT ===')
  console.log('Panel ID:', panelId)

  try {
    // 1. Fetch the draft panel
    const { data: draft, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', panelId)
      .single()

    if (fetchError || !draft) {
      console.error('Draft not found:', fetchError)
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    if (draft.status !== 'draft') {
      return NextResponse.json({ error: 'Panel is already active' }, { status: 400 })
    }

    // 2. Build the system prompt for ElevenLabs agent
    const agentName = draft.agent_name || 'Alex'
    const companyName = draft.company_name || ''
    const tone = draft.interviewer_tone || 'friendly and professional'
    const duration = draft.estimated_duration_mins || 15
    const targetAudience = draft.target_interviewees || ''
    const questions = draft.questions || []
    const closingMessage = draft.closing_message || 'Thank you for your time and insights.'

    const systemPrompt = `You are ${agentName}${companyName ? ` from ${companyName}` : ''}, a ${tone} AI interviewer conducting research interviews.

## Your Role
You are conducting a research interview about: ${draft.description || draft.name}

## Target Interviewees
${targetAudience}

## Interview Guidelines
- Keep the conversation ${tone}
- Target duration: ${duration} minutes
- Ask follow-up questions to get deeper insights
- Listen actively and acknowledge responses before moving on
- Stay on topic but allow natural conversation flow

## Questions to Cover
${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

## Closing
When the interview is complete or time is up, thank them: "${closingMessage}"

Remember: You're gathering insights, not interrogating. Be curious and conversational.`

    const greeting = draft.greeting ||
      `Hi! I'm ${agentName}${companyName ? ` from ${companyName}` : ''}. Thank you for taking the time to speak with me today. I'll be asking you some questions about ${draft.name?.toLowerCase() || 'your experiences'}. Feel free to share as much detail as you'd like. Shall we begin?`

    // 3. Determine voice ID based on voice_gender
    const voiceGender = draft.voice_gender || 'female'
    // ElevenLabs voice IDs - you may need to update these with your actual voice IDs
    const voiceId = voiceGender === 'male'
      ? (process.env.ELEVENLABS_MALE_VOICE_ID || 'pNInz6obpgDQGcFmaJgB') // Adam
      : (process.env.ELEVENLABS_FEMALE_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL') // Sarah

    // 4. Create ElevenLabs conversational agent
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      console.error('Missing ELEVENLABS_API_KEY')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    console.log('Creating ElevenLabs agent...')

    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: draft.name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt,
            },
            first_message: greeting,
            language: 'en',
          },
          tts: {
            voice_id: voiceId,
          },
        },
      }),
    })

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text()
      console.error('ElevenLabs API error:', errorText)
      return NextResponse.json({
        error: 'Failed to create voice agent',
        details: errorText
      }, { status: 500 })
    }

    const agentData = await agentResponse.json()
    const elevenLabsAgentId = agentData.agent_id

    console.log('ElevenLabs agent created:', elevenLabsAgentId)

    // 5. Update the panel with ElevenLabs agent ID and set status to active
    const { data: updatedPanel, error: updateError } = await supabase
      .from('agents')
      .update({
        elevenlabs_agent_id: elevenLabsAgentId,
        voice_id: voiceId,
        greeting: greeting,
        system_prompt: systemPrompt,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', panelId)
      .select()
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json({
        error: 'Failed to activate panel',
        details: updateError.message
      }, { status: 500 })
    }

    console.log('Panel activated successfully:', panelId)

    return NextResponse.json({
      success: true,
      panelId: panelId,
      elevenlabsAgentId: elevenLabsAgentId,
      message: 'Panel activated successfully'
    })

  } catch (error) {
    console.error('Activation error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}