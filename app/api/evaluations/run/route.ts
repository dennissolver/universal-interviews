// app/api/evaluations/run/route.ts
// Evaluates interview transcripts using Claude AI
// Can process single interview or batch

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVALUATION_PROMPT = `You are an expert qualitative research analyst. Analyze this interview transcript and extract structured insights.

<transcript>
{{TRANSCRIPT}}
</transcript>

<panel_context>
Panel Name: {{PANEL_NAME}}
Panel Description: {{PANEL_DESCRIPTION}}
</panel_context>

Provide your analysis in the following JSON format:

{
  "summary": "2-3 sentence summary of the interview's main points",
  "executive_summary": "1 sentence TL;DR",
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentiment_score": 0.0-1.0 (0=very negative, 0.5=neutral, 1=very positive),
  "sentiment_reasoning": "Brief explanation of sentiment",
  "quality_score": 1-10 (interview depth and usefulness),
  "quality_reasoning": "Brief explanation of quality score",
  "engagement_level": "high" | "medium" | "low",
  "topics": ["topic1", "topic2", ...],
  "pain_points": [
    {"point": "description", "severity": "high"|"medium"|"low", "quote": "relevant quote"}
  ],
  "desires": [
    {"desire": "what they want", "priority": "high"|"medium"|"low", "quote": "relevant quote"}
  ],
  "key_quotes": [
    {"quote": "exact quote", "theme": "what it relates to", "context": "why it matters"}
  ],
  "surprises": ["unexpected insight 1", "unexpected insight 2"],
  "follow_up_worthy": true|false,
  "follow_up_reason": "Why this person should/shouldn't be contacted again",
  "needs_review": true|false,
  "review_reason": "Why a human should review this (if applicable)"
}

Focus on extracting actionable insights. Be specific with quotes - use exact words from the transcript.`;

async function evaluateInterview(
  interviewId: string,
  transcript: string,
  panelName: string,
  panelDescription: string
): Promise<any> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const client = new Anthropic({ apiKey: anthropicKey });
  const startTime = Date.now();

  const prompt = EVALUATION_PROMPT
    .replace('{{TRANSCRIPT}}', transcript)
    .replace('{{PANEL_NAME}}', panelName || 'Unknown Panel')
    .replace('{{PANEL_DESCRIPTION}}', panelDescription || 'No description');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const duration = Date.now() - startTime;
  const content = response.content[0];
  
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  // Parse JSON from response
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  const evaluation = JSON.parse(jsonMatch[0]);
  
  return {
    ...evaluation,
    tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    evaluation_duration_ms: duration,
    model_used: 'claude-sonnet-4-20250514',
    prompt_version: '1.0'
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { interview_id, batch = false, limit = 10 } = body;

    // Single interview evaluation
    if (interview_id && !batch) {
      // Fetch interview with panel info
      const { data: interview, error: fetchError } = await supabase
        .from('interviews')
        .select(`
          id,
          panel_id,
          transcript,
          participant_name,
          agents!interviews_panel_id_fkey (
            name,
            description
          )
        `)
        .eq('id', interview_id)
        .single();

      if (fetchError || !interview) {
        return NextResponse.json(
          { error: 'Interview not found' },
          { status: 404 }
        );
      }

      if (!interview.transcript) {
        return NextResponse.json(
          { error: 'Interview has no transcript' },
          { status: 400 }
        );
      }

      // Check if already evaluated
      const { data: existing } = await supabase
        .from('interview_evaluations')
        .select('id')
        .eq('interview_id', interview_id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Interview already evaluated', evaluation_id: existing.id },
          { status: 409 }
        );
      }

      const agent = Array.isArray(interview.agents) ? interview.agents[0] : interview.agents;
      
      const evaluation = await evaluateInterview(
        interview.id,
        interview.transcript,
        agent?.name || 'Unknown',
        agent?.description || ''
      );

      // Store evaluation
      const { data: stored, error: storeError } = await supabase
        .from('interview_evaluations')
        .insert({
          interview_id: interview.id,
          panel_id: interview.panel_id,
          ...evaluation
        })
        .select()
        .single();

      if (storeError) {
        throw new Error(`Failed to store evaluation: ${storeError.message}`);
      }

      return NextResponse.json({
        success: true,
        evaluation: stored
      });
    }

    // Batch evaluation
    if (batch) {
      // Find interviews without evaluations
      const { data: interviews, error: fetchError } = await supabase
        .from('interviews')
        .select(`
          id,
          panel_id,
          transcript,
          participant_name,
          agents!interviews_panel_id_fkey (
            name,
            description
          )
        `)
        .eq('status', 'completed')
        .not('transcript', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw new Error(`Failed to fetch interviews: ${fetchError.message}`);
      }

      // Filter out already evaluated
      const interviewIds = (interviews || []).map(i => i.id);
      const { data: existingEvals } = await supabase
        .from('interview_evaluations')
        .select('interview_id')
        .in('interview_id', interviewIds);

      const evaluatedIds = new Set((existingEvals || []).map(e => e.interview_id));
      const toEvaluate = (interviews || []).filter(i => !evaluatedIds.has(i.id));

      console.log(`[evaluations] Found ${toEvaluate.length} interviews to evaluate`);

      const results = {
        processed: 0,
        failed: 0,
        errors: [] as string[]
      };

      for (const interview of toEvaluate) {
        try {
          const agent = Array.isArray(interview.agents) ? interview.agents[0] : interview.agents;
          
          const evaluation = await evaluateInterview(
            interview.id,
            interview.transcript!,
            agent?.name || 'Unknown',
            agent?.description || ''
          );

          await supabase
            .from('interview_evaluations')
            .insert({
              interview_id: interview.id,
              panel_id: interview.panel_id,
              ...evaluation
            });

          results.processed++;
          console.log(`[evaluations] Evaluated: ${interview.id}`);
          
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 500));
          
        } catch (err) {
          results.failed++;
          results.errors.push(`${interview.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          console.error(`[evaluations] Failed: ${interview.id}`, err);
        }
      }

      return NextResponse.json({
        success: true,
        ...results
      });
    }

    return NextResponse.json(
      { error: 'Must provide interview_id or set batch=true' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[evaluations] Error:', error);
    return NextResponse.json(
      { error: 'Evaluation failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// GET - Check evaluation status
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const interviewId = searchParams.get('interview_id');

  if (interviewId) {
    const { data, error } = await supabase
      .from('interview_evaluations')
      .select('*')
      .eq('interview_id', interviewId)
      .single();

    if (error || !data) {
      return NextResponse.json({ evaluated: false });
    }

    return NextResponse.json({ evaluated: true, evaluation: data });
  }

  // Overall stats
  const { count: totalInterviews } = await supabase
    .from('interviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { count: evaluatedCount } = await supabase
    .from('interview_evaluations')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    total_completed: totalInterviews || 0,
    evaluated: evaluatedCount || 0,
    pending: (totalInterviews || 0) - (evaluatedCount || 0)
  });
}
