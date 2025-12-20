// app/panel/draft/[draftId]/edit/page.tsx
// User reviews and edits panel configuration before final creation

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic,
  User,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Check,
  Loader2,
  Sparkles,
  AlertCircle
} from 'lucide-react';

const VOICE_OPTIONS = [
  { value: 'female', label: 'Female', name: 'Sarah', desc: 'Warm & Professional' },
  { value: 'male', label: 'Male', name: 'Adam', desc: 'Deep & Confident' },
];

const TONE_OPTIONS = [
  { value: 'friendly and professional', label: 'Friendly & Professional' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual and friendly', label: 'Casual & Friendly' },
  { value: 'academic', label: 'Academic' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'warm and professional', label: 'Warm & Professional' },
];

export default function EditDraftPage() {
  const params = useParams();
  const router = useRouter();
  const draftId = params.draftId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [agentName, setAgentName] = useState('');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('female');
  const [tone, setTone] = useState('friendly and professional');
  const [duration, setDuration] = useState(15);
  const [targetAudience, setTargetAudience] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Load draft data
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch(`/api/panels/${draftId}`);
        if (!res.ok) throw new Error('Failed to load draft');

        const data = await res.json();

        // API returns flat structure directly (not wrapped in "panel")
        setName(data.name || '');
        setDescription(data.description || '');
        setQuestions(data.questions || []);
        setAgentName(data.agent_name || 'Alex');
        setVoiceGender(data.voice_gender || 'female');
        setTone(data.tone || 'friendly and professional');
        setDuration(data.duration_minutes || 15);
        setTargetAudience(data.target_audience || '');
        setClosingMessage(data.closing_message || '');
        setCompanyName(data.company_name || '');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDraft();
  }, [draftId]);

  // Question management
  const addQuestion = () => {
    setQuestions([...questions, '']);
  };

  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions];
    updated[index] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const updated = [...questions];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setQuestions(updated);
  };

  // Save draft (without creating ElevenLabs agent)
  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/panels/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          questions: questions.filter(q => q.trim()),
          tone,
          duration_minutes: duration,
          target_audience: targetAudience,
          closing_message: closingMessage,
          agent_name: agentName,
          voice_gender: voiceGender,
          company_name: companyName,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Create panel (creates ElevenLabs agent and activates)
  const createPanel = async () => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/tools/create-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_id: draftId,
          name,
          description,
          questions: questions.filter(q => q.trim()),
          tone,
          target_audience: targetAudience,
          duration_minutes: duration,
          agent_name: agentName,
          voice_gender: voiceGender,
          closing_message: closingMessage,
          company_name: companyName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create panel');
      }

      const data = await res.json();

      // Redirect to the new panel
      router.push(`/panel/${data.panelId}/invite`);
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your draft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-purple-400 text-sm mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Review & Edit</span>
          </div>
          <h1 className="text-3xl font-bold">Your Interview Panel</h1>
          <p className="text-slate-400 mt-2">
            Review the details Sandra collected, make any changes, then create your panel.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* Success Banner */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <p className="text-green-400">Draft saved successfully!</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Panel Details */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-purple-400" />
              Panel Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Panel Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  placeholder="e.g., Customer Discovery - Product Feedback"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Research Objective
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                  placeholder="What insights are you hoping to gather?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target Audience
                </label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                  placeholder="e.g., VC Partners with 3+ years experience"
                />
              </div>
            </div>
          </section>

          {/* Interviewer Persona */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              AI Interviewer
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Interviewer Name
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                  placeholder="e.g., Alex, Jordan, Dr. Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Voice
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {VOICE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setVoiceGender(option.value as 'male' | 'female')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        voiceGender === option.value
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-slate-400">
                        {option.name} - {option.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                >
                  {TONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 15)}
                  min={5}
                  max={60}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
          </section>

          {/* Questions */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Mic className="w-5 h-5 text-purple-400" />
                Interview Questions ({questions.length})
              </h2>
              <button
                onClick={addQuestion}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={index} className="flex items-start gap-3 group">
                  <div className="flex flex-col gap-1 pt-3">
                    <button
                      onClick={() => moveQuestion(index, index - 1)}
                      disabled={index === 0}
                      className="text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveQuestion(index, index + 1)}
                      disabled={index === questions.length - 1}
                      className="text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500">Q{index + 1}</span>
                    </div>
                    <textarea
                      value={question}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                      placeholder="Enter your question..."
                    />
                  </div>

                  <button
                    onClick={() => removeQuestion(index)}
                    className="mt-8 p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p>No questions yet.</p>
                  <button
                    onClick={addQuestion}
                    className="mt-2 text-purple-400 hover:text-purple-300"
                  >
                    Add your first question
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Closing Message */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Closing Message</h2>
            <textarea
              value={closingMessage}
              onChange={(e) => setClosingMessage(e.target.value)}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
              placeholder="Thank you message at end of interview..."
            />
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="px-6 py-3 text-slate-300 hover:text-white transition disabled:opacity-50 border border-slate-700 rounded-lg hover:border-slate-600"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Draft'
              )}
            </button>

            <button
              onClick={createPanel}
              disabled={creating || !name || questions.filter(q => q.trim()).length === 0}
              className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Panel...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Create Panel
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}