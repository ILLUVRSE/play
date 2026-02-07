'use client';
'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { MemeMachinePanel } from '@/components/mememachine/MemeMachinePanel';
import type { MemeResponse } from '@/lib/mememachine';
import { getControlSettings } from '@/lib/controlSettings';

export default function MemeMachinePage() {
  const [history, setHistory] = useState<MemeResponse[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('mememachine:history');
    if (stored) {
      setHistory(JSON.parse(stored));
    }
  }, []);

  const addHistory = (img: MemeResponse) => {
    const allowHistory = getControlSettings().allowHistory;
    if (!allowHistory) return;
    const next = [img, ...history].slice(0, 6);
    setHistory(next);
    localStorage.setItem('mememachine:history', JSON.stringify(next));
  };

  return (
    <div>
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2">
          <p className="pill inline-block">MemeMachine</p>
          <h1 className="text-3xl font-bold">Turn any idea into a meme. Make it chaotic.</h1>
          <p className="text-white/70">Server-side generation using OpenAI Images. GIF mode coming soon.</p>
        </div>

        <MemeMachinePanel onGenerated={addHistory} />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent</h2>
            <Link href="/" className="button-ghost border-brand-primary/40">Back to Home</Link>
          </div>
          {history.length === 0 && <p className="text-white/60 text-sm">No memes yet. Generate one!</p>}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {history.map((img, idx) => (
              <div key={idx} className="glass p-3 border-brand-primary/30 space-y-2">
                {img.b64_png ? (
                  <img src={`data:image/png;base64,${img.b64_png}`} alt="meme" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <div className="text-white/60 text-sm">No preview</div>
                )}
                <div className="text-xs text-white/60">{img.aspect} • {img.width}x{img.height}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
