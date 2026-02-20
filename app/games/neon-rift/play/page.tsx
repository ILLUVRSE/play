"use client";

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const NeonRift = dynamic(() => import('@/components/game/NeonRift').then(mod => mod.NeonRift), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-mono">LOADING ENGINE...</div>
});

function GameContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') || 'DEFAULT';
  const name = searchParams.get('name') || 'Racer';

  return (
    <div className="min-h-screen bg-[#050010] flex flex-col items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="mb-2 flex justify-between w-full max-w-[720px] text-purple-500 font-mono text-[10px] uppercase tracking-widest opacity-50 px-4">
          <div>Sector: {code}</div>
          <div>Racer: {name}</div>
      </div>
      <div className="relative w-full max-w-[720px] aspect-[9/16] bg-black shadow-[0_0_100px_rgba(126,34,206,0.2)] overflow-hidden">
        <NeonRift
          code={code}
          displayName={name}
        />
      </div>
      <div className="mt-4">
          <a href="/games/neon-rift" className="text-purple-900 hover:text-purple-400 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors">
              Abort Race
          </a>
      </div>
    </div>
  );
}

export default function NeonRiftPlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-purple-500 font-mono">INITIALIZING RIFT...</div>}>
      <GameContent />
    </Suspense>
  );
}
