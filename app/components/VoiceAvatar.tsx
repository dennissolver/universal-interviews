// app/components/VoiceAvatar.tsx
'use client';

import { Bot } from 'lucide-react';

interface VoiceAvatarProps {
  isActive?: boolean;
  isSpeaking?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function VoiceAvatar({ isActive = false, isSpeaking = false, size = 'md', label }: VoiceAvatarProps) {
  const sizeClasses = { sm: 'w-16 h-16', md: 'w-24 h-24', lg: 'w-32 h-32' };
  const iconSizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' };

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="relative">
        {isActive && (
          <>
            <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-purple-500/20 animate-ping`} />
            <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-purple-500/10 animate-pulse`} />
          </>
        )}
        {isSpeaking && <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full border-4 border-green-400 animate-pulse`} />}
        <div className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center ${isActive ? 'bg-gradient-to-br from-purple-600 to-purple-800' : 'bg-slate-800'} shadow-xl`}>
          <Bot className={`${iconSizes[size]} ${isActive ? 'text-white' : 'text-purple-400'}`} />
        </div>
      </div>
      {label && <p className={`mt-3 text-sm ${isActive ? 'text-green-400' : 'text-slate-400'}`}>{label}</p>}
    </div>
  );
}