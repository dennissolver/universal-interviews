// app/panel/[panelId]/invite/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Upload, Send, Loader2, CheckCircle, AlertCircle, Download, ArrowLeft, FileSpreadsheet, X, User } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface Panel { id: string; name: string; }
interface Interviewee { name: string; email: string; custom_field?: string; }
interface InviteResult { email: string; success: boolean; error?: string; }

export default function InvitePage() {
  const params = useParams();
  const panelId = params.panelId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [sendingSingle, setSendingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState<InviteResult | null>(null);
  const [bulkInterviewees, setBulkInterviewees] = useState<Interviewee[]>([]);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<InviteResult[]>([]);
  const [parseError, setParseError] = useState('');

  useEffect(() => { loadPanel(); }, [panelId]);

  async function loadPanel() {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('agents').select('id, name').eq('id', panelId).single();
      setPanel(data);
    } catch (err) { console.error('Failed to load panel:', err); }
    finally { setLoading(false); }
  }

  async function handleSingleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSendingSingle(true);
    setSingleResult(null);
    try {
      const res = await fetch('/api/invites/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ panelId, interviewees: [{ name: singleName, email: singleEmail }] }) });
      const data = await res.json();
      if (res.ok && data.results?.[0]) { setSingleResult(data.results[0]); if (data.results[0].success) { setSingleName(''); setSingleEmail(''); } }
      else { setSingleResult({ email: singleEmail, success: false, error: data.error || 'Failed to send' }); }
    } catch (err) { setSingleResult({ email: singleEmail, success: false, error: 'Network error' }); }
    finally { setSendingSingle(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setBulkInterviewees([]);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/invites/parse-excel', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.interviewees) setBulkInterviewees(data.interviewees);
      else setParseError(data.error || 'Failed to parse file');
    } catch (err) { setParseError('Failed to upload file'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleBulkInvite() {
    if (bulkInterviewees.length === 0) return;
    setSendingBulk(true);
    setBulkResults([]);
    try {
      const res = await fetch('/api/invites/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ panelId, interviewees: bulkInterviewees }) });
      const data = await res.json();
      if (res.ok && data.results) { setBulkResults(data.results); const failedEmails = data.results.filter((r: InviteResult) => !r.success).map((r: InviteResult) => r.email); setBulkInterviewees(bulkInterviewees.filter(i => failedEmails.includes(i.email))); }
    } catch (err) { console.error('Bulk invite error:', err); }
    finally { setSendingBulk(false); }
  }

  function downloadTemplate() {
    const csv = 'name,email,custom_field\nJohn Doe,john@example.com,Sales Team\nJane Smith,jane@example.com,Marketing';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'interviewees_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href={`/panel/${panelId}/complete`} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4"><ArrowLeft className="w-4 h-4" />Back to Panel</Link>
          <h1 className="text-2xl font-bold">Invite Interviewees</h1>
          <p className="text-slate-400">{panel?.name}</p>
        </div>
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('single')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeTab === 'single' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><User className="w-4 h-4" />Single Invite</button>
          <button onClick={() => setActiveTab('bulk')} className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeTab === 'bulk' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><FileSpreadsheet className="w-4 h-4" />Bulk Upload</button>
        </div>
        {activeTab === 'single' && (
          <div className="bg-slate-900 rounded-2xl p-6">
            <form onSubmit={handleSingleInvite} className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-1">Name</label><input type="text" value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder="John Doe" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" required /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Email</label><input type="email" value={singleEmail} onChange={(e) => setSingleEmail(e.target.value)} placeholder="john@example.com" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500" required /></div>
              {singleResult && <div className={`p-3 rounded-lg flex items-center gap-2 ${singleResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{singleResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{singleResult.success ? 'Invite sent successfully!' : singleResult.error}</div>}
              <button type="submit" disabled={sendingSingle} className="w-full bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50">{sendingSingle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send Invite</button>
            </form>
          </div>
        )}
        {activeTab === 'bulk' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4"><h3 className="font-medium">Upload Excel or CSV</h3><button onClick={downloadTemplate} className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"><Download className="w-4 h-4" />Download Template</button></div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-8 flex flex-col items-center gap-2 transition"><Upload className="w-8 h-8 text-slate-400" /><span className="text-slate-400">Click to upload .xlsx, .xls, or .csv</span><span className="text-xs text-slate-500">Required columns: name, email</span></button>
              {parseError && <div className="mt-4 p-3 bg-red-500/20 text-red-400 rounded-lg flex items-center gap-2"><AlertCircle className="w-4 h-4" />{parseError}</div>}
            </div>
            {bulkInterviewees.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4"><h3 className="font-medium">{bulkInterviewees.length} interviewees ready</h3><button onClick={() => setBulkInterviewees([])} className="text-sm text-slate-400 hover:text-red-400">Clear All</button></div>
                <div className="max-h-64 overflow-y-auto space-y-2 mb-4">{bulkInterviewees.map((person, i) => (<div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2"><div><span className="font-medium">{person.name}</span><span className="text-slate-400 ml-2">{person.email}</span></div><button onClick={() => setBulkInterviewees(bulkInterviewees.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-400"><X className="w-4 h-4" /></button></div>))}</div>
                <button onClick={handleBulkInvite} disabled={sendingBulk} className="w-full bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50">{sendingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send All Invites</button>
              </div>
            )}
            {bulkResults.length > 0 && (
              <div className="bg-slate-900 rounded-2xl p-6"><h3 className="font-medium mb-4">Results</h3><div className="space-y-2">{bulkResults.map((result, i) => (<div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{result.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}<span>{result.email}</span>{!result.success && <span className="text-xs">- {result.error}</span>}</div>))}</div></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}