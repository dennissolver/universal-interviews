// app/api/platform/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: platform, error } = await supabase
      .from('platforms')
      .select('name, company_name, vercel_url, elevenlabs_agent_id, settings')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('[api/platform] Error fetching platform:', error);
      return NextResponse.json(
        { error: 'Failed to fetch platform config' },
        { status: 500 }
      );
    }

    // Also check env var as fallback
    const agentId = platform?.elevenlabs_agent_id || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    return NextResponse.json({
      name: platform?.name || process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Interview Platform',
      company_name: platform?.company_name || process.env.NEXT_PUBLIC_COMPANY_NAME,
      elevenlabs_agent_id: agentId,
      vercel_url: platform?.vercel_url,
    });
  } catch (err: any) {
    console.error('[api/platform] Error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}