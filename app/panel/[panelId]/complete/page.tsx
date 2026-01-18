// app/panel/[panelId]/complete/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Copy, Users, Phone, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import ResearchHero from '@/app/components/ResearchHero';

interface Panel { id: string; name: string; description: string; }

export default function PanelCompletePage() {
  const params = useParams();
  const panelId = params.panelId as string;
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [interviewUrl, setInterviewUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setInterviewUrl(`${window.location.origin}/i/${panelId}`);
    loadPanel();
  }, [panelId]);

  async function loadPanel() {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('agents').select('*').eq('id', panelId).single();
      setPanel(data);
    } catch (err) {
      console.error('Failed to load panel:', err);
    } finally {
      setLoading(false);
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(interviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <ResearchHero />
        <div className="flex-1 flex items-center justify-center text-white">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Panel Not Found</h1>
            <Link href="/" className="text-purple-400">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Research Hero Banner */}
      <ResearchHero />

      {/* Main Content */}
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Great Work!</h1>
            <p className="text-xl text-slate-300">
              Your <span className="text-purple-400">{panel.name}</span> panel is ready
            </p>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 mb-6">
            <label className="block text-sm text-slate-400 mb-2">Interview Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={interviewUrl}
                readOnly
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm"
              />
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${copied ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                <Copy className="w-4 h-4" />{copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Link
              href={`/i/${panelId}`}
              className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 px-6 py-4 rounded-xl font-semibold transition"
            >
              <Phone className="w-5 h-5" />Test Interview
            </Link>
            <Link
              href={`/panel/${panelId}/invite`}
              className="flex items-center justify-center gap-3 bg-purple-600 hover:bg-purple-500 px-6 py-4 rounded-xl font-semibold transition"
            >
              <Users className="w-5 h-5" />Invite Interviewees
            </Link>
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="text-slate-400 hover:text-white transition">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}