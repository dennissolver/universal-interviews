// app/panels/[panelId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import KiraVoiceButton from '../../components/KiraVoiceButton';

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  total_interviews: number;
  completed_interviews: number;
  elevenlabs_agent_id: string;
  created_at: string;
}

interface Interview {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  word_count?: number;
  transcript: string | null;
  participant_name: string | null;
  participant_company: string | null;
  created_at: string;
}

interface PanelInsights {
  interview_count: number;
  sentiment_breakdown?: { positive: number; negative: number; neutral: number; mixed: number };
  sentiment_percentages?: { positive: number; negative: number; neutral: number; mixed: number };
  average_sentiment_score: number | null;
  average_quality_score: number | null;
  top_topics: { topic: string; count: number; percentage: number }[];
  top_pain_points: { point: string; count: number; percentage: number; example_quote: string | null }[];
  top_desires: { desire: string; count: number; percentage: number; example_quote: string | null }[];
  notable_quotes: { quote: string; theme: string; context: string }[];
  follow_up_candidates: number;
  needs_review_count: number;
}

interface Evaluation {
  id: string;
  interview_id: string;
  summary: string;
  sentiment: string;
  sentiment_score: number;
  quality_score: number;
  topics: string[];
  pain_points: any[];
  desires: any[];
  key_quotes: any[];
}

export default function PanelDashboardPage() {
  const params = useParams();
  const panelId = params.panelId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [insights, setInsights] = useState<PanelInsights | null>(null);
  const [evaluations, setEvaluations] = useState<Map<string, Evaluation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'interviews' | 'quotes'>('overview');

  useEffect(() => {
    async function fetchData() {
      try {
        const agentRes = await fetch(`/api/agents/${panelId}`);
        if (!agentRes.ok) throw new Error('Panel not found');
        const agentData = await agentRes.json();
        setAgent(agentData.agent);

        const interviewsRes = await fetch(`/api/panels/${agentData.agent.id}/interviews`);
        if (interviewsRes.ok) {
          const interviewsData = await interviewsRes.json();
          setInterviews(interviewsData.interviews || []);
        }

        const insightsRes = await fetch('/api/insights/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ panel_id: agentData.agent.id })
        });
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          setInsights(insightsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load panel');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [panelId]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-emerald-400';
      case 'negative': return 'text-red-400';
      case 'mixed': return 'text-amber-400';
      default: return 'text-zinc-400';
    }
  };

  const openInterview = async (interview: Interview) => {
    setSelectedInterview(interview);
    
    if (!evaluations.has(interview.id)) {
      const res = await fetch(`/api/evaluations/run?interview_id=${interview.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.evaluated && data.evaluation) {
          setEvaluations(prev => new Map(prev).set(interview.id, data.evaluation));
          setSelectedEvaluation(data.evaluation);
        }
      }
    } else {
      setSelectedEvaluation(evaluations.get(interview.id) || null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading panel...
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg">{error || 'Panel not found'}</div>
        <Link href="/dashboard" className="text-violet-400 hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  const completedInterviews = interviews.filter(i => i.status === 'completed');
  const avgDuration = completedInterviews.length > 0
    ? Math.round(completedInterviews.reduce((acc, i) => acc + (i.duration_seconds || 0), 0) / completedInterviews.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-fuchsia-950/20 pointer-events-none" />
      
      {/* Header */}
      <div className="relative border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
            <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-zinc-300">{agent.name}</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-2">{agent.name}</h1>
              {agent.description && (
                <p className="text-zinc-500 max-w-2xl">{agent.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <KiraVoiceButton panelId={agent.id} panelName={agent.name} />
              <Link
                href={`/panel/${agent.id}/invite`}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors"
              >
                Invite Participants
              </Link>
              <a
                href={`/i/${agent.slug || agent.id}`}
                target="_blank"
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Interview Link
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
            <div className="text-3xl font-semibold">{agent.total_interviews || 0}</div>
            <div className="text-sm text-zinc-500">Total</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
            <div className="text-3xl font-semibold text-emerald-400">{agent.completed_interviews || 0}</div>
            <div className="text-sm text-zinc-500">Completed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
            <div className="text-3xl font-semibold">
              {agent.total_interviews ? Math.round((agent.completed_interviews / agent.total_interviews) * 100) : 0}%
            </div>
            <div className="text-sm text-zinc-500">Completion</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
            <div className="text-3xl font-semibold">{formatDuration(avgDuration)}</div>
            <div className="text-sm text-zinc-500">Avg Duration</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5">
            <div className="text-3xl font-semibold text-violet-400">{insights?.interview_count || 0}</div>
            <div className="text-sm text-zinc-500">Analyzed</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-zinc-900/30 p-1 rounded-xl w-fit">
          {(['overview', 'interviews', 'quotes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && insights?.sentiment_percentages && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Overview Description */}
            <div className="md:col-span-2 p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl mb-2">
              <p className="text-sm text-zinc-400">
                AI-analyzed insights from your interviews. Sentiment, themes, pain points, and desires are automatically extracted from each conversation.
              </p>
            </div>

            {/* Sentiment */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Sentiment Distribution</h3>
              <div className="space-y-3">
                {(['positive', 'negative', 'neutral', 'mixed'] as const).map(sentiment => (
                  <div key={sentiment} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-zinc-400 capitalize">{sentiment}</div>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          sentiment === 'positive' ? 'bg-emerald-500' :
                          sentiment === 'negative' ? 'bg-red-500' :
                          sentiment === 'mixed' ? 'bg-amber-500' : 'bg-zinc-500'
                        }`}
                        style={{ width: `${insights?.sentiment_percentages?.[sentiment] ?? 0}%` }}
                      />
                    </div>
                    <div className="w-12 text-sm text-zinc-500 text-right">
                      {insights?.sentiment_percentages?.[sentiment] ?? 0}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Quality Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-semibold text-emerald-400">
                    {insights?.average_sentiment_score?.toFixed(2) || '-'}
                  </div>
                  <div className="text-sm text-zinc-500">Avg Sentiment (0-1)</div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-semibold text-violet-400">
                    {insights?.average_quality_score?.toFixed(1) || '-'}
                  </div>
                  <div className="text-sm text-zinc-500">Avg Quality (1-10)</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between text-sm">
                <span className="text-zinc-500">{insights?.follow_up_candidates || 0} follow-up candidates</span>
                <span className="text-zinc-500">{insights?.needs_review_count || 0} need review</span>
              </div>
            </div>

            {/* Top Topics */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Top Topics</h3>
              {!insights?.top_topics?.length ? (
                <p className="text-zinc-500 text-sm">No topics analyzed yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {insights.top_topics.map((t, i) => (
                    <span key={i} className="px-3 py-1.5 bg-violet-500/20 text-violet-300 rounded-lg text-sm">
                      {t.topic} ({t.count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Pain Points */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Top Pain Points</h3>
              {!insights?.top_pain_points?.length ? (
                <p className="text-zinc-500 text-sm">No pain points identified yet</p>
              ) : (
                <div className="space-y-3">
                  {insights.top_pain_points.slice(0, 5).map((pp, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-red-400 mt-0.5">•</span>
                      <div>
                        <div className="text-sm">{pp.point}</div>
                        <div className="text-xs text-zinc-500">{pp.percentage}% of interviews</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desires */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Top Desires</h3>
              {!insights?.top_desires?.length ? (
                <p className="text-zinc-500 text-sm">No desires identified yet</p>
              ) : (
                <div className="space-y-3">
                  {insights.top_desires.slice(0, 5).map((d, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <div>
                        <div className="text-sm">{d.desire}</div>
                        <div className="text-xs text-zinc-500">{d.percentage}% of interviews</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notable Quotes */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
              <h3 className="font-medium mb-4">Notable Quotes</h3>
              {!insights?.notable_quotes?.length ? (
                <p className="text-zinc-500 text-sm">No quotes extracted yet</p>
              ) : (
                <div className="space-y-4">
                  {insights.notable_quotes.slice(0, 3).map((q, i) => (
                    <blockquote key={i} className="border-l-2 border-violet-500 pl-4">
                      <p className="text-sm italic text-zinc-300">"{q.quote}"</p>
                      {q.theme && <cite className="text-xs text-zinc-500 not-italic">— {q.theme}</cite>}
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No insights message */}
        {activeTab === 'overview' && !insights?.sentiment_percentages && (
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No insights yet</h3>
            <p className="text-zinc-500 mb-6 max-w-md mx-auto">
              Complete some interviews and run the evaluation to see insights here. The AI analyzes each transcript to extract sentiment, topics, pain points, desires, and memorable quotes.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium"
            >
              Run Evaluations
            </Link>
          </div>
        )}

        {/* Interviews Tab */}
        {activeTab === 'interviews' && (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl overflow-hidden">
            {interviews.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-4xl mb-3">🎤</div>
                <p className="text-zinc-400">No interviews yet</p>
                <p className="text-zinc-500 text-sm mt-1">Share the interview link to start collecting responses</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {interviews.map((interview) => (
                  <div
                    key={interview.id}
                    onClick={() => openInterview(interview)}
                    className="px-6 py-4 hover:bg-zinc-800/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 text-xs rounded-lg border ${getStatusColor(interview.status)}`}>
                          {interview.status.replace('_', ' ')}
                        </span>
                        <div>
                          <div className="font-medium">
                            {interview.participant_name || interview.participant_company || `Interview ${interview.id.slice(0, 8)}`}
                          </div>
                          <div className="text-sm text-zinc-500">
                            {interview.completed_at
                              ? new Date(interview.completed_at).toLocaleString()
                              : new Date(interview.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <div className="font-medium">{formatDuration(interview.duration_seconds)}</div>
                          <div className="text-zinc-500 text-xs">duration</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{interview.word_count || '-'}</div>
                          <div className="text-zinc-500 text-xs">words</div>
                        </div>
                        <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quotes Tab */}
        {activeTab === 'quotes' && (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-6">
            {insights?.notable_quotes && insights.notable_quotes.length > 0 ? (
              <div className="space-y-6">
                {insights.notable_quotes.map((q, i) => (
                  <blockquote key={i} className="border-l-2 border-violet-500 pl-6 py-2">
                    <p className="text-lg italic text-zinc-200">"{q.quote}"</p>
                    <div className="mt-2 flex items-center gap-4">
                      {q.theme && (
                        <span className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded text-xs">{q.theme}</span>
                      )}
                      {q.context && (
                        <span className="text-sm text-zinc-500">{q.context}</span>
                      )}
                    </div>
                  </blockquote>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-500">No quotes extracted yet. Run evaluations to extract key quotes.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interview Detail Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-zinc-800">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {selectedInterview.participant_name || selectedInterview.participant_company || 'Interview Details'}
                </h3>
                <p className="text-sm text-zinc-500">
                  {selectedInterview.completed_at
                    ? new Date(selectedInterview.completed_at).toLocaleString()
                    : 'In progress'}
                </p>
              </div>
              <button
                onClick={() => { setSelectedInterview(null); setSelectedEvaluation(null); }}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Evaluation Summary */}
              {selectedEvaluation && (
                <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-4 mb-3">
                    <span className={`text-sm font-medium ${getSentimentColor(selectedEvaluation.sentiment)}`}>
                      {selectedEvaluation.sentiment}
                    </span>
                    <span className="text-sm text-zinc-500">Quality: {selectedEvaluation.quality_score}/10</span>
                  </div>
                  <p className="text-sm text-zinc-300">{selectedEvaluation.summary}</p>
                  {selectedEvaluation.topics && selectedEvaluation.topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedEvaluation.topics.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Transcript */}
              <h4 className="text-sm font-medium text-zinc-400 mb-3">Transcript</h4>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {selectedInterview.transcript ? (
                  selectedInterview.transcript.split('\n\n').map((block, idx) => {
                    const isAgent = block.toLowerCase().startsWith('agent:');
                    const text = block.replace(/^(agent|user):\s*/i, '');
                    return (
                      <div key={idx} className={isAgent ? 'pl-4 border-l-2 border-violet-500/50' : ''}>
                        <span className="text-xs uppercase text-zinc-600 block mb-1">
                          {isAgent ? 'AI' : 'Participant'}
                        </span>
                        <p className={isAgent ? 'text-zinc-400' : 'text-zinc-200'}>{text}</p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-zinc-500">No transcript available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
