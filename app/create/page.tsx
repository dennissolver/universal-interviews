// app/create/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  CheckCircle,
  MessageSquare,
  FileEdit,
  ArrowRight
} from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface PlatformConfig {
  name: string;
  elevenlabs_agent_id: string;
}

interface Draft {
  id: string;
  name: string;
  created_at: string;
}

export default function CreatePage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  // Draft detection state
  const [draftReady, setDraftReady] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Initialize Supabase client once
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      supabaseRef.current = createClient(supabaseUrl, supabaseAnonKey);
    }
  }, []);

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

  // Set session start time when widget loads (user can start talking)
  useEffect(() => {
    if (widgetLoaded && !sessionStartTime) {
      setSessionStartTime(new Date());
      console.log('[CreatePage] Session started, listening for drafts...');
    }
  }, [widgetLoaded, sessionStartTime]);

  // REAL-TIME SUBSCRIPTION: Listen for new drafts
  useEffect(() => {
    if (!widgetLoaded || !sessionStartTime || !supabaseRef.current) {
      return;
    }

    const supabase = supabaseRef.current;

    console.log('[CreatePage] Starting real-time subscription for drafts...');
    console.log('[CreatePage] Session started at:', sessionStartTime.toISOString());

    // Subscribe to INSERT events on panel_drafts table
    const channel = supabase
      .channel('draft-detection')
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
          } else {
            console.log('[CreatePage] ⚠️ Draft ignored - created before session started');
          }
        }
      )
      .subscribe((status) => {
        console.log('[CreatePage] Subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('[CreatePage] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [widgetLoaded, sessionStartTime]);

  const goToReviewDraft = () => {
    if (currentDraft) {
      router.push(`/panel/draft/${currentDraft.id}/edit`);
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

          {/* REVIEW DRAFT BUTTON - Always visible, turns green when ready */}
          <div className="mt-8 flex flex-col items-center">
            <button
              onClick={goToReviewDraft}
              disabled={!draftReady}
              className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-500 ${
                draftReady
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105 cursor-pointer'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {draftReady ? (
                <>
                  <CheckCircle className="w-6 h-6" />
                  Review Draft
                  <ArrowRight className="w-6 h-6" />
                </>
              ) : (
                <>
                  <FileEdit className="w-6 h-6" />
                  Review Draft
                </>
              )}
            </button>

            {/* Status indicator below button */}
            {draftReady && currentDraft ? (
              <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">"{currentDraft.name}"</span>
                </div>
                <p className="text-white/50 text-sm mt-2 text-center">
                  Click the button above to review and finalize your panel
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center gap-2 text-white/40">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Waiting for Sandra to create your draft...</span>
              </div>
            )}
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