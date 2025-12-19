// app/components/ResearchHero.tsx
'use client';

import Link from 'next/link';
import { ExternalLink, Mic } from 'lucide-react';

export default function ResearchHero() {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-purple-900/20 to-slate-900 border-b border-purple-500/20">
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        {/* Research Series Badge */}
        <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-1 mb-3">
          <span className="text-purple-400 text-sm font-medium">📊 Investor Research Series</span>
        </div>

        {/* Attribution */}
        <p className="text-slate-300 text-lg mb-1">
          Brought to you by <span className="text-white font-semibold">Dennis McMahon</span>
        </p>
        <p className="text-slate-400 mb-4">
          & Corporate AI Solutions
        </p>

        {/* Tagline */}
        <p className="text-slate-500 text-sm mb-5">
          AI-powered tools for founders and investors
        </p>

        {/* Dual CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* Primary CTA - Investor Raise */}
          <Link
            href="https://corporateaisolutions.com/200k/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
          >
            See Our $200K Raise
            <ExternalLink className="w-4 h-4" />
          </Link>

          {/* Secondary CTA - Connexions Platform */}
          <Link
            href="https://connexions-silk.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Mic className="w-4 h-4" />
            Want AI Interviewers for your research?
          </Link>
        </div>
      </div>
    </div>
  );
}