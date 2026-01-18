// app/api/kira/tools/route.ts
// Handles Kira's tool calls from ElevenLabs

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

async function listPanels(params: { status?: string }) {
  const supabase = getSupabase();
  const status = params.status || 'active';

  let query = supabase
    .from('agents')
    .select('id, name, slug, description, status, research_goal, target_audience, total_interviews, completed_interviews, created_at');

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  const panels = data ?? [];

  return {
    panel_count: panels.length,
    panels: panels.map(p => ({
      name: p.name,
      id: p.id,
      description: p.description,
      research_goal: p.research_goal,
      target_audience: p.target_audience,
      status: p.status,
      total_interviews: p.total_interviews,
      completed_interviews: p.completed_interviews,
      created: p.created_at
    }))
  };
}

async function getPanel(params: { panel_name?: string; panel_id?: string }) {
  const supabase = getSupabase();
  let query = supabase
    .from('agents')
    .select('*');

  if (params.panel_id) {
    query = query.eq('id', params.panel_id);
  } else if (params.panel_name) {
    query = query.ilike('name', `%${params.panel_name}%`);
  } else {
    throw new Error('Please provide either panel_name or panel_id');
  }

  const { data, error } = await query.single();

  if (error) throw error;
  if (!data) throw new Error('Panel not found');

  const { data: evalsData } = await supabase
    .from('interview_evaluations')
    .select('sentiment, quality_score, summary')
    .eq('panel_id', data.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const evals = evalsData ?? [];

  return {
    name: data.name,
    id: data.id,
    description: data.description,
    status: data.status,
    research_goal: data.research_goal,
    target_audience: data.target_audience,
    interview_context: data.interview_context,
    questions: data.questions,
    interviewer_tone: data.interviewer_tone,
    estimated_duration_mins: data.estimated_duration_mins,
    total_interviews: data.total_interviews,
    completed_interviews: data.completed_interviews,
    created_at: data.created_at,
    recent_evaluations: evals
  };
}

async function listInterviews(params: {
  panel_name?: string;
  status?: string;
  limit?: number;
  days_back?: number;
}) {
  const supabase = getSupabase();
  const limit = params.limit || 20;
  const status = params.status || 'completed';

  let query = supabase
    .from('interviews')
    .select(`
      id,
      participant_name,
      participant_company,
      participant_role,
      participant_country,
      status,
      duration_seconds,
      completed_at,
      evaluated,
      panel_id,
      agents!inner(name)
    `)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (params.days_back) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.days_back);
    query = query.gte('completed_at', cutoff.toISOString());
  }

  if (params.panel_name) {
    query = query.ilike('agents.name', `%${params.panel_name}%`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const interviews = data ?? [];
  const interviewIds = interviews.map(i => i.id);

  let evalMap = new Map<string, any>();

  if (interviewIds.length > 0) {
    const { data: evalsData } = await supabase
      .from('interview_evaluations')
      .select('interview_id, sentiment, quality_score, executive_summary')
      .in('interview_id', interviewIds);

    const evals = evalsData ?? [];
    evalMap = new Map(evals.map(e => [e.interview_id, e]));
  }

  return {
    interview_count: interviews.length,
    interviews: interviews.map(i => {
      const evaluation = evalMap.get(i.id);
      return {
        id: i.id,
        participant_name: i.participant_name,
        participant_company: i.participant_company,
        participant_role: i.participant_role,
        location: i.participant_country,
        panel_name: (i as any).agents?.name,
        status: i.status,
        duration_minutes: i.duration_seconds ? Math.round(i.duration_seconds / 60) : null,
        completed_at: i.completed_at,
        sentiment: evaluation?.sentiment,
        quality_score: evaluation?.quality_score,
        summary: evaluation?.executive_summary
      };
    })
  };
}

async function getInterview(params: {
  interview_id?: string;
  participant_name?: string;
  participant_email?: string;
}) {
  const supabase = getSupabase();
  let query = supabase
    .from('interviews')
    .select(`
      *,
      agents(name, research_goal, questions)
    `);

  if (params.interview_id) {
    query = query.eq('id', params.interview_id);
  } else if (params.participant_email) {
    query = query.ilike('participant_email', `%${params.participant_email}%`);
  } else if (params.participant_name) {
    query = query.ilike('participant_name', `%${params.participant_name}%`);
  } else {
    throw new Error('Please provide interview_id, participant_name, or participant_email');
  }

  const { data: interview, error } = await query.single();

  if (error) throw error;
  if (!interview) throw new Error('Interview not found');

  const { data: transcript } = await supabase
    .from('interview_transcripts')
    .select('transcript_text, analysis')
    .eq('interview_id', interview.id)
    .single();

  const { data: evaluation } = await supabase
    .from('interview_evaluations')
    .select('*')
    .eq('interview_id', interview.id)
    .single();

  return {
    id: interview.id,
    participant: {
      name: interview.participant_name,
      email: interview.participant_email,
      company: interview.participant_company,
      role: interview.participant_role,
      country: interview.participant_country
    },
    panel_name: (interview as any).agents?.name,
    research_goal: (interview as any).agents?.research_goal,
    questions_asked: (interview as any).agents?.questions,
    status: interview.status,
    duration_minutes: interview.duration_seconds ? Math.round(interview.duration_seconds / 60) : null,
    started_at: interview.started_at,
    completed_at: interview.completed_at,
    transcript: transcript?.transcript_text ?? null,
    analysis: transcript?.analysis ?? null,
    evaluation: evaluation ? {
      summary: evaluation.summary,
      executive_summary: evaluation.executive_summary,
      sentiment: evaluation.sentiment,
      sentiment_score: evaluation.sentiment_score,
      quality_score: evaluation.quality_score,
      key_quotes: evaluation.key_quotes,
      topics: evaluation.topics,
      pain_points: evaluation.pain_points,
      desires: evaluation.desires,
      follow_up_worthy: evaluation.follow_up_worthy,
      follow_up_reason: evaluation.follow_up_reason
    } : null
  };
}

async function searchTranscripts(params: {
  query: string;
  panel_name?: string;
  limit?: number;
}) {
  const supabase = getSupabase();
  const limit = params.limit || 10;
  const searchQuery = params.query.toLowerCase();

  const query = supabase
    .from('interview_transcripts')
    .select(`
      id,
      interview_id,
      transcript_text,
      participant_name,
      interviews!inner(
        panel_id,
        participant_company,
        completed_at,
        agents!inner(name)
      )
    `)
    .not('transcript_text', 'is', null)
    .limit(50);

  const { data, error } = await query;

  if (error) throw error;

  const transcripts = data ?? [];
  const results: any[] = [];

  for (const t of transcripts) {
    if (!t.transcript_text) continue;

    if (params.panel_name) {
      const panelName = (t as any).interviews?.agents?.name?.toLowerCase() ?? '';
      if (!panelName.includes(params.panel_name.toLowerCase())) continue;
    }

    const text = t.transcript_text.toLowerCase();
    const index = text.indexOf(searchQuery);

    if (index !== -1) {
      const start = Math.max(0, index - 150);
      const end = Math.min(text.length, index + searchQuery.length + 150);
      const excerpt = t.transcript_text.substring(start, end);

      results.push({
        interview_id: t.interview_id,
        participant_name: t.participant_name,
        participant_company: (t as any).interviews?.participant_company,
        panel_name: (t as any).interviews?.agents?.name,
        completed_at: (t as any).interviews?.completed_at,
        excerpt: (start > 0 ? '...' : '') + excerpt + (end < text.length ? '...' : ''),
        match_position: index
      });

      if (results.length >= limit) break;
    }
  }

  return {
    query: params.query,
    result_count: results.length,
    matches: results
  };
}

async function getStatistics(params: {
  panel_name?: string;
  metric?: string;
  days_back?: number;
}) {
  const supabase = getSupabase();
  const daysBack = params.days_back || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  let panelId: string | null = null;
  if (params.panel_name) {
    const { data: panel } = await supabase
      .from('agents')
      .select('id')
      .ilike('name', `%${params.panel_name}%`)
      .single();
    panelId = panel?.id ?? null;
  }

  let interviewQuery = supabase
    .from('interviews')
    .select('status, duration_seconds, completed_at', { count: 'exact' });

  if (panelId) {
    interviewQuery = interviewQuery.eq('panel_id', panelId);
  }

  const { data: interviewsData, count: totalCount } = await interviewQuery;

  const interviews = interviewsData ?? [];
  const completedCount = interviews.filter(i => i.status === 'completed').length;
  const interviewsWithDuration = interviews.filter(i => i.duration_seconds);
  const avgDuration = interviewsWithDuration.length > 0
    ? interviewsWithDuration.reduce((sum, i) => sum + (i.duration_seconds || 0), 0) / interviewsWithDuration.length
    : 0;

  let evalQuery = supabase
    .from('interview_evaluations')
    .select('sentiment, quality_score, created_at');

  if (panelId) {
    evalQuery = evalQuery.eq('panel_id', panelId);
  }

  const { data: evalsData } = await evalQuery;

  const evals = evalsData ?? [];

  const sentimentCounts = {
    positive: evals.filter(e => e.sentiment === 'positive').length,
    neutral: evals.filter(e => e.sentiment === 'neutral').length,
    negative: evals.filter(e => e.sentiment === 'negative').length,
    mixed: evals.filter(e => e.sentiment === 'mixed').length
  };

  const evalsWithQuality = evals.filter(e => e.quality_score != null);
  const avgQuality = evalsWithQuality.length > 0
    ? evalsWithQuality.reduce((sum, e) => sum + (e.quality_score || 0), 0) / evalsWithQuality.length
    : 0;

  let panelCount = 1;
  if (!panelId) {
    const { count } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    panelCount = count ?? 0;
  }

  return {
    scope: params.panel_name || 'All Panels',
    period_days: daysBack,
    panels: panelCount,
    interviews: {
      total: totalCount ?? 0,
      completed: completedCount,
      completion_rate: totalCount ? Math.round((completedCount / totalCount) * 100) : 0,
      average_duration_minutes: Math.round(avgDuration / 60)
    },
    sentiment: sentimentCounts,
    quality: {
      average_score: Math.round(avgQuality),
      evaluated_count: evals.length
    }
  };
}

async function recallMemory(params: {
  query: string;
  memory_type?: string;
  panel_name?: string;
}) {
  const supabase = getSupabase();
  const searchQuery = params.query.toLowerCase();

  let query = supabase
    .from('kira_memory')
    .select('*')
    .eq('active', true)
    .order('importance', { ascending: false })
    .limit(10);

  if (params.memory_type && params.memory_type !== 'all') {
    query = query.eq('memory_type', params.memory_type);
  }

  const { data, error } = await query;

  if (error) throw error;

  const memories = data ?? [];

  const matches = memories.filter(m =>
    m.content.toLowerCase().includes(searchQuery) ||
    (m.title?.toLowerCase().includes(searchQuery)) ||
    (m.tags as string[] ?? []).some((t: string) => t.toLowerCase().includes(searchQuery))
  );

  for (const memory of matches) {
    await supabase
      .from('kira_memory')
      .update({
        last_recalled_at: new Date().toISOString(),
        recall_count: (memory.recall_count || 0) + 1
      })
      .eq('id', memory.id);
  }

  return {
    query: params.query,
    memories_found: matches.length,
    memories: matches.map(m => ({
      id: m.id,
      type: m.memory_type,
      title: m.title,
      content: m.content,
      importance: m.importance,
      tags: m.tags,
      created_at: m.created_at,
      recall_count: m.recall_count
    }))
  };
}

async function saveMemory(params: {
  memory_type: string;
  title?: string;
  content: string;
  importance?: number;
  tags?: string[];
  related_panel?: string;
}, sessionId?: string) {
  const supabase = getSupabase();
  let panelId: string | null = null;

  if (params.related_panel) {
    const { data: panel } = await supabase
      .from('agents')
      .select('id')
      .ilike('name', `%${params.related_panel}%`)
      .single();
    panelId = panel?.id ?? null;
  }

  const { data, error } = await supabase
    .from('kira_memory')
    .insert({
      memory_type: params.memory_type,
      title: params.title,
      content: params.content,
      importance: params.importance || 5,
      tags: params.tags || [],
      related_panels: panelId ? [panelId] : [],
      source_session_id: sessionId
    })
    .select()
    .single();

  if (error) throw error;

  return {
    saved: true,
    memory_id: data.id,
    message: `I've saved this ${params.memory_type}: "${params.title || params.content.substring(0, 50)}..."`
  };
}

async function getThemes(params: {
  panel_name?: string;
  theme_type?: string;
  min_frequency?: number;
}) {
  const supabase = getSupabase();
  let panelId: string | null = null;

  if (params.panel_name) {
    const { data: panel } = await supabase
      .from('agents')
      .select('id')
      .ilike('name', `%${params.panel_name}%`)
      .single();
    panelId = panel?.id ?? null;
  }

  let insightsQuery = supabase
    .from('panel_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (panelId) {
    insightsQuery = insightsQuery.eq('panel_id', panelId);
  }

  const { data: insightsData } = await insightsQuery;

  const insights = insightsData ?? [];

  if (insights.length > 0) {
    const insight = insights[0];
    const themeType = params.theme_type || 'all';

    return {
      panel: params.panel_name || 'All Panels',
      interview_count: insight.interview_count,
      generated_at: insight.created_at,
      themes: themeType === 'all' || themeType === 'topics' ? insight.top_themes : undefined,
      pain_points: themeType === 'all' || themeType === 'pain_points' ? insight.common_pain_points : undefined,
      desires: themeType === 'all' || themeType === 'desires' ? insight.common_desires : undefined,
      key_quotes: themeType === 'all' || themeType === 'quotes' ? insight.curated_quotes : undefined,
      executive_summary: insight.executive_summary,
      recommendations: insight.recommendations
    };
  }

  let evalQuery = supabase
    .from('interview_evaluations')
    .select('topics, pain_points, desires, key_quotes');

  if (panelId) {
    evalQuery = evalQuery.eq('panel_id', panelId);
  }

  const { data: evalsData } = await evalQuery;

  const evals = evalsData ?? [];

  const topicCounts = new Map<string, number>();
  const painPoints: any[] = [];
  const desires: any[] = [];
  const quotes: any[] = [];

  for (const e of evals) {
    const topics = (e.topics as string[]) ?? [];
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
    painPoints.push(...((e.pain_points as any[]) ?? []));
    desires.push(...((e.desires as any[]) ?? []));
    quotes.push(...((e.key_quotes as any[]) ?? []));
  }

  const minFreq = params.min_frequency ?? 1;
  const sortedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= minFreq)
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, frequency: count }));

  return {
    panel: params.panel_name || 'All Panels',
    interview_count: evals.length,
    top_topics: sortedTopics,
    pain_points: painPoints.slice(0, 10),
    desires: desires.slice(0, 10),
    notable_quotes: quotes.slice(0, 10)
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { tool_name, parameters, conversation_id } = body;

    if (!tool_name) {
      return NextResponse.json(
        { error: 'Missing tool_name' },
        { status: 400 }
      );
    }

    console.log(`[Kira Tools] ${tool_name}`, parameters);

    let result: any;
    const startTime = Date.now();

    switch (tool_name) {
      case 'list_panels':
        result = await listPanels(parameters || {});
        break;
      case 'get_panel':
        result = await getPanel(parameters || {});
        break;
      case 'list_interviews':
        result = await listInterviews(parameters || {});
        break;
      case 'get_interview':
        result = await getInterview(parameters || {});
        break;
      case 'search_transcripts':
        result = await searchTranscripts(parameters || {});
        break;
      case 'get_statistics':
        result = await getStatistics(parameters || {});
        break;
      case 'recall_memory':
        result = await recallMemory(parameters || {});
        break;
      case 'save_memory':
        result = await saveMemory(parameters || {}, conversation_id);
        break;
      case 'get_themes':
        result = await getThemes(parameters || {});
        break;
      default:
        return NextResponse.json(
          { error: `Unknown tool: ${tool_name}` },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;

    // Log tool usage (fire and forget)
    if (conversation_id) {
      supabase.from('kira_tool_log').insert({
        tool_name,
        parameters,
        duration_ms: duration,
        success: true,
        result_summary: JSON.stringify(result).substring(0, 200)
      });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Kira Tools] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Tool execution failed' },
      { status: 500 }
    );
  }
}

