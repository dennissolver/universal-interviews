'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Phone, PhoneOff, Loader2, Bot, CheckCircle } from 'lucide-react';

interface Panel {
  id: string;
  name: string;
  company_name?: string;
  primary_color: string;
  elevenlabs_agent_id: string;
}

export default function InterviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const panelId = params.panelId as string;
  const inviteToken = searchParams.get('token');

  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] =
    useState<'ready' | 'connecting' | 'active' | 'complete'>('ready');
  const [intervieweeId, setIntervieweeId] = useState<string | null>(null);

  useEffect(() => {
    loadPanel();
    if (inviteToken) validateToken();
  }, [panelId, inviteToken]);

  async function loadPanel() {
    try {
      const res = await fetch(`/api/panels/${panelId}`);
      if (!res.ok) throw new Error('Interview not found');
      const data = await res.json();

      if (!data.elevenlabs_agent_id) {
        throw new Error('Interview agent not configured');
      }

      setPanel(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function validateToken() {
    try {
      const res = await fetch(`/api/invites/validate?token=${inviteToken}`);
      if (res.ok) {
        const data = await res.json();
        setIntervieweeId(data.intervieweeId);
      }
    } catch (err) {
      console.error('Token validation failed:', err);
    }
  }

  async function startInterview() {
    setStatus('connecting');

    if (intervieweeId) {
      await fetch('/api/invites/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervieweeId, status: 'started' }),
      });
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;

    script.onload = () => {
      const container = document.getElementById('widget-container');
      if (container && panel?.elevenlabs_agent_id) {
        container.innerHTML = `
          <elevenlabs-convai agent-id="${panel.elevenlabs_agent_id}">
          </elevenlabs-convai>
        `;
        setStatus('active');
      }
    };

    document.body.appendChild(script);
  }

  async function endInterview() {
    const container = document.getElementById('widget-container');
    if (container) container.innerHTML = '';

    if (intervieweeId) {
      await fetch('/api/invites/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervieweeId, status: 'completed' }),
      });
    }

    setStatus('complete');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Interview Not Found</h1>
          <p className="text-slate-400">{error || 'Invalid link.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: panel.primary_color + '20' }}
          >
            <Bot className="w-10 h-10" style={{ color: panel.primary_color }} />
          </div>
          <h1 className="text-2xl font-bold">{panel.name}</h1>
          {panel.company_name && (
            <p className="text-slate-400">{panel.company_name}</p>
          )}
        </div>

        {status === 'ready' && (
          <>
            <p className="text-slate-300 mb-8">
              Click below to start. Make sure your microphone is enabled.
            </p>
            <button
              onClick={startInterview}
              className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-green-500/25"
            >
              <Phone className="w-6 h-6" />
              Start Interview
            </button>
          </>
        )}

        {status === 'connecting' && (
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            <span>Connecting...</span>
          </div>
        )}

        {status === 'active' && (
          <>
            <div id="widget-container" className="mb-6" />
            <button
              onClick={endInterview}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-medium transition"
            >
              <PhoneOff className="w-5 h-5" />
              End Interview
            </button>
          </>
        )}

        {status === 'complete' && (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-400 mb-2">
              Interview Complete
            </h2>
            <p className="text-slate-400">Thank you for your time!</p>
          </div>
        )}
      </div>
    </div>
  );
}
