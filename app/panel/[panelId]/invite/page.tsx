// app/panel/[panelId]/invite/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PanelData {
  id: string
  name: string
  description: string
  agent_name: string
  voice_gender: string
  status: string
  elevenlabs_agent_id: string | null
  questions: string[]
}

export default function PanelInvitePage() {
  const params = useParams()
  const panelId = params.panelId as string

  const [panel, setPanel] = useState<PanelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchPanel() {
      try {
        const response = await fetch(`/api/panels/${panelId}`)
        if (response.ok) {
          const data = await response.json()
          setPanel(data)
        }
      } catch (err) {
        console.error('Failed to load panel:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPanel()
  }, [panelId])

  const interviewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/i/${panelId}`
    : `/i/${panelId}`

  const copyLink = async () => {
    await navigator.clipboard.writeText(interviewUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    )
  }

  if (!panel) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-red-400">Panel not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Success header */}
      <div className="bg-emerald-600/10 border-b border-emerald-600/20">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Panel Created Successfully!</h1>
          <p className="text-emerald-300/80">Your AI interviewer is ready to start conducting research</p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Panel summary */}
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{panel.name}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Interviewer:</span>
              <span className="ml-2 text-white">{panel.agent_name}</span>
            </div>
            <div>
              <span className="text-slate-400">Voice:</span>
              <span className="ml-2 text-white capitalize">{panel.voice_gender}</span>
            </div>
            <div>
              <span className="text-slate-400">Questions:</span>
              <span className="ml-2 text-white">{panel.questions?.length || 0}</span>
            </div>
            <div>
              <span className="text-slate-400">Status:</span>
              <span className="ml-2 text-emerald-400 font-medium">Active</span>
            </div>
          </div>
        </section>

        {/* Interview link */}
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Interview Link</h2>
          <p className="text-sm text-slate-400 mb-4">Share this link with participants to start interviews</p>

          <div className="flex gap-3">
            <input
              type="text"
              value={interviewUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm"
            />
            <button
              onClick={copyLink}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </section>

        {/* Next steps */}
        <section className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Next Steps</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <p className="text-white font-medium">Test the interview yourself</p>
                <p className="text-sm text-slate-400">Click the link above to experience what participants will see</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <p className="text-white font-medium">Share with participants</p>
                <p className="text-sm text-slate-400">Send the interview link via email, LinkedIn, or your preferred channel</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <p className="text-white font-medium">Review transcripts</p>
                <p className="text-sm text-slate-400">Completed interviews will appear in your admin dashboard</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Actions */}
        <div className="flex gap-4">
          <a
            href={`/i/${panelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors text-center"
          >
            Test Interview
          </a>
          <a
            href="/admin"
            className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors text-center"
          >
            Go to Dashboard
          </a>
        </div>
      </main>
    </div>
  )
}