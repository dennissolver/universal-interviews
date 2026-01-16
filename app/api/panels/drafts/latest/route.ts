// app/api/panels/drafts/latest/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ draft: null });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the most recent draft that hasn't been published
    const { data: draft, error } = await supabase
      .from('panel_drafts')
      .select('id, name, description, status, created_at')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      console.error('[api/panels/drafts/latest] Error:', error);
    }

    return NextResponse.json({ draft: draft || null });
  } catch (err: any) {
    console.error('[api/panels/drafts/latest] Error:', err);
    return NextResponse.json({ draft: null });
  }
}