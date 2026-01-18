// app/api/insights/quotes/route.ts
// Retrieve quotes filtered by theme, sentiment, or panel
// Used by Kira (Insights Agent) for evidence and examples

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { theme, sentiment, panel_name, panel_id, limit = 10 } = body;

    // Build query
    let dbQuery = supabase
      .from('interview_evaluations')
      .select(`
        interview_id,
        panel_id,
        sentiment,
        key_quotes,
        interviews!inner (
          participant_name,
          participant_company,
          completed_at
        ),
        agents:panel_id (
          name
        )
      `)
      .not('key_quotes', 'is', null);

    // Filter by panel
    if (panel_id) {
      dbQuery = dbQuery.eq('panel_id', panel_id);
    }

    // Filter by sentiment
    if (sentiment) {
      dbQuery = dbQuery.eq('sentiment', sentiment);
    }

    const { data: evaluations, error } = await dbQuery;

    if (error) {
      throw new Error(`Failed to fetch quotes: ${error.message}`);
    }

    // Extract and filter quotes
    let allQuotes: any[] = [];

    for (const eval_ of evaluations || []) {
      const interview = Array.isArray(eval_.interviews) ? eval_.interviews[0] : eval_.interviews;
      const agent = Array.isArray(eval_.agents) ? eval_.agents[0] : eval_.agents;
      
      // Filter by panel_name if provided
      if (panel_name && !panel_id) {
        if (!agent?.name?.toLowerCase().includes(panel_name.toLowerCase())) {
          continue;
        }
      }

      if (Array.isArray(eval_.key_quotes)) {
        for (const q of eval_.key_quotes) {
          const quote = typeof q === 'string' ? { quote: q } : q;
          
          // Filter by theme if provided
          if (theme) {
            const quoteTheme = quote.theme?.toLowerCase() || '';
            const quoteText = quote.quote?.toLowerCase() || '';
            const quoteContext = quote.context?.toLowerCase() || '';
            
            if (!quoteTheme.includes(theme.toLowerCase()) && 
                !quoteText.includes(theme.toLowerCase()) &&
                !quoteContext.includes(theme.toLowerCase())) {
              continue;
            }
          }

          allQuotes.push({
            quote: quote.quote,
            theme: quote.theme || null,
            context: quote.context || null,
            participant: interview?.participant_name || interview?.participant_company || 'Anonymous',
            panel_name: agent?.name || 'Unknown Panel',
            panel_id: eval_.panel_id,
            interview_id: eval_.interview_id,
            interview_sentiment: eval_.sentiment,
            completed_at: interview?.completed_at
          });
        }
      }
    }

    // Sort by recency
    allQuotes.sort((a, b) => {
      if (!a.completed_at) return 1;
      if (!b.completed_at) return -1;
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
    });

    // Limit results
    const results = allQuotes.slice(0, limit);

    return NextResponse.json({
      filters: {
        theme: theme || null,
        sentiment: sentiment || null,
        panel_name: panel_name || null,
        panel_id: panel_id || null
      },
      total_found: allQuotes.length,
      returned: results.length,
      quotes: results
    });

  } catch (error) {
    console.error('[insights/quotes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
