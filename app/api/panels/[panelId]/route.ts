// app/api/panels/[panelId]/route.ts
// GET: Fetch panel/draft details
// PATCH: Update panel/draft details (without creating ElevenLabs agent)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  try {
    const { panelId } = params;

    const { data: panel, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', panelId)
      .single();

    if (error || !panel) {
      return NextResponse.json(
        { error: 'Panel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ panel });
  } catch (error: any) {
    console.error('GET panel error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch panel' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  try {
    const { panelId } = params;
    const body = await request.json();

    const {
      name,
      description,
      questions,
      settings,
    } = body;

    // Build update object
    const updates: Record<string, any> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (questions !== undefined) updates.questions = questions;
    if (settings !== undefined) updates.settings = settings;

    const { data: panel, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', panelId)
      .select()
      .single();

    if (error) {
      console.error('PATCH panel error:', error);
      throw error;
    }

    return NextResponse.json({ panel });
  } catch (error: any) {
    console.error('PATCH panel error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update panel' },
      { status: 500 }
    );
  }
}
