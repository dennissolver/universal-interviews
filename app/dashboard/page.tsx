'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Panel {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const [panels, setPanels] = useState<Panel[]>([]);

  useEffect(() => {
    fetch('/api/panels')
      .then((r) => r.json())
      .then(setPanels);
  }, []);

  // --------------------------------------------------
  // Archive (soft delete) handler
  // --------------------------------------------------
  async function handleDelete(panelId: string) {
    const confirmed = window.confirm(
      'Archive this panel?\n\n• Panel will be hidden\n• Interviews & transcripts are preserved\n• Can be restored later\n\nProceed?'
    );

    if (!confirmed) return;

    const res = await fetch(`/api/admin/panels/${panelId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to archive panel');
      return;
    }

    // Optimistic UI update
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="p-8 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <Link
          href="/admin/panels/archived"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          View archived panels
        </Link>
      </div>

      {/* Panels list */}
      <div className="space-y-3">
        {panels.length === 0 && (
          <div className="text-slate-400">
            No active panels.
          </div>
        )}

        {panels.map((panel) => (
          <div
            key={panel.id}
            className="flex items-center justify-between border border-slate-800 p-4 rounded-lg"
          >
            <div className="font-medium">
              {panel.name}
            </div>

            <button
              onClick={() => handleDelete(panel.id)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Archive
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
