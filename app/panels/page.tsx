// app/panels/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  total_interviews: number;
  completed_interviews: number;
  created_at: string;
  primary_color?: string;
}

export default function PanelsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/panels');
        if (!res.ok) throw new Error('Failed to fetch panels');
        const data = await res.json();
        setAgents(data.agents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load panels');
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading panels...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Interview Panels</h1>
            <p className="text-slate-400 mt-1">
              {agents.length} panel{agents.length !== 1 ? 's' : ''} created
            </p>
          </div>
          <Link
            href="/create"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors"
          >
            + Create Panel
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-12 text-center border border-slate-800">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-semibold mb-2">No panels yet</h2>
            <p className="text-slate-400 mb-6">
              Create your first interview panel to get started
            </p>
            <Link
              href="/create"
              className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg font-medium transition-colors"
            >
              Create Your First Panel
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/panels/${agent.slug || agent.id}`}
                className="block bg-slate-900 hover:bg-slate-800/80 rounded-xl p-6 border border-slate-800 hover:border-violet-500/50 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl font-semibold group-hover:text-violet-400 transition-colors">
                        {agent.name}
                      </h2>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          agent.status === 'active'
                            ? 'bg-green-500/20 text-green-400'
                            : agent.status === 'draft'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-slate-400 text-sm line-clamp-2 mb-4">
                        {agent.description}
                      </p>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Total:</span>
                        <span className="font-medium">{agent.total_interviews || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Completed:</span>
                        <span className="font-medium text-green-400">
                          {agent.completed_interviews || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>Created:</span>
                        <span>
                          {new Date(agent.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-500 group-hover:text-violet-400 transition-colors">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}