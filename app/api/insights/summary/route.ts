// app/api/insights/summary/route.ts
// Aggregated insights for a panel
// Used by Kira (Insights Agent) for panel overviews

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { panel_name, panel_id } = body;

    // Find the panel
    let actualPanelId = panel_id;
    let panelInfo: any = null;

    if (!actualPanelId && panel_name) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, description, total_interviews, completed_interviews')
        .ilike('name', `%${panel_name}%`)
        .single();

      if (agent) {
        actualPanelId = agent.id;
        panelInfo = agent;
      }
    } else if (actualPanelId) {
      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, description, total_interviews, completed_interviews')
        .eq('id', actualPanelId)
        .single();

      panelInfo = agent;
    }

    if (!actualPanelId) {
      // Return summary of all panels
      const { data: allEvals } = await supabase
        .from('interview_evaluations')
        .select('*');

      const summary = aggregateEvaluations(allEvals || []);
      
      return NextResponse.json({
        scope: 'all_panels',
        ...summary
      });
    }

    // Get evaluations for this panel
    const { data: evaluations, error } = await supabase
      .from('interview_evaluations')
      .select(`
        *,
        interviews!inner (
          participant_name,
          participant_company,
          completed_at
        )
      `)
      .eq('panel_id', actualPanelId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch evaluations: ${error.message}`);
    }

    const summary = aggregateEvaluations(evaluations || []);

    return NextResponse.json({
      panel_id: actualPanelId,
      panel_name: panelInfo?.name || 'Unknown',
      panel_description: panelInfo?.description || '',
      total_interviews: panelInfo?.total_interviews || 0,
      completed_interviews: panelInfo?.completed_interviews || 0,
      evaluated_interviews: evaluations?.length || 0,
      ...summary
    });

  } catch (error) {
    console.error('[insights/summary] Error:', error);
    return NextResponse.json(
      { error: 'Summary failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

function aggregateEvaluations(evaluations: any[]): any {
  if (!evaluations || evaluations.length === 0) {
    return {
      sentiment_breakdown: { positive: 0, negative: 0, neutral: 0, mixed: 0 },
      average_sentiment_score: null,
      average_quality_score: null,
      top_topics: [],
      top_pain_points: [],
      top_desires: [],
      notable_quotes: [],
      follow_up_candidates: 0,
      needs_review_count: 0
    };
  }

  // Sentiment breakdown
  const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  let totalSentimentScore = 0;
  let sentimentScoreCount = 0;
  let totalQualityScore = 0;
  let qualityScoreCount = 0;

  // Aggregated data
  const topicCounts: Record<string, number> = {};
  const painPointCounts: Record<string, { count: number; severity: string; quotes: string[] }> = {};
  const desireCounts: Record<string, { count: number; priority: string; quotes: string[] }> = {};
  const allQuotes: any[] = [];
  let followUpCount = 0;
  let reviewCount = 0;

  for (const eval_ of evaluations) {
    // Sentiment
    if (eval_.sentiment && sentimentCounts.hasOwnProperty(eval_.sentiment)) {
      sentimentCounts[eval_.sentiment as keyof typeof sentimentCounts]++;
    }
    if (typeof eval_.sentiment_score === 'number') {
      totalSentimentScore += eval_.sentiment_score;
      sentimentScoreCount++;
    }
    if (typeof eval_.quality_score === 'number') {
      totalQualityScore += eval_.quality_score;
      qualityScoreCount++;
    }

    // Topics
    if (Array.isArray(eval_.topics)) {
      for (const topic of eval_.topics) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }

    // Pain points
    if (Array.isArray(eval_.pain_points)) {
      for (const pp of eval_.pain_points) {
        const point = typeof pp === 'string' ? pp : pp.point;
        if (point) {
          if (!painPointCounts[point]) {
            painPointCounts[point] = { count: 0, severity: pp.severity || 'medium', quotes: [] };
          }
          painPointCounts[point].count++;
          if (pp.quote) painPointCounts[point].quotes.push(pp.quote);
        }
      }
    }

    // Desires
    if (Array.isArray(eval_.desires)) {
      for (const d of eval_.desires) {
        const desire = typeof d === 'string' ? d : d.desire;
        if (desire) {
          if (!desireCounts[desire]) {
            desireCounts[desire] = { count: 0, priority: d.priority || 'medium', quotes: [] };
          }
          desireCounts[desire].count++;
          if (d.quote) desireCounts[desire].quotes.push(d.quote);
        }
      }
    }

    // Quotes
    if (Array.isArray(eval_.key_quotes)) {
      for (const q of eval_.key_quotes) {
        allQuotes.push({
          ...q,
          interview_id: eval_.interview_id,
          sentiment: eval_.sentiment
        });
      }
    }

    // Flags
    if (eval_.follow_up_worthy) followUpCount++;
    if (eval_.needs_review) reviewCount++;
  }

  // Sort and take top items
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, count, percentage: Math.round((count / evaluations.length) * 100) }));

  const topPainPoints = Object.entries(painPointCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([point, data]) => ({
      point,
      count: data.count,
      severity: data.severity,
      percentage: Math.round((data.count / evaluations.length) * 100),
      example_quote: data.quotes[0] || null
    }));

  const topDesires = Object.entries(desireCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([desire, data]) => ({
      desire,
      count: data.count,
      priority: data.priority,
      percentage: Math.round((data.count / evaluations.length) * 100),
      example_quote: data.quotes[0] || null
    }));

  // Notable quotes (high quality, diverse sentiment)
  const notableQuotes = allQuotes
    .slice(0, 10)
    .map(q => ({
      quote: q.quote,
      theme: q.theme,
      context: q.context,
      sentiment: q.sentiment
    }));

  return {
    interview_count: evaluations.length,
    sentiment_breakdown: sentimentCounts,
    sentiment_percentages: {
      positive: Math.round((sentimentCounts.positive / evaluations.length) * 100),
      negative: Math.round((sentimentCounts.negative / evaluations.length) * 100),
      neutral: Math.round((sentimentCounts.neutral / evaluations.length) * 100),
      mixed: Math.round((sentimentCounts.mixed / evaluations.length) * 100)
    },
    average_sentiment_score: sentimentScoreCount > 0 
      ? Math.round((totalSentimentScore / sentimentScoreCount) * 100) / 100 
      : null,
    average_quality_score: qualityScoreCount > 0
      ? Math.round((totalQualityScore / qualityScoreCount) * 10) / 10
      : null,
    top_topics: topTopics,
    top_pain_points: topPainPoints,
    top_desires: topDesires,
    notable_quotes: notableQuotes,
    follow_up_candidates: followUpCount,
    needs_review_count: reviewCount
  };
}

// GET for simple panel summary
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const panelId = searchParams.get('panel_id');

  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ panel_id: panelId })
  }));
}
