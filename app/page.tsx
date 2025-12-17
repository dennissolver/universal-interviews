// app/page.tsx
import { Suspense } from 'react';
import SetupClient from './SetupClient';

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    }>
      <SetupClient />
    </Suspense>
  );
}