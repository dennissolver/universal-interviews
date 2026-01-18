'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Interview {
  id: string;
  participant_name: string | null;
  participant_company: string | null;
  participant_country: string | null;
  status: string;
  created_at: string;
}

export default function AdminInterviewsPage() {
  const [data, setData] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/interviews')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading interviews…</div>;
  }

  return (
    <div className="p-8 text-white">
      <h1 className="text-2xl font-bold mb-6">Interviews</h1>

      <div className="space-y-3">
        {data.map((i) => (
          <Link
            key={i.id}
            href={`/admin/interviews/${i.id}`}
            className="block rounded-lg border border-slate-800 p-4 hover:bg-slate-900 transition"
          >
            <div className="font-semibold">
              {i.participant_name || 'Unnamed participant'}
            </div>
            <div className="text-sm text-slate-400">
              {i.participant_company ?? '—'} · {i.participant_country ?? '—'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {new Date(i.created_at).toLocaleString()} · {i.status}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
