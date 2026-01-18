// app/admin/panels/archived/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArchiveRestore, ArrowLeft, Clock, Trash2 } from 'lucide-react';

interface Panel {
  id: string;
  name: string;
  description: string;
  interview_type: string;
  archived_at: string;
}

export default function ArchivedPanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchivedPanels();
  }, []);

  async function fetchArchivedPanels() {
    try {
      const res = await fetch('/api/admin/panels/archived');
      if (res.ok) {
        const data = await res.json();
        setPanels(data);
      }
    } catch (err) {
      console.error('Failed to fetch archived panels:', err);
    } finally {
      setLoading(false);
    }
  }

  async function restorePanel(panelId: string) {
    try {
      const res = await fetch(`/api/admin/panels/${panelId}/restore`, {
        method: 'POST',
      });
      if (res.ok) {
        setPanels(panels.filter(p => p.id !== panelId));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to restore panel');
      }
    } catch (err) {
      console.error('Failed to restore:', err);
    }
  }

  async function deletePanel(panelId: string) {
    if (!confirm('Permanently delete this panel and all its data? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/admin/panels/${panelId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setPanels(panels.filter(p => p.id !== panelId));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete panel');
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading archived panels...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/panels"
            className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Active Panels
          </Link>
          <h1 className="text-3xl font-bold">Archived Panels</h1>
          <p className="text-slate-400 mt-1">Restore or permanently delete archived panels</p>
        </div>

        {/* Archived Panels List */}
        {panels.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 rounded-xl">
            <p className="text-slate-400">No archived panels</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {panels.map((panel) => (
              <div
                key={panel.id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-slate-300">{panel.name}</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {panel.description || panel.interview_type || 'No description'}
                  </p>
                  <div className="flex gap-4 mt-3 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Archived {panel.archived_at ? new Date(panel.archived_at).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => restorePanel(panel.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-lg transition"
                  >
                    <ArchiveRestore className="w-5 h-5" />
                    Restore
                  </button>
                  <button
                    onClick={() => deletePanel(panel.id)}
                    className="p-2 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition"
                    title="Permanently delete"
                  >
                    <Trash2 className="w-5 h-5" />
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