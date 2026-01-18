'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
}

interface InterviewDetail {
  participant_name: string | null;
  participant_company: string | null;
  participant_country: string | null;
  participant_investment_stage: string | null;
  participant_sectors: string | null;
  transcript: TranscriptTurn[];
}

export default function InterviewDetailPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const [data, setData] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/interviews/${interviewId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [interviewId]);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading transcript…</div>;
  }

  if (!data) {
    return <div className="p-6 text-red-400">Interview not found</div>;
  }

  return (
    <div className="p-8 text-white space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {data.participant_name ?? 'Unnamed participant'}
        </h1>
        <div className="text-slate-400 text-sm">
          {data.participant_company} · {data.participant_country}
        </div>
        <div className="text-slate-500 text-sm">
          {data.participant_investment_stage} · {data.participant_sectors}
        </div>
      </div>

      <div className="space-y-4">
        {data.transcript.map((t, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg ${
              t.role === 'agent'
                ? 'bg-slate-800 text-purple-300'
                : 'bg-slate-900 text-white'
            }`}
          >
            <div className="text-xs uppercase opacity-60 mb-1">
              {t.role}
            </div>
            <div className="whitespace-pre-wrap">{t.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
