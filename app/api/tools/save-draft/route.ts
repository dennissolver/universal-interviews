// app/api/tools/save-draft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[save-draft] Received:', JSON.stringify(body, null, 2));

    // ElevenLabs sends conversation_id in various ways
    const conversation_id =
      body.conversation_id ||
      body.conversationId ||
      body.context?.conversation_id ||
      request.headers.get('x-conversation-id') ||
      null;

    // Flexibly map Sandra's output to our schema
    // Sandra might use different field names, so we check multiple possibilities

    const name =
      body.name ||
      body.panel_name ||
      body.study_name ||
      body.survey_name ||
      body.purpose ||
      body.title ||
      'Untitled Panel';

    const description =
      body.description ||
      body.research_objective ||
      body.objective ||
      body.purpose ||
      body.summary ||
      '';

    const target_audience =
      body.target_audience ||
      body.target_participants ||
      body.participants ||
      body.audience ||
      '';

    const tone =
      body.tone ||
      body.tone_style ||
      body.style ||
      body.interview_tone ||
      'Friendly';

    const duration_minutes =
      body.duration_minutes ||
      body.duration ||
      body.interview_length ||
      body.length_minutes ||
      15;

    const agent_name =
      body.agent_name ||
      body.interviewer_name ||
      body.ai_name ||
      'Alex';

    const voice_gender =
      body.voice_gender ||
      body.gender ||
      body.voice ||
      'female';

    const closing_message =
      body.closing_message ||
      body.closing_remarks ||
      body.thank_you_message ||
      body.outro ||
      'Thank you for your time and contributions.';

    const greeting =
      body.greeting ||
      body.opening ||
      body.intro ||
      body.opening_message ||
      null;

    // Handle questions - could be array of strings or array of objects or comma-separated
    let questionsList: string[] = [];
    const rawQuestions =
      body.questions ||
      body.key_questions ||
      body.key_questions_areas ||
      body.interview_questions ||
      body.survey_questions ||
      [];

    if (typeof rawQuestions === 'string') {
      questionsList = rawQuestions.split(',').map((q: string) => q.trim()).filter(Boolean);
    } else if (Array.isArray(rawQuestions)) {
      questionsList = rawQuestions.map((q: any) => {
        if (typeof q === 'string') return q;
        if (typeof q === 'object' && q.question) return q.question;
        if (typeof q === 'object' && q.text) return q.text;
        return String(q);
      }).filter(Boolean);
    }

    // Extract constraints into description if provided
    let fullDescription = description;
    const constraints = body.constraints_requirements || body.constraints || body.requirements;
    if (constraints && Array.isArray(constraints)) {
      fullDescription = `${description}\n\nRequirements: ${constraints.join(', ')}`;
    }

    // Save draft to database
    const { data: draft, error: dbError } = await supabase
      .from('panel_drafts')
      .insert({
        name,
        description: fullDescription.trim(),
        target_audience,
        tone,
        duration_minutes: typeof duration_minutes === 'number' ? duration_minutes : parseInt(duration_minutes) || 15,
        questions: questionsList,
        agent_name,
        voice_gender,
        closing_message,
        greeting,
        conversation_id,
        status: 'draft',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[save-draft] Database error:', dbError);
      return NextResponse.json({
        error: `Failed to save draft: ${dbError.message}`,
        success: false
      }, { status: 500 });
    }

    console.log('[save-draft] Saved draft:', draft.id, 'conversation_id:', conversation_id);

    // Return success message for Sandra to speak
    return NextResponse.json({
      success: true,
      message: `I've saved your interview panel as a draft. You can review it on your screen now.`,
      draft_id: draft.id,
      review_url: `/panels/drafts/${draft.id}`,
    });

  } catch (error: any) {
    console.error('[save-draft] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to save draft',
      success: false
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'active', endpoint: 'save-draft' });
}