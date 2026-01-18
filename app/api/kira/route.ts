// app/api/kira/start/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const kiraAgentId = process.env.NEXT_PUBLIC_KIRA_AGENT_ID;

    if (!kiraAgentId) {
      return NextResponse.json(
        { error: 'Kira agent not configured' },
        { status: 500 }
      );
    }

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Get signed URL from ElevenLabs
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${kiraAgentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': elevenLabsApiKey,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      console.error('ElevenLabs signed URL error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get Kira conversation URL' },
        { status: 500 }
      );
    }

    const { signed_url: signedUrl } = await signedUrlResponse.json();

    return NextResponse.json({
      success: true,
      signedUrl,
      agentId: kiraAgentId,
    });
  } catch (error) {
    console.error('Kira start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
