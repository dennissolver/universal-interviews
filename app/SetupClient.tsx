// app/SetupClient.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Phone, PhoneOff, Loader2, CheckCircle, Plus,
  MessageSquare, Bot, Users, FileEdit, Sparkles
} from 'lucide-react';
import VoiceAvatar from './components/VoiceAvatar';
import { clientConfig } from '@/config/client';
import { createClient } from '@/lib/supabase';

type SetupState =
  | 'loading'
  | 'dashboard'
  | 'ready_for_setup'
  | 'setup_in_progress'
  | 'error';

interface Panel {
  id: string;
  name: string;
  description: string;
  status?: string;
  created_at: string;
}

interface Draft {
  id: string;
  name: string;
  created_at: string;
}

export default function SetupClient() {
  const router = useRouter();
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const widgetMountedRef = useRef(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const [state, setState] = useState<SetupState>('loading');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [error, setError] = useState('');
  const [showWidget, setShowWidget] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Draft detection - real-time verified
  const [draftReady, setDraftReady] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);

  const SETUP_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

  // Initialize Supabase client once
  useEffect(() => {
    supabaseRef.current = createClient();
  }, []);

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

  // REAL-TIME SUBSCRIPTION: Listen for new drafts while call is in progress
  useEffect(() => {
    if (state !== 'setup_in_progress' || !callStartTime || !supabaseRef.current) {
      return;
    }

    const supabase = supabaseRef.current;

    console.log('[SetupClient] Starting real-time subscription for drafts...');
    console.log('[SetupClient] Call started at:', callStartTime.toISOString());

    // Subscribe to INSERT events on agents table where status = 'draft'
    const channel = supabase
      .channel('draft-detection')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agents',
          filter: 'status=eq.draft'
        },
        (payload) => {
          console.log('[SetupClient] Real-time: New draft detected!', payload);

          const newDraft = payload.new as Draft;
          const draftCreatedAt = new Date(newDraft.created_at);

          // Verify this draft was created AFTER the call started
          if (draftCreatedAt >= callStartTime) {
            console.log('[SetupClient] ✅ Draft verified - created during this session:', newDraft.name);
            setCurrentDraft(newDraft);
            setDraftReady(true);
          } else {
            console.log('[SetupClient] ⚠️ Draft ignored - created before call started');
          }
        }
      )
      .subscribe((status) => {
        console.log('[SetupClient] Subscription status:', status);
      });

    // Cleanup subscription on unmount or state change
    return () => {
      console.log('[SetupClient] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [state, callStartTime]);

  async function loadPanels() {
    try {
      const supabase = supabaseRef.current || createClient();
      const { data } = await supabase
        .from('agents')
        .select('id, name, description, status, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false }) as { data: Panel[] | null };

      setPanels(data || []);
      setState(data && data.length > 0 ? 'dashboard' : 'ready_for_setup');
    } catch (err) {
      console.error('Failed to load panels:', err);
      setState('ready_for_setup');
    }
  }

  const startSetupCall = async () => {
    // Reset state for new call
    widgetMountedRef.current = false;
    setDraftReady(false);
    setCurrentDraft(null);
    setCallStartTime(new Date());
    setState('setup_in_progress');
    setShowWidget(true);
  };

  const endCall = async () => {
    setShowWidget(false);
    widgetMountedRef.current = false;
    if (widgetContainerRef.current) widgetContainerRef.current.innerHTML = '';

    // If draft is ready, user can still click Review Draft
    // If not, go back to ready state
    if (!draftReady) {
      setState('ready_for_setup');
      setCallStartTime(null);
    }
  };

  const goToReviewDraft = () => {
    if (currentDraft) {
      router.push(`/panel/draft/${currentDraft.id}/edit`);
    }
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
            <VoiceAvatar isActive isSpeaking size="lg" label="Speaking with Sandra..." />
            <h2 className="text-2xl font-bold text-green-400 mb-4">Call in Progress</h2>
            <p className="text-slate-400 mb-6">
              Describe your interview panel to Sandra. When she confirms your draft is saved,
              the <span className="text-green-400 font-medium">Review Draft</span> button will turn green.
            </p>

            <WidgetContainer />

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4 mt-6">
              {/* End Call Button */}
              <button
                onClick={endCall}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-medium transition"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>

              {/* Review Draft Button - changes based on draft status */}
              <button
                onClick={goToReviewDraft}
                disabled={!draftReady}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                  draftReady
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/30 scale-105'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {draftReady ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Review Draft
                  </>
                ) : (
                  <>
                    <FileEdit className="w-5 h-5" />
                    Review Draft
                  </>
                )}
              </button>
            </div>

            {/* Draft Ready Confirmation */}
            {draftReady && currentDraft && (
              <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-fade-in">
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Draft Ready: "{currentDraft.name}"</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Click <span className="text-green-400">Review Draft</span> to review and finalize your panel
                </p>
              </div>
            )}

            {/* Waiting indicator */}
            {!draftReady && (
              <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Listening for your draft...</span>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="text-center max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-red-400 mb-4">Something Went Wrong</h2>
            <p className="text-slate-400 mb-8">{error}</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setState('ready_for_setup')} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg">
                Try Again
              </button>
              <button onClick={() => { loadPanels(); setState('dashboard'); }} className="text-slate-400 hover:text-white transition">
                Go to Dashboard
              </button>
            </div>
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