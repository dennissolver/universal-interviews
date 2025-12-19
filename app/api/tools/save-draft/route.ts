// app/api/tools/save-draft/route.ts
// Sandra calls this to save a draft panel for user review/editing before creation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Optional shared-secret protection
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const providedSecret = request.headers.get('X-Shared-Secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    console.log('save-draft received:', JSON.stringify(body, null, 2));

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

    // Generate slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    // Save as draft (no ElevenLabs agent created yet)
    const { data: draft, error: dbError } = await supabase
      .from('agents')
      .insert({
        name,
        slug: `draft-${slug}-${Date.now()}`, // Unique slug for draft
        description: description || '',
        interview_type: 'customer research',
        elevenlabs_agent_id: null, // Not created yet
        greeting: '',
        questions: questionsList,
        status: 'draft', // Key: marks as draft
        settings: {
          tone: tone || 'friendly and professional',
          duration_minutes: duration_minutes || 15,
          target_audience: target_audience || '',
          closing_message: closing_message || 'Thank you for your time and insights.',
          agent_name: agent_name || 'Alex',
          voice_gender: voice_gender || 'female',
          company_name: company_name || '',
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError);
      throw dbError;
    }

    console.log('Draft saved:', draft.id);

    // Return the edit URL for Sandra to mention
    const editUrl = `/panel/draft/${draft.id}/edit`;

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      editUrl,
      message: `Draft saved. User can review and edit at ${editUrl}`,
    });
  } catch (error: any) {
    console.error('save-draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'save-draft',
    description: 'Saves panel configuration as draft for user review before creation',
  });
}
