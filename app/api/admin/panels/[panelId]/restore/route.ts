import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  _req: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params;

  try {
    // Restore panel
    const { error } = await supabase
      .from('agents')
      .update({
        archived: false,
        archived_at: null,
      })
      .eq('id', panelId);

    if (error) throw error;

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'restore_panel',
      entity_type: 'panel',
      entity_id: panelId,
      performed_by: 'admin',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Restore panel failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to restore panel' },
      { status: 500 }
    );
  }
}
