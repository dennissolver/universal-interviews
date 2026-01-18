import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params;

  try {
    // ------------------------------------------------------------
    // 1. Fetch interviews for this panel
    // ------------------------------------------------------------
    const { data: interviews } = await supabase
      .from('interviews')
      .select('id')
      .eq('panel_id', panelId);

    const interviewIds = interviews?.map((i) => i.id) ?? [];

    // ------------------------------------------------------------
    // 2. Delete transcripts
    // ------------------------------------------------------------
    if (interviewIds.length > 0) {
      await supabase
        .from('interview_transcripts')
        .delete()
        .in('interview_id', interviewIds);
    }

    // ------------------------------------------------------------
    // 3. Delete interviews
    // ------------------------------------------------------------
    await supabase
      .from('interviews')
      .delete()
      .eq('panel_id', panelId);

    // ------------------------------------------------------------
    // 4. Delete invites
    // ------------------------------------------------------------
    await supabase
      .from('invites')
      .delete()
      .eq('panel_id', panelId);

    // ------------------------------------------------------------
    // 5. Delete panel (agents table)
    // ------------------------------------------------------------
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', panelId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete panel failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete panel' },
      { status: 500 }
    );
  }
}
