// app/api/platform/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let platform = null;

    // Try to fetch from database if configured
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await supabase
          .from('platforms')
          .select('name, company_name, vercel_url, elevenlabs_agent_id, settings')
          .eq('id', 1)
          .single();

        if (!error && data) {
          platform = data;
        }
      } catch (dbErr) {
        // Database not available or table doesn't exist - use env vars
        console.log('[api/platform] Database unavailable, using env vars');
      }
    }

    // Return config from database or env vars
    const agentId = platform?.elevenlabs_agent_id || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    const insightsAgentId = platform?.settings?.kira_agent_id || process.env.NEXT_PUBLIC_KIRA_AGENT_ID;

    return NextResponse.json({
      name: platform?.name || process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Interview Platform',
      company_name: platform?.company_name || process.env.NEXT_PUBLIC_COMPANY_NAME,
      elevenlabs_agent_id: agentId,
      insightsAgentId: insightsAgentId,
      vercel_url: platform?.vercel_url || process.env.NEXT_PUBLIC_VERCEL_URL,
    });
  } catch (err: any) {
    console.error('[api/platform] Error:', err);
    // Even on error, try to return env var fallbacks
    return NextResponse.json({
      name: process.env.NEXT_PUBLIC_PLATFORM_NAME || 'Interview Platform',
      company_name: process.env.NEXT_PUBLIC_COMPANY_NAME,
      elevenlabs_agent_id: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID,
      insightsAgentId: process.env.NEXT_PUBLIC_KIRA_AGENT_ID,
      vercel_url: process.env.NEXT_PUBLIC_VERCEL_URL,
    });
  }
}