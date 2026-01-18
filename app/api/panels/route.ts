// app/api/panels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: agents, error } = await supabase
      .from('agents')
      .select('id, slug, name, description, status, total_interviews, completed_interviews, created_at, primary_color')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch panels:', error);
      return NextResponse.json(
        { error: 'Failed to fetch panels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ agents: agents || [] });
  } catch (error) {
    console.error('Panels API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}