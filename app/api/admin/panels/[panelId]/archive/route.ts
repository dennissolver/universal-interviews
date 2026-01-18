// app/api/admin/panels/[panelId]/archive/route.ts
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
    const { error } = await supabase
      .from('agents')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
      })
      .eq('id', panelId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Archive panel failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to archive panel' },
      { status: 500 }
    );
  }
}