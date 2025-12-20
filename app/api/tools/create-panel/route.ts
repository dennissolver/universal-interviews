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
    let agentData: any

    // If draft_id provided, we're finalizing an existing draft
    if (draft_id) {
      console.log('Finalizing draft:', draft_id)

      const { data: draft, error: fetchError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', draft_id)
        .single()

      if (fetchError || !draft) {
        console.error('Draft not found:', fetchError)
        return NextResponse.json({
          error: 'Draft not found'
        }, { status: 404 })
      }

      agentData = draft
    } else {
      // Direct creation (original behavior) - create agent data from body
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

      // Insert new agent with correct column names
      const { data: newAgent, error: insertError } = await supabase
        .from('agents')
        .insert({
          name: name || 'Untitled Panel',
          description: description || '',
          questions: questionsArray,
          interviewer_tone: tone || 'friendly and professional',
          target_interviewees: target_audience || '',
          estimated_duration_mins: duration_minutes || 15,
          agent_name: agent_name || 'Alex',
          voice_gender: voice_gender || 'female',
          closing_message: closing_message || 'Thank you for your time.',
          greeting: greeting || '',
          status: 'draft',
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({
          error: 'Failed to create panel'
        }, { status: 500 })
      }

      agentData = newAgent
    }

    // Now create the ElevenLabs agent
    const voiceGender = agentData.voice_gender || 'female'
    const voiceId = VOICE_IDS[voiceGender as keyof typeof VOICE_IDS] || VOICE_IDS.female
    const interviewerName = agentData.agent_name || 'Alex'

    console.log(`Creating ElevenLabs agent: ${interviewerName}, voice=${voiceGender}, voiceId=${voiceId}`)

    // Build the system prompt for the interview agent
    const questionsFormatted = Array.isArray(agentData.questions)
      ? agentData.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
      : agentData.questions

    // Use correct database column names with fallbacks
    const systemPrompt = buildInterviewPrompt({
      name: agentData.name,
      description: agentData.description || '',
      interviewerName,
      tone: agentData.interviewer_tone || 'friendly and professional',
      targetAudience: agentData.target_interviewees || '',
      questions: questionsFormatted,
      closingMessage: agentData.closing_message || 'Thank you for your time.',
      durationMinutes: agentData.estimated_duration_mins || 15
    })

    // First message now asks for full name to start demographic capture
    const firstMessage = agentData.greeting ||
      `Hello! I'm ${interviewerName}, and I'll be conducting your interview today. Thank you so much for taking the time. Before we dive into our questions, I just need to capture a few quick details. Could I get your full name please?`

    // Create ElevenLabs conversational agent
    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Interview: ${agentData.name}`,
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

    // Update agent with ElevenLabs agent ID and set status to active
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update({
        elevenlabs_agent_id: elevenLabsAgent.agent_id,
        voice_id: voiceId,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', agentData.id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      console.error('CLEANUP NEEDED: ElevenLabs agent created but DB update failed. Agent ID:', elevenLabsAgent.agent_id)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://universal-interviews.vercel.app'
    const interviewUrl = `/i/${agentData.id}`

    console.log('Panel created successfully:', agentData.id)

    return NextResponse.json({
      success: true,
      panelId: agentData.id,
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

// Build the interview system prompt with required demographic capture
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

## RESEARCH CONTEXT
${config.description}

## TARGET PARTICIPANTS
${config.targetAudience}

## YOUR TONE AND STYLE
- Maintain a ${config.tone} tone throughout
- Be genuinely curious and engaged
- Listen actively and ask follow-up questions when answers are interesting
- Don't rush through questions - let conversations develop naturally
- Validate participants' experiences and perspectives

## INTERVIEW STRUCTURE
Target duration: ${config.durationMinutes} minutes

## REQUIRED: PARTICIPANT DETAILS (COLLECT FIRST)
Before asking ANY research questions, you MUST collect these three pieces of information in order:

1. **Full Name** - Your first message asks for this. Wait for their response.
2. **Company/Organization** - After they give their name, ask: "Great, thank you! And what company or organization are you with?"
3. **City/Location** - Then ask: "And what city are you based in?"

Only AFTER collecting all three details should you transition to the research questions with something like:
"Perfect, thank you [Name]! I really appreciate those details. Now let's dive into the interview..."

CRITICAL: Do not skip or rush past any of these three fields. They are required for every interview. Wait for a response to each question before moving to the next.

## RESEARCH QUESTIONS TO COVER
${config.questions}

## INTERVIEW GUIDELINES
1. ALWAYS collect participant details first (full name, company, city) before any research questions
2. Ask questions naturally, not like reading from a script
3. If a response is interesting, dig deeper with follow-ups like:
   - "Can you tell me more about that?"
   - "What made you feel that way?"
   - "Could you give me an example?"
4. Don't feel obligated to ask every question if time runs short - prioritize depth over breadth
5. Keep track of time and begin wrapping up appropriately
6. End with: "${config.closingMessage}"

## EXAMPLE OPENING FLOW
You: "Hello! I'm ${config.interviewerName}, and I'll be conducting your interview today. Thank you so much for taking the time. Before we dive into our questions, I just need to capture a few quick details. Could I get your full name please?"
[Wait for response - e.g., "I'm John Smith"]
You: "Great, thank you John! And what company or organization are you with?"
[Wait for response - e.g., "I work at Acme Corp"]
You: "And what city are you based in?"
[Wait for response - e.g., "Sydney"]
You: "Perfect, thank you John! I really appreciate those details. Now let's dive into the interview..."
[Then begin with the first research question]

Remember: You're having a conversation, not conducting an interrogation. Make participants feel heard and valued.`
}