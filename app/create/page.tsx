// app/create/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, CheckCircle, MessageSquare } from 'lucide-react';

interface PlatformConfig {
  name: string;
  elevenlabs_agent_id: string;
}

interface DraftData {
  id: string;
  name: string;
  description: string;
}

export default function CreatePage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Fetch platform config on mount
  useEffect(() => {
    async function fetchPlatform() {
      try {
        const res = await fetch('/api/platform');
        if (!res.ok) throw new Error('Failed to fetch platform config');
        const data = await res.json();
        setPlatform(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlatform();
  }, []);

  // Load ElevenLabs widget script
  useEffect(() => {
    if (!platform?.elevenlabs_agent_id) return;

    // Check if script already exists
    if (document.querySelector('script[src*="elevenlabs.io/convai-widget"]')) {
      setWidgetLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => setWidgetLoaded(true);
    document.body.appendChild(script);
  }, [platform?.elevenlabs_agent_id]);

  // Poll for new drafts created by Sandra
  useEffect(() => {
    if (!widgetLoaded) return;

    const pollForDraft = async () => {
      try {
        const res = await fetch('/api/panels/drafts/latest');
        if (res.ok) {
          const data = await res.json();
          if (data.draft && !draft) {
            setDraft(data.draft);
          }
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    };

    // Start polling after widget loads
    const interval = setInterval(pollForDraft, 3000);
    return () => clearInterval(interval);
  }, [widgetLoaded, draft]);

  const handleViewDraft = () => {
    if (draft) {
      router.push(`/panel/draft/${draft.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error || !platform?.elevenlabs_agent_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center">
          <p className="text-red-400">
            {error || 'Platform not configured. Please contact support.'}
          </p>
          <p className="text-white/40 text-sm mt-2">
            Missing: ElevenLabs Agent ID
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-semibold">{platform.name}</h1>
              <p className="text-white/50 text-sm">Create Interview Panel</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Draft Created Banner */}
        {draft && (
          <div className="mb-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-emerald-400 font-semibold text-lg">Draft Created!</h3>
                <p className="text-white/70 mt-1">
                  Sandra has created a draft panel: <span className="text-white font-medium">{draft.name}</span>
                </p>
                <button
                  onClick={handleViewDraft}
                  className="mt-4 px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
                >
                  Review & Edit Draft
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              Meet Sandra
            </h2>
            <p className="text-white/60 max-w-md mx-auto">
              Sandra is your AI assistant who will help you create a custom interview panel.
              Click the chat button in the bottom right to start talking!
            </p>
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <h3 className="text-white/80 font-medium mb-4 text-center">What Sandra will help you with:</h3>
            <div className="grid gap-3 text-sm">
              {[
                'Name your interview panel',
                'Define what type of interviews to conduct',
                'Set the interviewer tone and style',
                'Create key questions and topics',
                'Configure interview duration',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/60">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-medium">
                    {i + 1}
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skip Link */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Skip to dashboard →
          </button>
        </div>
      </div>

      {/* ElevenLabs Widget - renders as floating button */}
      {widgetLoaded && (
        <elevenlabs-convai agent-id={platform.elevenlabs_agent_id}></elevenlabs-convai>
      )}
    </div>
  );
}

// TypeScript declaration for the custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { 'agent-id': string },
        HTMLElement
      >;
    }
  }
}