// app/api/dev/interview/dry-run/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  validateInterviewReadyPayload,
} from '@/app/lib/interviews/schema';
import {
  enforceLimits,
  createIdempotencyKey,
} from '@/app/lib/interviews/guards';

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Step 1: Schema validation
  const validation = validateInterviewReadyPayload(payload);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        stage: 'schema',
        error: validation.error,
      },
      { status: 400 }
    );
  }

  const { panel } = validation.data;

  // Step 2: Guardrail validation
  try {
    enforceLimits(panel);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        stage: 'guardrails',
        error: err.message,
      },
      { status: 400 }
    );
  }

  // Step 3: Deterministic idempotency key
  const idempotencyKey = createIdempotencyKey(payload);

  // Step 4: Show exactly what would be sent to create-panel
  return NextResponse.json({
    success: true,
    message: 'Dry run successful — payload is production safe',
    idempotencyKey,
    createPanelPayload: panel,
    nextStep: 'POST /api/tools/create-panel',
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'dev-interview-dry-run',
  });
}
