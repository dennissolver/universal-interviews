// app/create/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Loader2, FileEdit, CheckCircle, Phone } from 'lucide-react';

interface Platform {
  id: string;
  name: string;
  elevenlabs_agent_id: string;
}

interface Draft {
  id: string;
  name: string;
  created_at: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CreatePage() {
  const router = useRouter();

  // Platform state
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Widget state
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Draft detection state
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);

  // Refs for cleanup
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<any>(null);

  // Fetch platform config
  useEffect(() => {
    async function fetchPlatform() {
      try {
        const res = await fetch('/api/platform');
        if (!res.ok) throw new Error('Failed to load platform');
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

  // Set session start time when widget loads
  useEffect(() => {
    if (widgetLoaded && !sessionStartTime) {
      setSessionStartTime(new Date());
      console.log('[CreatePage] Session started, listening for drafts...');
    }
  }, [widgetLoaded, sessionStartTime]);

  // POLLING FUNCTION: Check for new drafts
  const checkForDraft = useCallback(async () => {
    if (!sessionStartTime || draftReady) return;

    try {
      const { data: drafts, error } = await supabase
        .from('panel_drafts')
        .select('id, name, created_at')
        .eq('status', 'draft')
        .gte('created_at', sessionStartTime.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('[CreatePage] Poll error:', error);
        return;
      }

      if (drafts && drafts.length > 0) {
        const draft = drafts[0];
        console.log('[CreatePage] ✅ Draft found via polling:', draft.name);
        setCurrentDraft(draft);
        setDraftReady(true);

        // Stop polling once found
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch (err) {
      console.error('[CreatePage] Poll exception:', err);
    }
  }, [sessionStartTime, draftReady]);

  // DUAL DETECTION: Real-time subscription + Polling fallback
  useEffect(() => {
    if (!widgetLoaded || !sessionStartTime) return;

    console.log('[CreatePage] Starting draft detection...');
    console.log('[CreatePage] Session started at:', sessionStartTime.toISOString());

    // === REAL-TIME SUBSCRIPTION ===
    const channel = supabase
      .channel('draft-detection-' + Date.now())
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'panel_drafts'
        },
        (payload) => {
          console.log('[CreatePage] Real-time: New draft detected!', payload);

          const newDraft = payload.new as Draft;
          const draftCreatedAt = new Date(newDraft.created_at);

          // Verify this draft was created AFTER the session started
          if (draftCreatedAt >= sessionStartTime) {
            console.log('[CreatePage] ✅ Draft verified - created during this session:', newDraft.name);
            setCurrentDraft(newDraft);
            setDraftReady(true);

            // Stop polling since we found it
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          } else {
            console.log('[CreatePage] ⚠️ Draft ignored - created before session started');
          }
        }
      )
      .subscribe((status) => {
        console.log('[CreatePage] Subscription status:', status);
      });

    realtimeChannelRef.current = channel;

    // === POLLING FALLBACK ===
    // Start polling every 3 seconds as backup in case real-time fails
    pollIntervalRef.current = setInterval(() => {
      console.log('[CreatePage] Polling for draft...');
      checkForDraft();
    }, 3000);

    // Also do an immediate check
    checkForDraft();

    // Cleanup
    return () => {
      console.log('[CreatePage] Cleaning up draft detection');
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [widgetLoaded, sessionStartTime, checkForDraft]);

  // Navigate to draft review
  const goToReviewDraft = () => {
    if (currentDraft) {
      router.push(`/panels/drafts/${currentDraft.id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error || !platform?.elevenlabs_agent_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 max-w-md text-center">
          <p className="text-red-400">
            {error || 'Platform not configured. Please contact support.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Create Interview Panel
          </h1>
          <p className="text-lg text-purple-200/70">
            Talk to Sandra to set up your interview panel. She&apos;ll guide you through the process.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Instructions */}
          <div className="mb-8 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-purple-200 font-medium mb-1">How it works:</p>
                <ol className="text-purple-200/70 text-sm space-y-1 list-decimal list-inside">
                  <li>Click the purple button below to start talking with Sandra</li>
                  <li>Tell her about your research goals and target audience</li>
                  <li>She&apos;ll create a draft panel for you to review</li>
                  <li>The &quot;Review Draft&quot; button will turn green when ready</li>
                </ol>
              </div>
            </div>
          </div>

          {/* ElevenLabs Widget */}
          <div className="flex justify-center mb-8">
            {widgetLoaded ? (
              <elevenlabs-convai agent-id={platform.elevenlabs_agent_id}></elevenlabs-convai>
            ) : (
              <div className="flex items-center gap-2 text-purple-300">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading voice assistant...</span>
              </div>
            )}
          </div>

          {/* Review Draft Button - Always visible, activates when draft is ready */}
          <div className="flex justify-center">
            <button
              onClick={goToReviewDraft}
              disabled={!draftReady}
              className={`
                inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg
                transition-all duration-300 transform
                ${draftReady
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 cursor-pointer'
                  : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                }
              `}
            >
              {draftReady ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Review Draft: {currentDraft?.name}
                </>
              ) : (
                <>
                  <FileEdit className="w-6 h-6" />
                  Review Draft
                  <span className="text-sm font-normal opacity-50">(waiting for Sandra)</span>
                </>
              )}
            </button>
          </div>

          {/* Status indicator */}
          {sessionStartTime && !draftReady && (
            <p className="text-center text-purple-300/50 text-sm mt-4">
              <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
              Listening for your draft...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// TypeScript declaration for ElevenLabs widget
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
