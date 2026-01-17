// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Panel {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  total_interviews: number;
  completed_interviews: number;
  created_at: string;
}

interface DashboardStats {
  total_panels: number;
  total_interviews: number;
  completed_interviews: number;
  evaluated_interviews: number;
  pending_evaluations: number;
}

export default function DashboardPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch panels
        const panelsRes = await fetch('/api/panels');
        const panelsData = await panelsRes.json();
        setPanels(panelsData.agents || []);

        // Fetch evaluation stats
        const evalRes = await fetch('/api/evaluations/run');
        const evalData = await evalRes.json();
        
        const totalInterviews = (panelsData.agents || []).reduce(
          (sum: number, p: Panel) => sum + (p.total_interviews || 0), 0
        );
        const completedInterviews = (panelsData.agents || []).reduce(
          (sum: number, p: Panel) => sum + (p.completed_interviews || 0), 0
        );

        setStats({
          total_panels: panelsData.agents?.length || 0,
          total_interviews: totalInterviews,
          completed_interviews: completedInterviews,
          evaluated_interviews: evalData.evaluated || 0,
          pending_evaluations: evalData.pending || 0
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const runEvaluations = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/evaluations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: true, limit: 20 })
      });
      const data = await res.json();
      alert(`Evaluated ${data.processed} interviews. ${data.failed} failed.`);
      
      // Refresh stats
      const evalRes = await fetch('/api/evaluations/run');
      const evalData = await evalRes.json();
      setStats(prev => prev ? {
        ...prev,
        evaluated_interviews: evalData.evaluated || 0,
        pending_evaluations: evalData.pending || 0
      } : null);
    } catch (err) {
      alert('Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const archivePanel = async (panelId: string) => {
    if (!confirm('Archive this panel? It can be restored later.')) return;
    
    const res = await fetch(`/api/admin/panels/${panelId}`, { method: 'DELETE' });
    if (res.ok) {
      setPanels(prev => prev.filter(p => p.id !== panelId));
    } else {
      alert('Failed to archive panel');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-fuchsia-950/20 pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">Research Dashboard</h1>
            <p className="text-zinc-500">Manage your interview panels and insights</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/panels/archived"
              className="px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Archived
            </Link>
            <Link
              href="/create"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              New Panel
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
            <div className="text-4xl font-semibold mb-1">{stats?.total_panels || 0}</div>
            <div className="text-sm text-zinc-500">Active Panels</div>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
            <div className="text-4xl font-semibold text-emerald-400 mb-1">
              {stats?.completed_interviews || 0}
            </div>
            <div className="text-sm text-zinc-500">Completed Interviews</div>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6">
            <div className="text-4xl font-semibold text-violet-400 mb-1">
              {stats?.evaluated_interviews || 0}
            </div>
            <div className="text-sm text-zinc-500">Analyzed</div>
          </div>
          <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-2xl p-6 relative overflow-hidden">
            <div className="text-4xl font-semibold text-amber-400 mb-1">
              {stats?.pending_evaluations || 0}
            </div>
            <div className="text-sm text-zinc-500">Pending Analysis</div>
            {(stats?.pending_evaluations || 0) > 0 && (
              <button
                onClick={runEvaluations}
                disabled={evaluating}
                className="absolute bottom-3 right-3 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {evaluating ? 'Running...' : 'Analyze Now'}
              </button>
            )}
          </div>
        </div>

        {/* Panels List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Interview Panels</h2>
            <span className="text-sm text-zinc-500">{panels.length} panels</span>
          </div>

          {panels.length === 0 ? (
            <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-2">No panels yet</h3>
              <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
                Create your first interview panel to start collecting insights
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Panel
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className="group bg-zinc-900/30 hover:bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 rounded-2xl p-6 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <Link href={`/panels/${panel.slug || panel.id}`} className="flex-1">
                      <h3 className="text-lg font-medium mb-1 group-hover:text-violet-400 transition-colors">
                        {panel.name}
                      </h3>
                      {panel.description && (
                        <p className="text-sm text-zinc-500 line-clamp-1 mb-4">
                          {panel.description}
                        </p>
                      )}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-zinc-400">
                            {panel.completed_interviews || 0} completed
                          </span>
                        </div>
                        <div className="text-zinc-600">
                          {panel.total_interviews || 0} total
                        </div>
                        <div className="text-zinc-600">
                          Created {new Date(panel.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={`/i/${panel.slug || panel.id}`}
                        target="_blank"
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Interview Link"
                      >
                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <button
                        onClick={() => archivePanel(panel.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Archive"
                      >
                        <svg className="w-4 h-4 text-zinc-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
