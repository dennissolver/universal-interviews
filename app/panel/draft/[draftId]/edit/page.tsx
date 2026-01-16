// app/panel/draft/[draftId]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Loader2, Save, Rocket, Plus, Trash2,
  User, Clock, FileText,
  ArrowLeft, CheckCircle, AlertCircle
} from 'lucide-react';

interface PanelData {
  id: string;
  name: string;
  description: string;
  questions: string[];
  tone: string;
  target_audience: string;
  duration_minutes: number;
  agent_name: string;
  voice_gender: 'male' | 'female';
  closing_message: string;
  greeting: string;
  status: string;
}

const TONE_OPTIONS = [
  'Warm and professional',
  'Professional',
  'Casual and friendly',
  'Academic',
  'Empathetic',
  'Curious and engaged'
];

const DURATION_OPTIONS = [5, 10, 15, 20, 30];

export default function DraftEditPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.draftId as string;

  const [panel, setPanel] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [newQuestion, setNewQuestion] = useState('');

  // Fetch panel data
  useEffect(() => {
    async function fetchPanel() {
      try {
        const response = await fetch(`/api/panels/${draftId}`);
        if (!response.ok) throw new Error('Panel not found');
        const data = await response.json();

        // Ensure questions is an array
        let questions = data.questions || [];
        if (typeof questions === 'string') {
          questions = questions.split(/\d+\.\s+/).filter((q: string) => q.trim());
        }
        if (!Array.isArray(questions)) {
          questions = [];
        }

        setPanel({
          ...data,
          questions,
          voice_gender: data.voice_gender || 'female',
          agent_name: data.agent_name || 'Alex',
          tone: data.tone || 'Warm and professional',
          duration_minutes: data.duration_minutes || 15,
          closing_message: data.closing_message || 'Thank you so much for your time and insights today!',
          greeting: data.greeting || ''
        });
      } catch (err) {
        setError('Failed to load panel');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPanel();
  }, [draftId]);

  // Update a field
  const updateField = (field: keyof PanelData, value: any) => {
    if (!panel) return;
    setPanel({ ...panel, [field]: value });
    setSaveStatus('idle');
  };

  // Add question
  const addQuestion = () => {
    if (!panel || !newQuestion.trim()) return;
    setPanel({ ...panel, questions: [...panel.questions, newQuestion.trim()] });
    setNewQuestion('');
    setSaveStatus('idle');
  };

  // Remove question
  const removeQuestion = (index: number) => {
    if (!panel) return;
    const updated = panel.questions.filter((_, i) => i !== index);
    setPanel({ ...panel, questions: updated });
    setSaveStatus('idle');
  };

  // Update question
  const updateQuestion = (index: number, value: string) => {
    if (!panel) return;
    const updated = [...panel.questions];
    updated[index] = value;
    setPanel({ ...panel, questions: updated });
    setSaveStatus('idle');
  };

  // Save draft
  const saveDraft = async () => {
    if (!panel) return;
    setSaving(true);
    setSaveStatus('saving');

    try {
      const response = await fetch(`/api/panels/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(panel)
      });

      if (!response.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Create panel (publish)
  const createPanel = async () => {
    if (!panel) return;
    setCreating(true);
    setError(null);

    try {
      // First save any pending changes
      await fetch(`/api/panels/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(panel)
      });

      // Then create the ElevenLabs agent
      const response = await fetch('/api/tools/create-panel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': 'internal-create-panel'
        },
        body: JSON.stringify({ draft_id: draftId })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create panel');
      }

      const data = await response.json();

      // Redirect to invite page
      router.push(`/panel/${data.panelId || draftId}/invite`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create panel');
    } finally {
      setCreating(false);
    }
  };

  // Validation
  const isValid = panel &&
    panel.name?.trim() &&
    panel.questions?.length >= 1 &&
    panel.agent_name?.trim();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your draft...</p>
        </div>
      </div>
    );
  }

  if (error && !panel) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Draft</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!panel) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold">Edit Draft</h1>
              <p className="text-sm text-slate-400">Review and customize your panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition disabled:opacity-50"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveStatus === 'saved' ? 'Saved!' : 'Save Draft'}
            </button>
            <button
              onClick={createPanel}
              disabled={!isValid || creating}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4" />
              )}
              {creating ? 'Creating...' : 'Create Panel'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error creating panel</p>
              <p className="text-red-400/80 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Panel Name & Description */}
        <section className="bg-slate-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold">Panel Details</h2>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Panel Name *</label>
            <input
              type="text"
              value={panel.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., Customer Feedback Study"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Description</label>
            <textarea
              value={panel.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Brief description of what this panel is for..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Target Audience</label>
            <input
              type="text"
              value={panel.target_audience || ''}
              onChange={(e) => updateField('target_audience', e.target.value)}
              placeholder="e.g., Enterprise software buyers, Marketing managers"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </section>

        {/* Interviewer Settings */}
        <section className="bg-slate-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-pink-400" />
            </div>
            <h2 className="text-lg font-semibold">AI Interviewer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Interviewer Name *</label>
              <input
                type="text"
                value={panel.agent_name}
                onChange={(e) => updateField('agent_name', e.target.value)}
                placeholder="e.g., Alex, Jordan, Dr. Smith"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Voice</label>
              <div className="flex bg-slate-800 rounded-xl p-1">
                <button
                  onClick={() => updateField('voice_gender', 'female')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    panel.voice_gender === 'female'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Female (Sarah)
                </button>
                <button
                  onClick={() => updateField('voice_gender', 'male')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                    panel.voice_gender === 'male'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Male (Adam)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Tone</label>
              <select
                value={panel.tone}
                onChange={(e) => updateField('tone', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {TONE_OPTIONS.map((tone) => (
                  <option key={tone} value={tone}>{tone}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Duration</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <select
                  value={panel.duration_minutes}
                  onChange={(e) => updateField('duration_minutes', parseInt(e.target.value))}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>{mins} minutes</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Custom Greeting (optional)</label>
            <input
              type="text"
              value={panel.greeting || ''}
              onChange={(e) => updateField('greeting', e.target.value)}
              placeholder="Leave blank for default greeting"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Closing Message</label>
            <input
              type="text"
              value={panel.closing_message || ''}
              onChange={(e) => updateField('closing_message', e.target.value)}
              placeholder="Thank you message at the end of interviews"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </section>

        {/* Questions */}
        <section className="bg-slate-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Interview Questions</h2>
                <p className="text-sm text-slate-400">{panel.questions.length} question{panel.questions.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-3">
            {panel.questions.map((question, index) => (
              <div
                key={index}
                className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-4 group"
              >
                <span className="text-purple-400 font-medium text-sm mt-1 w-6">{index + 1}.</span>
                <textarea
                  value={question}
                  onChange={(e) => updateQuestion(index, e.target.value)}
                  rows={2}
                  className="flex-1 bg-transparent text-white resize-none focus:outline-none"
                />
                <button
                  onClick={() => removeQuestion(index)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Question */}
          <div className="flex gap-3 pt-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addQuestion()}
              placeholder="Add a new question..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={addQuestion}
              disabled={!newQuestion.trim()}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-4 pb-8">
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition"
          >
            ← Back to Dashboard
          </button>

          <div className="flex items-center gap-3">
            {!isValid && (
              <p className="text-sm text-amber-400">
                {!panel.name?.trim() && 'Panel name required. '}
                {!panel.agent_name?.trim() && 'Interviewer name required. '}
                {panel.questions?.length < 1 && 'Add at least one question.'}
              </p>
            )}
            <button
              onClick={createPanel}
              disabled={!isValid || creating}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
            >
              {creating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Rocket className="w-5 h-5" />
              )}
              {creating ? 'Creating Panel...' : 'Create Panel'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}