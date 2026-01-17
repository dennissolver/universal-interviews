// app/api/insights/compare/route.ts
// Compare insights across multiple panels
// Used by Kira (Insights Agent) for cross-panel analysis

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { panel_names, panel_ids } = body;

    // Need at least 2 panels to compare
    const names = panel_names || [];
    const ids = panel_ids || [];

    if (names.length < 2 && ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 panels required for comparison' },
        { status: 400 }
      );
    }

    // Resolve panel IDs from names if needed
    let resolvedIds = [...ids];

    if (names.length > 0) {
      for (const name of names) {
        const { data: agent } = await supabase
          .from('agents')
          .select('id')
          .ilike('name', `%${name}%`)
          .single();

        if (agent && !resolvedIds.includes(agent.id)) {
          resolvedIds.push(agent.id);
        }
      }
    }

    if (resolvedIds.length < 2) {
      return NextResponse.json(
        { error: 'Could not find at least 2 matching panels' },
        { status: 404 }
      );
    }

    // Fetch data for each panel
    const panelComparisons: any[] = [];

    for (const panelId of resolvedIds) {
      // Get panel info
      const { data: agent } = await supabase
        .from('agents')
        .select('id, name, description')
        .eq('id', panelId)
        .single();

      if (!agent) continue;

      // Get evaluations
      const { data: evaluations } = await supabase
        .from('interview_evaluations')
        .select('*')
        .eq('panel_id', panelId);

      const evals = evaluations || [];
      
      // Calculate metrics
      const sentimentCounts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
      let totalSentimentScore = 0;
      let sentimentCount = 0;
      let totalQualityScore = 0;
      let qualityCount = 0;
      const topicCounts: Record<string, number> = {};
      const painPointCounts: Record<string, number> = {};

      for (const e of evals) {
        if (e.sentiment && sentimentCounts.hasOwnProperty(e.sentiment)) {
          sentimentCounts[e.sentiment as keyof typeof sentimentCounts]++;
        }
        if (typeof e.sentiment_score === 'number') {
          totalSentimentScore += e.sentiment_score;
          sentimentCount++;
        }
        if (typeof e.quality_score === 'number') {
          totalQualityScore += e.quality_score;
          qualityCount++;
        }
        if (Array.isArray(e.topics)) {
          for (const t of e.topics) {
            topicCounts[t] = (topicCounts[t] || 0) + 1;
          }
        }
        if (Array.isArray(e.pain_points)) {
          for (const pp of e.pain_points) {
            const point = typeof pp === 'string' ? pp : pp.point;
            if (point) painPointCounts[point] = (painPointCounts[point] || 0) + 1;
          }
        }
      }

      panelComparisons.push({
        panel_id: panelId,
        panel_name: agent.name,
        interview_count: evals.length,
        sentiment_breakdown: sentimentCounts,
        positive_percentage: evals.length > 0 
          ? Math.round((sentimentCounts.positive / evals.length) * 100) 
          : 0,
        average_sentiment_score: sentimentCount > 0
          ? Math.round((totalSentimentScore / sentimentCount) * 100) / 100
          : null,
        average_quality_score: qualityCount > 0
          ? Math.round((totalQualityScore / qualityCount) * 10) / 10
          : null,
        top_topics: Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({ topic, count })),
        top_pain_points: Object.entries(painPointCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([point, count]) => ({ point, count }))
      });
    }

    // Generate comparison insights
    const insights: string[] = [];

    if (panelComparisons.length >= 2) {
      // Compare sentiment
      const sorted = [...panelComparisons].sort((a, b) => b.positive_percentage - a.positive_percentage);
      if (sorted[0].positive_percentage - sorted[sorted.length - 1].positive_percentage > 10) {
        insights.push(
          `"${sorted[0].panel_name}" has significantly more positive sentiment (${sorted[0].positive_percentage}%) compared to "${sorted[sorted.length - 1].panel_name}" (${sorted[sorted.length - 1].positive_percentage}%)`
        );
      }

      // Compare volume
      const byVolume = [...panelComparisons].sort((a, b) => b.interview_count - a.interview_count);
      insights.push(
        `"${byVolume[0].panel_name}" has the most interviews (${byVolume[0].interview_count})`
      );

      // Find common topics
      const allTopics = new Set<string>();
      for (const p of panelComparisons) {
        for (const t of p.top_topics) {
          allTopics.add(t.topic);
        }
      }
      
      const commonTopics = Array.from(allTopics).filter(topic =>
        panelComparisons.every(p => p.top_topics.some((t: any) => t.topic === topic))
      );

      if (commonTopics.length > 0) {
        insights.push(`Common topics across panels: ${commonTopics.slice(0, 3).join(', ')}`);
      }
    }

    return NextResponse.json({
      panels_compared: panelComparisons.length,
      comparisons: panelComparisons,
      insights,
      methodology: 'Comparison based on aggregated evaluation data'
    });

  } catch (error) {
    console.error('[insights/compare] Error:', error);
    return NextResponse.json(
      { error: 'Comparison failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
