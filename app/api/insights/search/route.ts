// app/api/insights/search/route.ts
// Semantic search across interviews and evaluations
// Used by Kira (Insights Agent) to find relevant data

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { query, panel_name, panel_id, sentiment, limit = 10 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Build the search query
    let dbQuery = supabase
      .from('interview_evaluations')
      .select(`
        id,
        interview_id,
        panel_id,
        summary,
        executive_summary,
        sentiment,
        sentiment_score,
        quality_score,
        topics,
        pain_points,
        desires,
        key_quotes,
        created_at,
        interviews!inner (
          id,
          participant_name,
          participant_company,
          completed_at
        ),
        agents:panel_id (
          name,
          slug
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by panel if specified
    if (panel_id) {
      dbQuery = dbQuery.eq('panel_id', panel_id);
    }

    // Filter by sentiment if specified
    if (sentiment) {
      dbQuery = dbQuery.eq('sentiment', sentiment);
    }

    const { data: evaluations, error } = await dbQuery;

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    // If panel_name provided, filter by it
    let results = evaluations || [];
    if (panel_name && !panel_id) {
      results = results.filter((e: any) => {
        const agent = Array.isArray(e.agents) ? e.agents[0] : e.agents;
        return agent?.name?.toLowerCase().includes(panel_name.toLowerCase());
      });
    }

    // Text search scoring (simple keyword matching)
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

    const scored = results.map((eval_: any) => {
      let score = 0;
      const searchText = [
        eval_.summary,
        eval_.executive_summary,
        JSON.stringify(eval_.topics),
        JSON.stringify(eval_.pain_points),
        JSON.stringify(eval_.desires),
        JSON.stringify(eval_.key_quotes)
      ].join(' ').toLowerCase();

      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          score += 1;
        }
      }

      // Exact phrase match bonus
      if (searchText.includes(queryLower)) {
        score += 5;
      }

      return { ...eval_, relevance_score: score };
    });

    // Sort by relevance
    scored.sort((a, b) => b.relevance_score - a.relevance_score);

    // Filter to only relevant results
    const relevant = scored.filter(r => r.relevance_score > 0).slice(0, limit);

    // Format response for Kira
    const formatted = relevant.map((r: any) => {
      const interview = Array.isArray(r.interviews) ? r.interviews[0] : r.interviews;
      const agent = Array.isArray(r.agents) ? r.agents[0] : r.agents;
      
      return {
        interview_id: r.interview_id,
        panel_name: agent?.name || 'Unknown Panel',
        participant: interview?.participant_name || interview?.participant_company || 'Anonymous',
        completed_at: interview?.completed_at,
        summary: r.summary,
        sentiment: r.sentiment,
        sentiment_score: r.sentiment_score,
        quality_score: r.quality_score,
        topics: r.topics,
        pain_points: r.pain_points,
        desires: r.desires,
        key_quotes: r.key_quotes?.slice(0, 3),
        relevance_score: r.relevance_score
      };
    });

    return NextResponse.json({
      query,
      results_count: formatted.length,
      results: formatted,
      filters_applied: {
        panel_name: panel_name || null,
        panel_id: panel_id || null,
        sentiment: sentiment || null
      }
    });

  } catch (error) {
    console.error('[insights/search] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
