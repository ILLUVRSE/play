"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NeonRiftMenu() {
  const [displayName, setDisplayName] = useState('');
  const router = useRouter();

  const handleStart = () => {
    if (!displayName) return alert('Enter a racer name!');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/games/neon-rift/play?code=${code}&name=${encodeURIComponent(displayName)}`);
  };

  return (
    <div className="min-h-screen bg-[#050010] flex flex-col items-center justify-center text-white font-mono p-4 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full" />
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full" />

      <div className="relative mb-16 z-10 text-center">
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-400 via-white to-cyan-400 tracking-tighter italic uppercase">
          NEON RIFT
        </h1>
        <div className="absolute -bottom-4 right-0 text-purple-400 text-xl font-bold tracking-[0.5em] opacity-80 uppercase">
          RACERS
        </div>
      </div>

      <div className="w-full max-w-md space-y-8 bg-black/60 p-8 rounded-2xl border border-purple-500/30 backdrop-blur-2xl relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div>
          <label className="block text-purple-400 text-xs uppercase mb-3 tracking-[0.2em] font-bold">Racer Identity</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="ENTER CALLSIGN..."
            className="w-full bg-black/50 border-b-2 border-purple-500/50 py-3 px-4 text-xl focus:outline-none focus:border-purple-400 focus:bg-purple-950/20 transition-all text-purple-50 placeholder:text-purple-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => handleStart()}
            className="group relative overflow-hidden bg-purple-700 hover:bg-purple-600 py-4 rounded-lg font-bold text-xl transition-all shadow-[0_0_20px_rgba(126,34,206,0.3)] hover:shadow-[0_0_30px_rgba(126,34,206,0.5)]"
          >
            <span className="relative z-10 uppercase">Enter the Rift</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          </button>
        </div>

        <div className="flex justify-center space-x-8 pt-4 text-purple-500/60 text-xs font-bold tracking-widest">
          <Link href="/" className="hover:text-purple-400 transition-colors uppercase">
            Exit
          </Link>
        </div>
      </div>

      <div className="mt-20 text-center text-purple-900 text-[10px] max-w-xs uppercase tracking-[0.3em] leading-relaxed relative z-10 opacity-50">
        Grid Protocol Active • Port: 9000 • Auth: Rift Command
      </div>
    </div>
  );
}
