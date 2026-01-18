// app/api/tools/create-panel/dry-run/route.ts

import { NextRequest, NextResponse } from 'next/server';
import {
  validateInterviewReadyPayload,
} from '@/app/lib/interviews/schema';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const validation = validateInterviewReadyPayload({
    event: 'INTERVIEW_READY',
    version: '1.0',
    panel: body,
  });

  if (!validation.valid) {
    return NextResponse.json(
      { success: false, error: validation.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Dry run successful — payload is valid',
    normalizedPanel: validation.data.panel,
  });
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'create-panel-dry-run',
  });
}
