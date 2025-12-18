// app/api/interviews/link-conversation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { interviewId, elevenlabsConversationId } = await request.json();

    if (!interviewId || !elevenlabsConversationId) {
      return NextResponse.json(
        { error: 'Missing interviewId or elevenlabsConversationId' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('interviews')
      .update({ elevenlabs_conversation_id: elevenlabsConversationId })
      .eq('id', interviewId);

    if (error) {
      console.error('Failed to link conversation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Linked conversation:', { interviewId, elevenlabsConversationId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Link conversation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}