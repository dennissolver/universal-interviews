// app/SetupClient.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Loader2, CheckCircle, Plus,
  ArrowRight, MessageSquare, Bot, Users, FileEdit, Sparkles
} from 'lucide-react';
import VoiceAvatar from './components/VoiceAvatar';
import { clientConfig } from '@/config/client';
import { createClient } from '@/lib/supabase';

type SetupState =
  | 'loading'
  | 'dashboard'
  | 'ready_for_setup'
  | 'setup_in_progress'
  | 'call_ended'
  | 'processing'
  | 'draft_ready'
  | 'error';

interface Panel {
  id: string;
  name: string;
  description: string;
  status?: string;
  created_at: string;
}

export default function SetupClient() {
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetMountedRef = useRef(false);

  const [state, setState] = useState<SetupState>('loading');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [currentDraftName, setCurrentDraftName] = useState<string>('');
  const [error, setError] = useState('');
  const [showWidget, setShowWidget] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const SETUP_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

  // Load ElevenLabs widget script
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="elevenlabs.io/convai-widget"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://elevenlabs.io/convai-widget/index.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Mount widget when needed
  useEffect(() => {
    if (!showWidget || !SETUP_AGENT_ID || !scriptLoaded || !widgetContainerRef.current) return;
    if (widgetMountedRef.current) return;

    const timeoutId = setTimeout(() => {
      if (widgetContainerRef.current && !widgetMountedRef.current) {
        widgetMountedRef.current = true;
        widgetContainerRef.current.innerHTML = `<elevenlabs-convai agent-id="${SETUP_AGENT_ID}"></elevenlabs-convai>`;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [showWidget, SETUP_AGENT_ID, scriptLoaded]);

  // Initial load
  useEffect(() => {
    loadPanels();
  }, []);

  async function loadPanels() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('agents')
        .select('id, name, description, status, created_at')
        .eq('status', 'active') // Only show active panels in dashboard
        .order('created_at', { ascending: false }) as { data: Panel[] | null };

      setPanels(data || []);
      setState(data && data.length > 0 ? 'dashboard' : 'ready_for_setup');
    } catch (err) {
      console.error('Failed to load panels:', err);
      setState('ready_for_setup');
    }
  }

  const startSetupCall = async () => {
    widgetMountedRef.current = false;
    setPollCount(0);
    setState('setup_in_progress');
    setShowWidget(true);
  };

  const endCall = async () => {
    setShowWidget(false);
    widgetMountedRef.current = false;
    if (widgetContainerRef.current) widgetContainerRef.current.innerHTML = '';

    // Show "call ended" state first - Sandra tells user to end call, then they see the button
    setState('call_ended');
  };

  // Start looking for draft after user confirms call ended
  const checkForDraft = async () => {
    setState('processing');
    setPollCount(0);

    const pollForDraft = async (attempt: number) => {
      if (attempt > 15) {
        // After 30 seconds, give up
        setError('Could not find your draft. Please try again.');
        setState('error');
        return;
      }

      setPollCount(attempt);

      const supabase = createClient();
      const { data } = await supabase
        .from('agents')
        .select('id, name, status, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1) as { data: { id: string; name: string; status: string; created_at: string }[] | null };

      if (data && data.length > 0) {
        const draft = data[0];
        // Check if this draft was created in the last 2 minutes (to avoid picking up old drafts)
        const createdAt = new Date(draft.created_at);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffMins = diffMs / 1000 / 60;

        if (diffMins < 5) {
          setCurrentDraftId(draft.id);
          setCurrentDraftName(draft.name);
          setState('draft_ready');
          return;
        }
      }

      // Keep polling
      setTimeout(() => pollForDraft(attempt + 1), 2000);
    };

    // Start polling after a short delay
    setTimeout(() => pollForDraft(1), 2000);
  };

  const WidgetContainer = () => (
    <div ref={widgetContainerRef} className={`mb-6 min-h-[80px] ${showWidget ? 'block' : 'hidden'}`} />
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading...</p>
          </div>
        );

      case 'dashboard':
        return (
          <div className="max-w-4xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">{clientConfig.platform.name}</h1>
                <p className="text-slate-400">{clientConfig.company.name}</p>
              </div>
              <button
                onClick={() => setState('ready_for_setup')}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <Plus className="w-4 h-4" />
                New Panel
              </button>
            </div>

            <div className="grid gap-4">
              {panels.map((panel) => (
                <div key={panel.id} className="bg-slate-900 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">{panel.name}</h3>
                      <p className="text-sm text-slate-400">{panel.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`/i/${panel.id}`} target="_blank" className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition">
                      <MessageSquare className="w-4 h-4" />
                      Test
                    </a>
                    <a href={`/panel/${panel.id}/invite`} className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition">
                      <Users className="w-4 h-4" />
                      Invite
                    </a>
                  </div>
                </div>
              ))}

              {panels.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No panels yet. Create your first one!</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'ready_for_setup':
        return (
          <div className="text-center max-w-lg mx-auto">
            <VoiceAvatar size="lg" label="AI Setup Assistant" />
            <h1 className="text-3xl font-bold mb-4">{panels.length > 0 ? 'Create New Panel' : 'Welcome!'}</h1>
            <p className="text-slate-300 mb-2">{panels.length > 0 ? "Let's set up another interview panel." : "Let's create your first AI interview panel."}</p>
            <p className="text-slate-400 mb-8">Tell the assistant what kind of interviews or surveys you want to run.</p>
            <button
              onClick={startSetupCall}
              disabled={!SETUP_AGENT_ID || !scriptLoaded}
              className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              <Phone className="w-6 h-6" />
              {scriptLoaded ? 'Start Setup Call' : 'Loading...'}
            </button>
            {panels.length > 0 && (
              <button onClick={() => setState('dashboard')} className="block mx-auto mt-4 text-slate-400 hover:text-white transition">
                Back to Dashboard
              </button>
            )}
            <WidgetContainer />
          </div>
        );

      case 'setup_in_progress':
        return (
          <div className="text-center max-w-lg mx-auto">
            <VoiceAvatar isActive isSpeaking size="lg" label="Speaking..." />
            <h2 className="text-2xl font-bold text-green-400 mb-4">Call in Progress</h2>
            <p className="text-slate-400 mb-6">Describe your interview panel. When Sandra confirms she's saved your draft, click End Call.</p>
            <WidgetContainer />
            <button onClick={endCall} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-medium transition">
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>
          </div>
        );

      case 'call_ended':
        return (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Call Ended</h2>
            <p className="text-slate-400 mb-8">
              Sandra has saved your panel configuration as a draft.<br />
              Click below to review and finalize it.
            </p>
            <button
              onClick={checkForDraft}
              className="inline-flex items-center gap-3 bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
            >
              <FileEdit className="w-6 h-6" />
              Review Your Draft
            </button>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center max-w-lg mx-auto">
            <VoiceAvatar isActive size="lg" label="Finding draft..." />
            <h2 className="text-2xl font-bold mb-4">Finding Your Draft</h2>
            <p className="text-slate-400 mb-8">Looking for your saved panel configuration...</p>
            <div className="space-y-3 text-left bg-slate-900 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-slate-300">Setup conversation complete</span>
              </div>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-purple-400">Locating your draft{pollCount > 0 ? ` (${pollCount}/15)` : ''}...</span>
              </div>
            </div>
          </div>
        );

      case 'draft_ready':
        return (
          <div className="text-center max-w-lg mx-auto">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-green-400 mb-2">Draft Ready!</h2>
            <p className="text-xl text-white mb-2">{currentDraftName}</p>
            <p className="text-slate-400 mb-8">
              Review the details Sandra collected, make any changes, then create your panel.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href={`/panel/draft/${currentDraftId}/edit`}
                className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-purple-500/25"
              >
                <FileEdit className="w-6 h-6" />
                Review & Edit Draft
                <ArrowRight className="w-5 h-5" />
              </a>
              <button
                onClick={() => { loadPanels(); setState('dashboard'); }}
                className="text-slate-400 hover:text-white transition"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something Went Wrong</h2>
            <p className="text-slate-400 mb-8">{error}</p>
            <button onClick={() => setState('ready_for_setup')} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg">
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      {renderContent()}
    </div>
  );
}