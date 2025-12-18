// app/i/[panelId]/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
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

  // ---------------------------------------------------------------------------
  // Load panel + validate invite
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadPanel();
    if (inviteToken) validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
      // Non-fatal
    }
  }

  // ---------------------------------------------------------------------------
  // INP-SAFE START HANDLER
  // ---------------------------------------------------------------------------
  function startInterview() {
    setStatus('connecting');
    setTimeout(beginInterview, 0);
  }

  // ---------------------------------------------------------------------------
  // Heavy async work (deferred)
  // ---------------------------------------------------------------------------
  async function beginInterview() {
    try {
      if (!panel) throw new Error('Panel not loaded');

      // 1️⃣ Create interview instance
      const res = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelId,
          elevenlabsAgentId: panel.elevenlabs_agent_id,
          intervieweeId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to start interview');
      }

      const { interviewId } = await res.json();
      console.log('Interview started with ID:', interviewId);

      // 2️⃣ Update invite status (fire-and-forget)
      if (intervieweeId) {
        fetch('/api/invites/update-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervieweeId, status: 'started' }),
        });
      }

      // 3️⃣ Mount ElevenLabs widget
      const container = document.getElementById('widget-container');
      if (!container) throw new Error('Widget container missing');

      const mountWidget = () => {
        container.innerHTML = '';
        const el = document.createElement('elevenlabs-convai');
        el.setAttribute('agent-id', panel.elevenlabs_agent_id);

        // =====================================================================
        // DEBUG: Log ALL possible events to find the right one
        // =====================================================================
        el.addEventListener('elevenlabs-convai:call', (e: any) => {
          console.log('📞 call event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:connect', (e: any) => {
          console.log('🔗 connect event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:disconnect', (e: any) => {
          console.log('❌ disconnect event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:message', (e: any) => {
          console.log('💬 message event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:error', (e: any) => {
          console.log('🚨 error event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:status-change', (e: any) => {
          console.log('🔄 status-change event:', e.detail);
        });

        el.addEventListener('elevenlabs-convai:conversation', (e: any) => {
          console.log('🎤 conversation event:', e.detail);
        });

        // =====================================================================
        // 4️⃣ Listen for conversation start to capture conversation_id
        // =====================================================================
        el.addEventListener('elevenlabs-convai:conversation-started', async (event: any) => {
          console.log('=== ELEVENLABS CONVERSATION-STARTED EVENT ===');
          console.log('Full event:', event);
          console.log('Event detail:', event.detail);

          const conversationId = event.detail?.conversationId
            || event.detail?.conversation_id
            || event.detail?.id;
          console.log('Extracted conversationId:', conversationId);
          console.log('Interview ID:', interviewId);

          if (conversationId && interviewId) {
            console.log('Calling link-conversation API...');
            try {
              const linkRes = await fetch('/api/interviews/link-conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  interviewId,
                  elevenlabsConversationId: conversationId,
                }),
              });
              const linkData = await linkRes.json();
              console.log('Link response:', linkData);
            } catch (linkErr) {
              console.error('Link API error:', linkErr);
            }
          } else {
            console.log('Missing data - cannot link. conversationId:', conversationId, 'interviewId:', interviewId);
          }
        });

        // =====================================================================
        // 5️⃣ Listen for conversation end
        // =====================================================================
        el.addEventListener('elevenlabs-convai:conversation-ended', (event: any) => {
          console.log('=== ELEVENLABS CONVERSATION-ENDED EVENT ===');
          console.log('Full event:', event);
          endInterview();
        });

        container.appendChild(el);
        setStatus('active');
        console.log('Widget mounted successfully');
      };

      if (!document.querySelector('script[src*="convai-widget"]')) {
        const script = document.createElement('script');
        script.src = 'https://elevenlabs.io/convai-widget/index.js';
        script.async = true;
        script.onload = () => {
          console.log('ElevenLabs widget script loaded');
          mountWidget();
        };
        script.onerror = () => {
          console.error('Failed to load ElevenLabs widget script');
          setError('Failed to load interview widget');
          setStatus('ready');
        };
        document.body.appendChild(script);
      } else {
        console.log('Widget script already loaded, mounting directly');
        mountWidget();
      }
    } catch (err: any) {
      console.error('beginInterview error:', err);
      setError(err.message || 'Failed to start interview');
      setStatus('ready');
    }
  }

  // ---------------------------------------------------------------------------
  // End interview
  // ---------------------------------------------------------------------------
  async function endInterview() {
    const container = document.getElementById('widget-container');
    if (container) container.innerHTML = '';

    if (intervieweeId) {
      fetch('/api/invites/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervieweeId, status: 'completed' }),
      });
    }

    setStatus('complete');
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
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

        {/* Widget container MUST always exist */}
        <div id="widget-container" className="mb-6" />

        {status === 'ready' && (
          <>
            <p className="text-slate-300 mb-8">
              Click below to start. Make sure your microphone is enabled.
            </p>
            <button
              onClick={startInterview}
              disabled={status !== 'ready'}
              className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <button
            onClick={endInterview}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-medium transition"
          >
            <PhoneOff className="w-5 h-5" />
            End Interview
          </button>
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