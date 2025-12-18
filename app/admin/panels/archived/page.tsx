'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Panel {
  id: string;
  name: string;
  archived_at: string;
}

export default function ArchivedPanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/panels/archived')
      .then((r) => r.json())
      .then(setPanels)
      .finally(() => setLoading(false));
  }, []);

  async function handleRestore(panelId: string) {
    const confirmed = window.confirm(
      'Restore this panel?\n\nIt will become active again.'
    );

    if (!confirmed) return;

    const res = await fetch(
      `/api/admin/panels/${panelId}/restore`,
      { method: 'POST' }
    );

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to restore panel');
      return;
    }

    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Loading archived panels…</div>;
  }

  return (
    <div className="p-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Archived Panels</h1>
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {panels.length === 0 && (
        <div className="text-slate-400">No archived panels.</div>
      )}

      <div className="space-y-3">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="flex items-center justify-between border border-slate-800 p-4 rounded-lg"
          >
            <div>
              <div className="font-medium">{panel.name}</div>
              <div className="text-xs text-slate-500">
                Archived {new Date(panel.archived_at).toLocaleString()}
              </div>
            </div>

            <button
              onClick={() => handleRestore(panel.id)}
              className="text-green-400 hover:text-green-300 text-sm"
            >
              Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
