// app/panels/[panelId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  interviewee_profile: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  sentiment_overall: string | null;
  word_count?: number;
  messages: any[];
  transcript: string | null;
  participant_name: string | null;
  participant_company: string | null;
  created_at: string;
}

export default function PanelDashboardPage() {
  const params = useParams();
  const panelId = params.panelId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch agent details
        const agentRes = await fetch(`/api/agents/${panelId}`);
        if (!agentRes.ok) throw new Error('Panel not found');
        const agentData = await agentRes.json();
        setAgent(agentData.agent);

        // Fetch interviews for this agent
        const interviewsRes = await fetch(`/api/panels/${agentData.agent.id}/interviews`);
        if (interviewsRes.ok) {
          const interviewsData = await interviewsRes.json();
          setInterviews(interviewsData.interviews || []);
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
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'in_progress':
        return 'bg-blue-500/20 text-blue-400';
      case 'abandoned':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getSentimentEmoji = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😔';
      case 'mixed':
        return '😐';
      default:
        return '—';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading panel...</div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg">{error || 'Panel not found'}</div>
        <Link href="/panels" className="text-violet-400 hover:underline">
          ← Back to panels
        </Link>
      </div>
    );
  }

  const completedInterviews = interviews.filter((i) => i.status === 'completed');
  const avgDuration =
    completedInterviews.length > 0
      ? Math.round(
          completedInterviews.reduce((acc, i) => acc + (i.duration_seconds || 0), 0) /
            completedInterviews.length
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
            <Link href="/panels" className="hover:text-white transition-colors">
              Panels
            </Link>
            <span>/</span>
            <span className="text-white">{agent.name}</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{agent.name}</h1>
              {agent.description && (
                <p className="text-slate-400 max-w-2xl">{agent.description}</p>
              )}
            </div>
            <a
              href={`/i/${agent.slug || agent.id}`}
              target="_blank"
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Interview Link
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="text-3xl font-bold">{agent.total_interviews || 0}</div>
            <div className="text-slate-400 text-sm">Total Interviews</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="text-3xl font-bold text-green-400">
              {agent.completed_interviews || 0}
            </div>
            <div className="text-slate-400 text-sm">Completed</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="text-3xl font-bold">
              {agent.total_interviews
                ? Math.round((agent.completed_interviews / agent.total_interviews) * 100)
                : 0}
              %
            </div>
            <div className="text-slate-400 text-sm">Completion Rate</div>
          </div>
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800">
            <div className="text-3xl font-bold">{formatDuration(avgDuration)}</div>
            <div className="text-slate-400 text-sm">Avg Duration</div>
          </div>
        </div>

        {/* Interview List */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="font-semibold">Interview Records</h2>
          </div>

          {interviews.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🎤</div>
              <p className="text-slate-400">No interviews yet</p>
              <p className="text-slate-500 text-sm mt-1">
                Share the interview link to start collecting responses
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {interviews.map((interview) => (
                <div
                  key={interview.id}
                  className="px-6 py-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedInterview(interview)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(interview.status)}`}>
                        {interview.status.replace('_', ' ')}
                      </span>
                      <div>
                        <div className="font-medium">
                          {interview.participant_name ||
                            interview.participant_company ||
                            interview.interviewee_profile?.name ||
                            interview.interviewee_profile?.email ||
                            `Interview ${interview.id.slice(0, 8)}`}
                        </div>
                        <div className="text-sm text-slate-500">
                          {interview.started_at
                            ? new Date(interview.started_at).toLocaleString()
                            : new Date(interview.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="text-lg">{getSentimentEmoji(interview.sentiment_overall)}</div>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <div className="font-medium">{formatDuration(interview.duration_seconds)}</div>
                        <div className="text-slate-500 text-xs">duration</div>
                      </div>
                      <div className="text-right min-w-[60px]">
                        <div className="font-medium">{interview.word_count || '-'}</div>
                        <div className="text-slate-500 text-xs">words</div>
                      </div>
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interview Detail Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-8 z-50">
          <div className="bg-slate-900 rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold">Interview Details</h3>
              <button
                onClick={() => setSelectedInterview(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {/* Interviewee Info */}
              <div className="mb-6">
                <h4 className="text-sm text-slate-400 mb-2">Interviewee</h4>
                <div className="bg-slate-800 rounded-lg p-4">
                  {Object.entries(selectedInterview.interviewee_profile || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1">
                      <span className="text-slate-400 capitalize">{key.replace('_', ' ')}</span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                  {Object.keys(selectedInterview.interviewee_profile || {}).length === 0 && (
                    <span className="text-slate-500">No profile data</span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{formatDuration(selectedInterview.duration_seconds)}</div>
                  <div className="text-slate-400 text-sm">Duration</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <div className="text-2xl">{getSentimentEmoji(selectedInterview.sentiment_overall)}</div>
                  <div className="text-slate-400 text-sm capitalize">{selectedInterview.sentiment_overall || 'Unknown'}</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{selectedInterview.word_count || '-'}</div>
                  <div className="text-slate-400 text-sm">Words</div>
                </div>
              </div>

              {/* Transcript */}
              <div>
                <h4 className="text-sm text-slate-400 mb-2">Transcript</h4>
                <div className="bg-slate-800 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
                  {selectedInterview.transcript ? (
                    selectedInterview.transcript.split('\n\n').map((block, idx) => {
                      const isAgent = block.toLowerCase().startsWith('agent:');
                      const text = block.replace(/^(agent|user):\s*/i, '');
                      return (
                        <div
                          key={idx}
                          className={isAgent ? 'text-violet-300' : 'text-slate-300'}
                        >
                          <span className="font-medium text-xs uppercase text-slate-500 block mb-1">
                            {isAgent ? 'AI' : 'Interviewee'}
                          </span>
                          <p>{text}</p>
                        </div>
                      );
                    })
                  ) : (selectedInterview.messages || []).length > 0 ? (
                    (selectedInterview.messages || []).map((msg: any, idx: number) => (
                      <div
                        key={idx}
                        className={`${
                          msg.role === 'assistant' || msg.role === 'agent'
                            ? 'text-violet-300'
                            : 'text-slate-300'
                        }`}
                      >
                        <span className="font-medium text-xs uppercase text-slate-500 block mb-1">
                          {msg.role === 'assistant' || msg.role === 'agent' ? 'AI' : 'Interviewee'}
                        </span>
                        <p>{msg.content || msg.message || msg.text}</p>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">No transcript available</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}