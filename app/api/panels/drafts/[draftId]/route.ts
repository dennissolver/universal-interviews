// app/api/panels/drafts/[draftId]/route.ts
// API for fetching and updating panel drafts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const { draftId } = params;

    const { data: draft, error } = await supabase
      .from('panel_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error || !draft) {
      console.error('Draft not found:', error);
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(draft);
  } catch (error: any) {
    console.error('GET draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const { draftId } = params;
    const body = await request.json();

    // Build update object from allowed fields
    const allowedFields = [
      'name', 'description', 'target_audience', 'tone',
      'duration_minutes', 'questions', 'agent_name', 'voice_gender',
      'closing_message', 'greeting', 'status'
    ];

    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: draft, error } = await supabase
      .from('panel_drafts')
      .update(updates)
      .eq('id', draftId)
      .select()
      .single();

    if (error) {
      console.error('PATCH draft error:', error);
      throw error;
    }

    return NextResponse.json(draft);
  } catch (error: any) {
    console.error('PATCH draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update draft' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const { draftId } = params;

    const { error } = await supabase
      .from('panel_drafts')
      .delete()
      .eq('id', draftId);

    if (error) {
      console.error('DELETE draft error:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete draft' },
      { status: 500 }
    );
  }
}
