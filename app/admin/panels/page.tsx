// app/admin/panels/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, Eye, Users, Clock, ArchiveRestore, Plus } from 'lucide-react';

interface Panel {
  id: string;
  name: string;
  description: string;
  interview_type: string;
  status: string;
  total_interviews: number;
  completed_interviews: number;
  created_at: string;
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPanels();
  }, []);

  async function fetchPanels() {
    try {
      const res = await fetch('/api/admin/panels');
      if (res.ok) {
        const data = await res.json();
        setPanels(data);
      }
    } catch (err) {
      console.error('Failed to fetch panels:', err);
    } finally {
      setLoading(false);
    }
  }

  async function archivePanel(panelId: string) {
    if (!confirm('Archive this panel? It can be restored later.')) return;

    try {
      const res = await fetch(`/api/admin/panels/${panelId}/archive`, {
        method: 'POST',
      });
      if (res.ok) {
        setPanels(panels.filter(p => p.id !== panelId));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to archive panel');
      }
    } catch (err) {
      console.error('Failed to archive:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading panels...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Interview Panels</h1>
            <p className="text-slate-400 mt-1">Manage your interview configurations</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/panels/archived"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            >
              <ArchiveRestore className="w-4 h-4" />
              View Archived
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              New Panel
            </Link>
          </div>
        </div>

        {/* Panels Grid */}
        {panels.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 rounded-xl">
            <p className="text-slate-400 mb-4">No active panels yet</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Create Your First Panel
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="bg-slate-900 rounded-xl p-6 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold">{panel.name}</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {panel.description || panel.interview_type || 'No description'}
                  </p>
                  <div className="flex gap-6 mt-3 text-sm text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {panel.completed_interviews || 0} / {panel.total_interviews || 0} interviews
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(panel.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/i/${panel.id}`}
                    target="_blank"
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                    title="Preview interview"
                  >
                    <Eye className="w-5 h-5" />
                  </Link>
                  <Link
                    href={`/admin/interviews?panel=${panel.id}`}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                  >
                    View Interviews
                  </Link>
                  <button
                    onClick={() => archivePanel(panel.id)}
                    className="p-2 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition"
                    title="Archive panel"
                  >
                    <Archive className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}