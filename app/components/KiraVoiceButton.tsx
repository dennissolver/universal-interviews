// app/components/KiraVoiceButton.tsx
'use client';

import { useState, useEffect } from 'react';

interface KiraVoiceButtonProps {
  panelId?: string;
  panelName?: string;
  className?: string;
}

export default function KiraVoiceButton({ panelId, panelName, className = '' }: KiraVoiceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Fetch the insights agent ID on mount
  useEffect(() => {
    async function fetchAgentId() {
      try {
        const res = await fetch('/api/platform');
        if (res.ok) {
          const data = await res.json();
          // Look for insights agent ID in platform config
          if (data.insightsAgentId) {
            setAgentId(data.insightsAgentId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch platform config:', err);
      }
    }
    fetchAgentId();
  }, []);

  const startConversation = async () => {
    if (!agentId) {
      setError('Kira is not configured yet. Please contact support.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // For now, open ElevenLabs widget or redirect
      // In production, this would use the ElevenLabs Convai SDK
      const widgetUrl = `https://elevenlabs.io/convai/${agentId}`;
      
      // Option 1: Open in new tab
      window.open(widgetUrl, '_blank', 'width=400,height=600');
      
      // Option 2: Embed widget (would need ElevenLabs SDK)
      // This is a placeholder for the actual implementation
      
      setIsConnected(true);
    } catch (err) {
      setError('Failed to connect to Kira. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      {/* Voice Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 rounded-2xl font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25 ${className}`}
      >
        <div className="relative">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <span>Talk to Kira</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl max-w-md w-full border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Kira</h3>
                  <p className="text-xs text-zinc-500">Your Research Analyst</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-zinc-300 mb-4">
                Ask questions about your research in natural language. Kira has access to all your interview data.
              </p>

              {panelName && (
                <p className="text-sm text-zinc-500 mb-4">
                  Currently viewing: <span className="text-zinc-300">{panelName}</span>
                </p>
              )}

              {/* Example Questions */}
              <div className="mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Try asking:</p>
                <div className="space-y-2">
                  {[
                    "What are the main pain points?",
                    "Show me quotes about pricing",
                    "Summarize the sentiment trends",
                    "What do people want most?"
                  ].map((question, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-400 border border-zinc-700/50"
                    >
                      "{question}"
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={startConversation}
                disabled={isConnecting || !agentId}
                className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isConnecting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : !agentId ? (
                  'Kira not available'
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Start Voice Conversation
                  </>
                )}
              </button>

              <p className="text-xs text-zinc-600 text-center mt-4">
                Powered by ElevenLabs Conversational AI
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
