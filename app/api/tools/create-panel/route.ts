// app/api/tools/create-panel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Voice IDs for ElevenLabs
const VOICE_IDS = {
  female: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  male: 'pNInz6obpgDQGcFmaJgB'    // Adam
}

// Verify the shared secret from ElevenLabs webhook OR internal calls
function verifyRequest(request: NextRequest): boolean {
  const secret = request.headers.get('x-shared-secret') ||
                 request.headers.get('X-Shared-Secret')
  const internalKey = request.headers.get('x-internal-key')

  return secret === process.env.ELEVENLABS_WEBHOOK_SECRET ||
         internalKey === process.env.INTERNAL_API_KEY
}

export async function POST(request: NextRequest) {
  console.log('=== CREATE PANEL ENDPOINT CALLED ===')

  // Verify request
  if (!verifyRequest(request)) {
    console.error('Unauthorized request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    console.log('Received data:', JSON.stringify(body, null, 2))

    const { draft_id } = body
    let panelData: any

    // If draft_id provided, we're finalizing an existing draft
    if (draft_id) {
      console.log('Finalizing draft:', draft_id)

      const { data: draft, error: fetchError } = await supabase
        .from('panels')
        .select('*')
        .eq('id', draft_id)
        .single()

      if (fetchError || !draft) {
        console.error('Draft not found:', fetchError)
        return NextResponse.json({
          error: 'Draft not found'
        }, { status: 404 })
      }

      panelData = draft
    } else {
      // Direct creation (original behavior) - create panel data from body
      const {
        name,
        description,
        questions,
        tone,
        target_audience,
        duration_minutes,
        agent_name,
        voice_gender,
        closing_message,
        greeting
      } = body

      // Normalize questions
      let questionsArray: string[] = []
      if (Array.isArray(questions)) {
        questionsArray = questions
      } else if (typeof questions === 'string') {
        questionsArray = questions
          .split(/\d+\.\s+/)
          .map((q: string) => q.trim())
          .filter((q: string) => q.length > 0)
      }

      // Insert new panel
      const { data: newPanel, error: insertError } = await supabase
        .from('panels')
        .insert({
          name: name || 'Untitled Panel',
          description: description || '',
          questions: questionsArray,
          tone: tone || 'friendly and professional',
          target_audience: target_audience || '',
          duration_minutes: duration_minutes || 15,
          agent_name: agent_name || 'Alex',
          voice_gender: voice_gender || 'female',
          closing_message: closing_message || 'Thank you for your time.',
          greeting: greeting || '',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({
          error: 'Failed to create panel'
        }, { status: 500 })
      }

      panelData = newPanel
    }

    // Now create the ElevenLabs agent
    const voiceId = VOICE_IDS[panelData.voice_gender as keyof typeof VOICE_IDS] || VOICE_IDS.female
    const interviewerName = panelData.agent_name || 'Alex'

    console.log(`Creating ElevenLabs agent: ${interviewerName}, voice=${panelData.voice_gender}, voiceId=${voiceId}`)

    // Build the system prompt for the interview agent
    const questionsFormatted = Array.isArray(panelData.questions)
      ? panelData.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
      : panelData.questions

    const systemPrompt = buildInterviewPrompt({
      name: panelData.name,
      description: panelData.description,
      interviewerName,
      tone: panelData.tone,
      targetAudience: panelData.target_audience,
      questions: questionsFormatted,
      closingMessage: panelData.closing_message,
      durationMinutes: panelData.duration_minutes
    })

    const firstMessage = panelData.greeting ||
      `Hello! I'm ${interviewerName}, and I'm conducting research on ${panelData.name}. Thank you for taking the time to speak with me today. Before we begin, may I ask your name?`

    // Create ElevenLabs conversational agent
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Interview: ${panelData.name}`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt
            },
            first_message: firstMessage,
            language: 'en'
          },
          tts: {
            voice_id: voiceId
          }
        }
      })
    })

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      console.error('ElevenLabs API error:', errorText)
      return NextResponse.json({
        error: 'Failed to create interview agent',
        details: errorText
      }, { status: 500 })
    }

    const elevenLabsAgent = await elevenLabsResponse.json()
    console.log('ElevenLabs agent created:', elevenLabsAgent.agent_id)

    // Update panel with ElevenLabs agent ID and set status to active
    const { data: updatedPanel, error: updateError } = await supabase
      .from('panels')
      .update({
        elevenlabs_agent_id: elevenLabsAgent.agent_id,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', panelData.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      // Agent was created but DB update failed - log for manual cleanup
      console.error('CLEANUP NEEDED: ElevenLabs agent created but DB update failed. Agent ID:', elevenLabsAgent.agent_id)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://universal-interviews.vercel.app'
    const interviewUrl = `/i/${panelData.id}`

    console.log('Panel created successfully:', panelData.id)

    return NextResponse.json({
      success: true,
      panelId: panelData.id,
      elevenlabsAgentId: elevenLabsAgent.agent_id,
      interviewUrl: interviewUrl,
      fullInterviewUrl: `${baseUrl}${interviewUrl}`
    })

  } catch (error) {
    console.error('Error creating panel:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Build the interview system prompt
function buildInterviewPrompt(config: {
  name: string
  description: string
  interviewerName: string
  tone: string
  targetAudience: string
  questions: string
  closingMessage: string
  durationMinutes: number
}): string {
  return `You are ${config.interviewerName}, an AI research interviewer conducting a study called "${config.name}".

RESEARCH CONTEXT:
${config.description}

TARGET PARTICIPANTS:
${config.targetAudience}

YOUR TONE AND STYLE:
- Maintain a ${config.tone} tone throughout
- Be genuinely curious and engaged
- Listen actively and ask follow-up questions when answers are interesting
- Don't rush through questions - let conversations develop naturally
- Validate participants' experiences and perspectives

INTERVIEW STRUCTURE:
Target duration: ${config.durationMinutes} minutes

QUESTIONS TO COVER:
${config.questions}

IMPORTANT GUIDELINES:
1. Start by warmly greeting the participant and getting their name
2. Ask questions naturally, not like reading from a script
3. If a response is interesting, dig deeper with follow-ups like:
   - "Can you tell me more about that?"
   - "What made you feel that way?"
   - "Could you give me an example?"
4. Don't feel obligated to ask every question if time runs short - prioritize depth over breadth
5. Keep track of time and begin wrapping up appropriately
6. End with: "${config.closingMessage}"

Remember: You're having a conversation, not conducting an interrogation. Make participants feel heard and valued.`
}