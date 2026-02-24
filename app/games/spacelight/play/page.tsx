"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SpacelightArena } from '@/components/game/SpacelightArena';

function GameContent() {
  const searchParams = useSearchParams();
  const code = searchParams?.get('code') || 'DEFAULT';
  const name = searchParams?.get('name') || 'Pilot';
  const mode = searchParams?.get('mode') || 'solo';

  return (
    <div className="min-h-screen bg-[#000510] flex flex-col items-center justify-center p-4">
      <div className="mb-4 flex justify-between w-full max-w-[800px] text-cyan-500 font-mono text-xs uppercase tracking-widest opacity-50">
          <div>Sector: {code}</div>
          <div>Pilot: {name}</div>
          <div>Mode: {mode}</div>
      </div>
      <SpacelightArena
        code={code}
        displayName={name}
        isCoop={mode === 'coop'}
      />
      <div className="mt-8">
          <a href="/games/spacelight" className="text-cyan-800 hover:text-cyan-400 font-mono text-xs uppercase tracking-[0.2em] transition-colors">
              Abort Mission
          </a>
      </div>
    </div>
  );
}

export default function SpacelightPlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-cyan-500 font-mono">INITIALIZING MISSION...</div>}>
      <GameContent />
    </Suspense>
  );
}
