"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/games/spacelight/leaderboard')
      .then(res => res.json())
      .then(data => {
        setScores(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#000510] flex flex-col items-center py-20 px-4 font-mono text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500 rounded-full blur-[150px]" />
      </div>

      <h1 className="text-4xl font-black text-cyan-400 mb-2 italic tracking-tighter relative z-10">GLOBAL RANKINGS</h1>
      <div className="w-16 h-1 bg-purple-600 mb-12 relative z-10" />

      <div className="w-full max-w-2xl bg-black/60 border border-cyan-500/20 rounded-xl overflow-hidden backdrop-blur-xl relative z-10 shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-cyan-950/50 text-cyan-400 text-xs uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4 border-b border-cyan-500/20">Rank</th>
              <th className="px-6 py-4 border-b border-cyan-500/20">Pilot</th>
              <th className="px-6 py-4 border-b border-cyan-500/20">Waves</th>
              <th className="px-6 py-4 border-b border-cyan-500/20 text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-cyan-700 animate-pulse uppercase tracking-[0.2em]">Scanning Data Banks...</td></tr>
            ) : scores.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-cyan-900 uppercase tracking-[0.2em]">No Flight Records Found</td></tr>
            ) : scores.map((score, i) => (
              <tr key={score.id} className="hover:bg-cyan-500/5 transition-colors group">
                <td className="px-6 py-4 font-bold text-cyan-600">#{i + 1}</td>
                <td className="px-6 py-4 text-cyan-50 group-hover:text-cyan-300 transition-colors">{score.displayName}</td>
                <td className="px-6 py-4 text-cyan-500/70">{score.wavesCleared}</td>
                <td className="px-6 py-4 text-right text-purple-400 font-bold group-hover:text-purple-300 transition-colors">{score.score.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link href="/games/spacelight" className="mt-12 text-cyan-700 hover:text-cyan-400 transition-all uppercase tracking-[0.4em] text-xs font-bold border-b border-transparent hover:border-cyan-400 pb-1 relative z-10">
        [ Return to Hangar ]
      </Link>
    </div>
  );
}
