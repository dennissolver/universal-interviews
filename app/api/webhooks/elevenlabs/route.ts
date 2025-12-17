// app/api/webhooks/elevenlabs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateInterviewReadyPayload,
} from '@/app/lib/interviews/schema';
import {
  createIdempotencyKey,
  enforceLimits,
} from '@/app/lib/interviews/guards';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Extract final message
    const finalText =
      payload?.message?.text ||
      payload?.final_message ||
      payload?.output_text;

    if (!finalText) {
      return NextResponse.json({ status: 'ignored', reason: 'no final message' });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(finalText);
    } catch {
      return NextResponse.json({ status: 'ignored', reason: 'final message not JSON' });
    }

    // Schema validation
    const validation = validateInterviewReadyPayload(parsed);
    if (!validation.valid) {
      await logDeadLetter(parsed, validation.error);
      return NextResponse.json({ status: 'rejected', reason: validation.error });
    }

    const { panel } = validation.data;

    // Guardrail limits
    try {
      enforceLimits(panel);
    } catch (err: any) {
      await logDeadLetter(parsed, err.message);
      return NextResponse.json({ status: 'rejected', reason: err.message });
    }

    // Idempotency
    const idempotencyKey = createIdempotencyKey(parsed);

    const { data: existing } = await supabase
      .from('processed_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      return NextResponse.json({ status: 'duplicate', ignored: true });
    }

    // Create panel
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/tools/create-panel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ELEVENLABS_WEBHOOK_SECRET && {
            'X-Shared-Secret': process.env.ELEVENLABS_WEBHOOK_SECRET,
          }),
        },
        body: JSON.stringify(panel),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      await logDeadLetter(parsed, error);
      throw new Error(`create-panel failed: ${error}`);
    }

    const result = await res.json();

    // Mark event as processed
    await supabase.from('processed_events').insert({
      idempotency_key: idempotencyKey,
      panel_id: result.panelId,
    });

    return NextResponse.json({
      success: true,
      panelId: result.panelId,
      interviewUrl: result.interviewUrl,
    });
  } catch (err: any) {
    await logDeadLetter({ error: err.message }, 'Unhandled webhook failure');
    return NextResponse.json(
      { error: err.message || 'Webhook failed' },
      { status: 500 }
    );
  }
}

/**
 * Dead-letter logging (never throws)
 */
async function logDeadLetter(payload: any, reason: string) {
  try {
    await supabase.from('dead_letter_events').insert({
      source: 'elevenlabs',
      reason,
      payload,
    });
  } catch {
    // Never block execution
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'elevenlabs-webhook',
  });
}
