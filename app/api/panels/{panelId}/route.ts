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
  const { panelId } = params;

  const { data, error } = await supabase
    .from('agents') // panels are stored here
    .select('*')
    .eq('id', panelId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Panel not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}

